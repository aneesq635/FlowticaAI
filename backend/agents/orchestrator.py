from agents.base import BaseAgent
from core.state import AgentState
from typing import Dict, Any, List
from langchain_core.messages import AIMessage, SystemMessage
import json


# ============================================================
# SUPERVISOR AGENT
# ============================================================
class SupervisorAgent(BaseAgent):
    def __init__(self, db=None):
        super().__init__("Supervisor", "Stage-Aware Orchestrator")
        self.db = db

    def run(self, state: AgentState) -> Dict[str, Any]:
        # ── DB STATE SYNC (unchanged from original) ──────────────────
        active_request_id = state.get("active_request_id")
        conversation_id = state.get("conversation_id")
        customer_supabase_id = state.get("user_id")

        real_request = None
        db_sync_updates = {}

        if self.db is not None:
            if active_request_id:
                from bson import ObjectId
                try:
                    real_request = self.db.active_requests.find_one({"_id": ObjectId(active_request_id)})
                except Exception as e:
                    print(f"[SUPERVISOR SYNC WARNING] {e}")

            if not real_request and conversation_id:
                real_request = self.db.active_requests.find_one({"conversation_id": conversation_id})
                if real_request:
                    active_request_id = str(real_request["_id"])

            if not real_request and customer_supabase_id and customer_supabase_id != "anonymous":
                real_request = self.db.active_requests.find_one({
                    "customer_supabase_id": customer_supabase_id,
                    "status": {"$ne": "booked"},
                })
                if real_request:
                    active_request_id = str(real_request["_id"])

            if real_request:
                db_status = real_request.get("status", "pending")
                print(f"[SUPERVISOR SYNC] Found active request {active_request_id} status='{db_status}'.")
                negotiation_data = state.get("negotiation", {}) or {}
                booking_data = state.get("booking", {}) or {}
                db_sync_updates.update({
                    "active_request_id": active_request_id,
                    "latest_request_status": db_status,
                    "negotiation_stage": db_status,
                    "negotiation_status": db_status,
                    "active_request": real_request,
                    "negotiation": {**negotiation_data, "negotiation_stage": db_status, "latest_request_status": db_status},
                    "booking": {**booking_data, "active_request_id": active_request_id, "latest_request_status": db_status},
                })
                booking_details = state.get("booking_details", {}) or {}
                if booking_details.get("status") != db_status or booking_details.get("request_id") != active_request_id:
                    db_sync_updates["booking_details"] = {
                        **booking_details,
                        "request_id": active_request_id,
                        "status": db_status,
                        "offered_price": real_request.get("offered_price"),
                        "requested_date": real_request.get("requested_date"),
                        "requested_time": real_request.get("requested_time"),
                    }
            else:
                if active_request_id or state.get("booking_details", {}).get("request_id"):
                    print("[SUPERVISOR SYNC] Stale request cache detected — clearing.")
                    db_sync_updates.update({
                        "active_request_id": "",
                        "latest_request_status": "",
                        "negotiation_stage": "",
                        "negotiation_status": "",
                        "active_request": {},
                        "booking_details": {},
                        "booking": {**(state.get("booking", {}) or {}), "active_request_id": "", "active_request": {}, "latest_request_status": ""},
                        "negotiation": {**(state.get("negotiation", {}) or {}), "negotiation_stage": "", "negotiation_status": "", "latest_request_status": ""},
                    })

        for k, v in db_sync_updates.items():
            state[k] = v

        # Get the fresh active_request_id after MongoDB sync checks
        active_request_id = db_sync_updates.get("active_request_id") or state.get("active_request_id")

        # ── READ CORE STATE ───────────────────────────────────────────
        intent_obj = state.get("intent", {})
        intent = intent_obj.get("value") if isinstance(intent_obj, dict) else None

        last_routed_to = state.get("next_agent", "")
        conv_stage = state.get("conversation_stage", "greeting")
        is_resumed = state.get("metadata", {}).get("is_resumed", False)
        iteration = state.get("iteration_count", 0) + 1

        # ── CENTRALIZED FAILURE-AWARE GATE & RECOVERY MODE (Rule 2) ──
        request_creation_success = state.get("request_creation_success")
        request_creation_error = state.get("request_creation_error")
        booking_outcome = state.get("booking_outcome") or {}

        has_failure = False
        failure_msg = ""

        if request_creation_success is False:
            has_failure = True
            failure_msg = f"Request creation failed: {request_creation_error or 'Unknown error'}"
        elif booking_outcome.get("booking_failure") or (booking_outcome and not booking_outcome.get("booking_success")):
            has_failure = True
            failure_msg = f"Booking confirmation failed: {booking_outcome.get('booking_failure_reason') or 'Unknown error'}"

        if has_failure:
            print(f"[SUPERVISOR AUDIT] Failure detected in pipeline. Stopping and entering recovery mode. Reason: {failure_msg}")
            log = self.log_action(state, "Pipeline error caught by Supervisor", failure_msg)
            trace = self.create_trace(f"Pipeline error. Reason: {failure_msg}")
            turn_routed = list(state.get("turn_routed_agents", []) or []) + ["communication"]
            
            # Enforce workflow_stage failed state
            db_sync_updates.update({
                "conversation_stage": "failed",
                "workflow_stage": "failed",
            })
            
            return {
                "next_agent": "communication",
                "active_agent": "supervisor",
                "conversation_stage": "failed",
                "workflow_stage": "failed",
                "iteration_count": iteration,
                "turn_routed_agents": turn_routed,
                "execution_logs": [log],
                "reasoning_traces": [trace],
                **db_sync_updates,
            }

        # ── LOOP GUARD ────────────────────────────────────────────────
        if iteration > 12:
            print(f"[SUPERVISOR] LOOP GUARD at iteration {iteration}. Forcing communication.")
            return {
                "next_agent": "communication",
                "active_agent": "supervisor",
                "iteration_count": iteration,
                "execution_logs": [self.log_action(state, "Loop guard", f"Forced END after {iteration} iters")],
                "reasoning_traces": [self.create_trace("Max iterations reached.")],
                **db_sync_updates,
            }

        print(f"\n[SUPERVISOR] iter={iteration} intent={intent} last={last_routed_to} stage={conv_stage}")

        # ── BOOKING OUTCOME GATE ──────────────────────────────────────
        if last_routed_to == "booking":
            if not booking_outcome.get("booking_success"):
                failure_reason = booking_outcome.get("booking_failure_reason", "Unknown failure in booking step.")
                print(f"[SUPERVISOR] BOOKING FAILED. Blocking pipeline. Reason: {failure_reason}")
                log = self.log_action(state, "Booking failed — routing to error communication", failure_reason)
                trace = self.create_trace(f"Booking gate blocked: {failure_reason}")
                turn_routed = list(state.get("turn_routed_agents", []) or []) + ["communication"]
                return {
                    "next_agent": "communication",
                    "active_agent": "supervisor",
                    "conversation_stage": "booking_failed",
                    "workflow_stage": "failed",
                    "iteration_count": iteration,
                    "turn_routed_agents": turn_routed,
                    "execution_logs": [log],
                    "reasoning_traces": [trace],
                    **db_sync_updates,
                }
            # booking_success == True → proceed to scheduling
            print(f"[SUPERVISOR] Booking succeeded (booking_id={booking_outcome.get('booking_id')}). Routing to scheduling.")

        # ── NO INTENT YET ─────────────────────────────────────────────
        if not intent:
            next_agent = "memory" if (is_resumed and not last_routed_to) else "intent"
            reasoning = "Resumed → memory" if next_agent == "memory" else "No intent → intent agent"
            turn_routed = list(state.get("turn_routed_agents", []) or []) + [next_agent]
            return {
                "next_agent": next_agent,
                "active_agent": "supervisor",
                "iteration_count": iteration,
                "turn_routed_agents": turn_routed,
                "execution_logs": [self.log_action(state, f"Routing to {next_agent}", reasoning)],
                "reasoning_traces": [self.create_trace(f"[iter {iteration}] No intent → {next_agent}")],
                **db_sync_updates,
            }

        # ── DETERMINISTIC ROUTING ─────────────────────────────────────
        next_agent = "communication"
        reasoning = ""

        if intent == "greeting":
            next_agent = "communication"
            conv_stage = "greeting"
            reasoning = "Greeting → respond directly."

        elif intent == "query_services":
            if last_routed_to in ("", "intent"):
                next_agent = "knowledge"
                reasoning = "Fetch service categories."
            else:
                next_agent = "communication"
                reasoning = "Services fetched → respond."

        elif intent == "service_request":
            pipeline = {
                "intent": "extraction",
                "extraction": "memory",
                "memory": "knowledge",
                "knowledge": "matching",
                "matching": "communication",
            }
            if last_routed_to in pipeline:
                next_agent = pipeline[last_routed_to]
                reasoning = f"service_request pipeline: {last_routed_to} → {next_agent}"
                if next_agent == "communication":
                    conv_stage = "selection"
            else:
                next_agent = "extraction"
                reasoning = "Starting service_request pipeline."

        elif intent == "provider_selection":
            selected = state.get("selected_provider", {}) or {}
            booking_ctx = state.get("booking_context", {}) or {}
            all_details = (
                bool(booking_ctx.get("requested_date"))
                and bool(booking_ctx.get("requested_time"))
                and bool(booking_ctx.get("offered_price"))
            )

            if selected and all_details:
                pipeline = {
                    "intent": "extraction",
                    "extraction": "negotiation",
                    "negotiation": "request_creation",
                    "request_creation": "communication",
                }
            else:
                pipeline = {"intent": "extraction", "extraction": "communication"}

            if last_routed_to in pipeline:
                next_agent = pipeline[last_routed_to]
                reasoning = f"provider_selection: {last_routed_to} → {next_agent}"
                if next_agent == "communication":
                    conv_stage = "awaiting_response" if last_routed_to in ("negotiation", "request_creation") else "selection"
            else:
                next_agent = "extraction"
                reasoning = "Extract selection inputs."

        elif intent == "booking_confirmation":
            selected = state.get("selected_provider", {}) or {}
            booking_ctx = state.get("booking_context", {}) or {}
            active_req_id = state.get("active_request_id") or state.get("booking_details", {}).get("request_id")
            all_details = (
                bool(booking_ctx.get("requested_date"))
                and bool(booking_ctx.get("requested_time"))
                and bool(booking_ctx.get("offered_price"))
            )

            if active_req_id:
                pipeline = {
                    "intent": "booking",
                    "booking": "scheduling",
                    "scheduling": "communication",
                }
                if last_routed_to in pipeline:
                    next_agent = pipeline[last_routed_to]
                    reasoning = f"booking pipeline: {last_routed_to} → {next_agent}"
                    if next_agent == "communication":
                        conv_stage = "completion"
                else:
                    next_agent = "booking"
                    reasoning = "Active request exists → finalize booking."

            elif selected and all_details:
                pipeline = {
                    "intent": "extraction",
                    "extraction": "negotiation",
                    "negotiation": "request_creation",
                    "request_creation": "communication",
                }
                if last_routed_to in pipeline:
                    next_agent = pipeline[last_routed_to]
                    reasoning = f"request creation pipeline: {last_routed_to} → {next_agent}"
                    if next_agent == "communication":
                        conv_stage = "awaiting_response"
                else:
                    next_agent = "extraction"
                    reasoning = "No active request — create first."
            else:
                pipeline = {"intent": "extraction", "extraction": "communication"}
                if last_routed_to in pipeline:
                    next_agent = pipeline[last_routed_to]
                    reasoning = f"Missing details: {last_routed_to} → {next_agent}"
                else:
                    next_agent = "extraction"
                    reasoning = "Missing booking details — extract and ask."

        elif intent == "check_status":
            if last_routed_to in ("", "intent"):
                next_agent = "negotiation"
                reasoning = "Status check → fetch live request."
            else:
                next_agent = "communication"
                reasoning = "Status synced → respond."

        else:
            next_agent = "communication"
            reasoning = f"General intent '{intent}'."

        # ── LOOP SAFETY GUARD ─────────────────────────────────────────
        turn_routed = list(state.get("turn_routed_agents", []) or [])
        if next_agent != "communication" and next_agent in turn_routed:
            print(f"[AUDIT] SupervisorAgent | Loop Guard Triggered | Forced Route: communication | Agent '{next_agent}' already executed")
            next_agent = "communication"
            reasoning = f"Loop safety: '{next_agent}' already executed this turn."
            conv_stage = "selection"

        # ── STATE MACHINE TRANSITION SAFETY GUARDS (Rule 4) ──
        if next_agent in ("booking", "scheduling") and not active_request_id:
            print(f"[SUPERVISOR STATE MACHINE GUARD] Blocked transition to '{next_agent}' because 'active_request_id' is missing. Forcing request_creation.")
            next_agent = "request_creation"
            reasoning = "Workflow safety: forced request_creation due to missing active_request_id."

        turn_routed = turn_routed + [next_agent]

        # Compute deterministic workflow_stage
        current_w_stage = state.get("workflow_stage", "discovery")
        new_w_stage = "discovery"

        has_shortlist = len(state.get("shortlisted_providers") or []) > 0
        has_selected = bool(state.get("selected_provider", {}).get("provider_supabase_id"))
        has_active_req = bool(active_request_id)
        active_req_status = state.get("latest_request_status")

        if has_active_req:
            if active_req_status in ("booked", "completed"):
                new_w_stage = "completed"
            elif active_req_status == "approved":
                new_w_stage = "provider_approved"
            elif active_req_status in ("pending", "counter_offer"):
                new_w_stage = "booking_created"  # or awaiting_provider
            else:
                new_w_stage = "booking_created"
        elif has_selected:
            booking_ctx = state.get("booking_context", {}) or {}
            all_details = (
                bool(booking_ctx.get("requested_date"))
                and bool(booking_ctx.get("requested_time"))
                and bool(booking_ctx.get("offered_price"))
            )
            if all_details:
                new_w_stage = "booking_pending"
            else:
                new_w_stage = "provider_selected"
        elif has_shortlist:
            new_w_stage = "shortlist"
        else:
            new_w_stage = "discovery"

        if has_failure or conv_stage == "failed" or conv_stage == "booking_failed":
            new_w_stage = "failed"

        if current_w_stage != new_w_stage:
            print(f"[SUPERVISOR STATE MACHINE] Transition: {current_w_stage} -> {new_w_stage}")

        db_sync_updates.update({
            "conversation_stage": conv_stage,
            "workflow_stage": new_w_stage,
        })

        print(f"[AUDIT] SupervisorAgent | Routing: {last_routed_to or 'start'} -> {next_agent} | Intent: {intent} | Stage: {conv_stage} | Reasoning: {reasoning}")

        return {
            "next_agent": next_agent,
            "active_agent": "supervisor",
            "conversation_stage": conv_stage,
            "workflow_stage": new_w_stage,
            "iteration_count": iteration,
            "turn_routed_agents": turn_routed,
            "execution_logs": [self.log_action(state, f"Routing to {next_agent}", reasoning)],
            "reasoning_traces": [self.create_trace(f"[iter {iteration}] intent={intent} last={last_routed_to} → {next_agent}")],
            **db_sync_updates,
        }


# ============================================================
# COMMUNICATION AGENT
# ============================================================
class CommunicationAgent(BaseAgent):
    def __init__(self, db=None):
        super().__init__("Frontier Agent", "Conversational UX Interface")
        self.db = db

    def run(self, state: AgentState) -> Dict[str, Any]:
        intent_obj = state.get("intent", {})
        intent = intent_obj.get("value") if isinstance(intent_obj, dict) else None
        stage = state.get("conversation_stage", "greeting")
        shortlist = state.get("shortlisted_providers", [])
        selected = state.get("selected_provider") or {}
        services = state.get("metadata", {}).get("available_services", [])
        summary = state.get("metadata", {}).get("session_summary", "")
        iteration = state.get("iteration_count", 0)
        booking_ctx = state.get("booking_context", {}) or {}
        booking_details = state.get("booking_details", {}) or {}

        # ── REQUEST CREATION VERIFICATION (provider_selection) ────────
        request_creation_success = state.get("request_creation_success")
        request_creation_error = state.get("request_creation_error")

        if intent == "provider_selection" and request_creation_success is True:
            active_request_id = state.get("active_request_id")
            verification_ok = False
            verification_error = ""

            if active_request_id and self.db is not None:
                from bson import ObjectId
                try:
                    refetched = self.db.active_requests.find_one({"_id": ObjectId(active_request_id)})
                    if refetched:
                        price_match = str(refetched.get("offered_price", "")) == str(booking_ctx.get("offered_price", ""))
                        date_match = refetched.get("requested_date") == booking_ctx.get("requested_date")
                        time_match = refetched.get("requested_time") == booking_ctx.get("requested_time")
                        if price_match and date_match and time_match:
                            verification_ok = True
                        else:
                            verification_error = (
                                f"Field mismatch. Price({refetched.get('offered_price')} vs {booking_ctx.get('offered_price')}), "
                                f"Date({refetched.get('requested_date')} vs {booking_ctx.get('requested_date')}), "
                                f"Time({refetched.get('requested_time')} vs {booking_ctx.get('requested_time')})"
                            )
                    else:
                        verification_error = "Active request document not found in MongoDB."
                except Exception as e:
                    verification_error = f"DB read exception: {e}"
            else:
                verification_error = "Missing active_request_id or DB connection."

            if not verification_ok:
                print(f"[AUDIT] CommunicationAgent | DB Verification FAILED | Error: {verification_error}")
                request_creation_success = False
                request_creation_error = f"Verification chain failed: {verification_error}"
            else:
                print(f"[AUDIT] CommunicationAgent | DB Verification SUCCESS | Request ID: {active_request_id}")

        # ── BOOKING OUTCOME VERIFICATION (booking_confirmation) ───────
        # This is the critical new block. For booking flows, we read
        # booking_outcome — the only authoritative DB-backed success signal.
        booking_outcome = state.get("booking_outcome") or {}
        booking_success_verified = booking_outcome.get("booking_success", False)
        booking_failure_reason = booking_outcome.get("booking_failure_reason", "")
        booking_id = booking_outcome.get("booking_id")

        # Build instruction block injected into the system prompt
        request_creation_instructions = ""
        if request_creation_success is True:
            request_creation_instructions = (
                "\nCRITICAL STATE: Active request SUCCESSFULLY saved and verified in MongoDB. "
                "Inform the user their request has been sent. State: 'Your request has been sent successfully.' "
                "Include confirmed schedule and price details."
            )
        elif request_creation_success is False:
            request_creation_instructions = (
                f"\nCRITICAL STATE: Request creation FAILED. Reason: {request_creation_error}. "
                "Tell the user EXACTLY: 'I encountered an issue while creating your request. Please try again.' "
                "Do NOT claim success, do NOT say the provider was notified."
            )

        # Booking outcome instructions — injected only for booking_confirmation flows
        booking_outcome_instructions = ""
        if intent == "booking_confirmation" or stage in ("completion", "booking_failed"):
            if booking_success_verified and booking_id:
                # DB write confirmed — allow success message
                booking_outcome_instructions = (
                    f"\nCRITICAL STATE: Booking CONFIRMED in MongoDB (booking_id: {booking_id}). "
                    "DB write verified. You are authorised to tell the user their booking is confirmed. "
                    "State clearly: 'Your booking has been confirmed!' with the schedule details."
                )
            elif stage == "booking_failed" or (intent == "booking_confirmation" and not booking_success_verified and booking_outcome):
                # Booking pipeline ran but failed — hard error message
                booking_outcome_instructions = (
                    f"\nCRITICAL STATE: Booking FAILED. Reason: {booking_failure_reason or 'Unknown error'}. "
                    "You MUST tell the user there was a problem completing their booking. "
                    "Say: 'I was unable to confirm your booking at this time. Please try again or contact support.' "
                    "Do NOT say the booking is confirmed. Do NOT say the provider was notified."
                )

        retrieval_instructions = ""
        if state.get("retrieval_confidence") in ("LOW", "NONE"):
            retrieval_instructions = (
                f"\nCRITICAL STATE: Search confidence is {state.get('retrieval_confidence')}. "
                "Ask the user to clarify their request. Do NOT say no providers were found."
            )

        system_prompt = f"""You are the Frontier Agent of Flowtica AI — a professional, helpful service marketplace assistant.

CONVERSATION CONTEXT:
- Current Intent: {intent}
- Conversation Stage: {stage}
- Session Summary: {summary}
- Iteration: {iteration}
{request_creation_instructions}{booking_outcome_instructions}{retrieval_instructions}

AVAILABLE DATA:
- Available Services: {services}
- Shortlisted Providers: {json.dumps(shortlist, default=str)}
- Selected Provider: {json.dumps(selected, default=str)}
- Booking Context: {json.dumps(booking_ctx, default=str)}
- Booking Details: {json.dumps(booking_details, default=str)}
- Entities: {json.dumps(state.get('entities', {}), default=str)}

ABSOLUTE RULES — NEVER VIOLATE:
1. You MUST NOT say "request sent", "booking confirmed", "provider notified", or any success phrase
   UNLESS the CRITICAL STATE block above explicitly says DB write was verified and authorises it.
2. If CRITICAL STATE says FAILED, always respond with a clear error message. No exceptions.
3. If no CRITICAL STATE booking instruction is present, do NOT assume booking success or failure.
   Respond based on the conversation stage and available data only.
4. Always respond in the same language as the user's latest message.
5. If shortlisted_providers exist, format each as:
   Provider: [Name] | Service: [Service] | Price: [Rate] [Currency]
6. For status 'pending': tell user request is awaiting provider review.
   For 'counter_offer': show counter details and ask if user accepts.
   For 'approved': confirm provider approved, ask to finalise booking.
   For 'denied': apologise, suggest alternatives.
   For 'booked'/'confirmed': confirm booking is finalised."""

        messages_in_state = state.get("messages", [])
        llm_messages = [SystemMessage(content=system_prompt)] + list(messages_in_state)

        print(f"[COMMUNICATION] Stage:{stage} Intent:{intent} Providers:{len(shortlist)} BookingSuccess:{booking_success_verified}")
        response = self.llm.invoke(llm_messages)
        response_text = response.content

        # ── HARD FALLBACK OVERRIDES ───────────────────────────────────
        # These run after LLM generation as a last-resort safety net.

        # Override 1: request creation failed
        if request_creation_success is False:
            print("[COMMUNICATION] Hard override: request creation failure.")
            response_text = "I encountered an issue while creating your request. Please try again."

        # Override 2: booking pipeline failed
        if (
            (intent == "booking_confirmation" or stage == "booking_failed")
            and booking_outcome  # booking agent ran this turn
            and not booking_success_verified
        ):
            print("[COMMUNICATION] Hard override: booking failure — suppressing any success language.")
            failure_msg = booking_failure_reason or "An unexpected error occurred."
            response_text = (
                f"I was unable to confirm your booking at this time. "
                f"Reason: {failure_msg}. Please try again or contact support."
            )

        log = self.log_action(state, "Generated response", f"Stage:{stage} Intent:{intent} iter:{iteration}")
        trace = self.create_trace(f"Response with {len(messages_in_state)} history messages. BookingOutcome: {booking_outcome}")

        return_payload = {
            "messages": [AIMessage(content=response_text)],
            "frontier_response": response_text,
            "active_agent": "communication",
            "execution_logs": [log],
            "reasoning_traces": [trace],
            "is_complete": (
                intent in ("booking_confirmation", "provider_selection")
                and bool(booking_details.get("request_id") or state.get("active_request_id"))
            ),
        }

        # Persist verification failure into state
        if intent == "provider_selection" and state.get("request_creation_success") is True and request_creation_success is False:
            return_payload.update({
                "request_creation_success": False,
                "request_creation_error": request_creation_error,
            })

        return return_payload