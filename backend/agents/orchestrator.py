from agents.base import BaseAgent
from core.state import AgentState
from typing import Dict, Any, List
from langchain_core.messages import AIMessage, SystemMessage
import json

# ============================================================
# SUPERVISOR AGENT — Deterministic State Machine Router
# ============================================================
class SupervisorAgent(BaseAgent):
    def __init__(self, db=None):
        super().__init__("Supervisor", "Stage-Aware Orchestrator")
        self.db = db

    def run(self, state: AgentState) -> Dict[str, Any]:
        # REAL-TIME DB STATE SYNCHRONIZATION (PART 2 & 7)
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
                    print(f"[SUPERVISOR SYNC WARNING] Failed to find active request by ID {active_request_id}: {e}")
            
            if not real_request and conversation_id:
                real_request = self.db.active_requests.find_one({"conversation_id": conversation_id})
                if real_request:
                    active_request_id = str(real_request["_id"])
                    
            if not real_request and customer_supabase_id and customer_supabase_id != "anonymous":
                real_request = self.db.active_requests.find_one({
                    "customer_supabase_id": customer_supabase_id,
                    "status": {"$ne": "booked"}
                })
                if real_request:
                    active_request_id = str(real_request["_id"])
            
            if real_request:
                db_status = real_request.get("status", "pending")
                print(f"[SUPERVISOR SYNC] Found active request {active_request_id} in DB. Syncing status '{db_status}'.")
                
                negotiation_data = state.get("negotiation", {}) or {}
                booking_data = state.get("booking", {}) or {}
                
                updated_negotiation = {
                    **negotiation_data,
                    "negotiation_stage": db_status,
                    "negotiation_status": db_status,
                    "latest_request_status": db_status
                }
                
                updated_booking = {
                    **booking_data,
                    "active_request_id": active_request_id,
                    "active_request": real_request,
                    "latest_request_status": db_status,
                }
                
                db_sync_updates.update({
                    "active_request_id": active_request_id,
                    "latest_request_status": db_status,
                    "negotiation_stage": db_status,
                    "negotiation_status": db_status,
                    "active_request": real_request,
                    "negotiation": updated_negotiation,
                    "booking": updated_booking
                })
                
                booking_details = state.get("booking_details", {}) or {}
                if booking_details.get("status") != db_status or booking_details.get("request_id") != active_request_id:
                    updated_booking_details = {
                        **booking_details,
                        "request_id": active_request_id,
                        "status": db_status,
                        "offered_price": real_request.get("offered_price"),
                        "requested_date": real_request.get("requested_date"),
                        "requested_time": real_request.get("requested_time")
                    }
                    db_sync_updates["booking_details"] = updated_booking_details
            else:
                if active_request_id or state.get("booking_details", {}).get("request_id"):
                    print("[SUPERVISOR SYNC] Active request not found in DB! Clearing stale request cache.")
                    db_sync_updates.update({
                        "active_request_id": "",
                        "latest_request_status": "",
                        "negotiation_stage": "",
                        "negotiation_status": "",
                        "active_request": {},
                        "booking_details": {},
                        "booking": {
                            **(state.get("booking", {}) or {}),
                            "active_request_id": "",
                            "active_request": {},
                            "latest_request_status": ""
                        },
                        "negotiation": {
                            **(state.get("negotiation", {}) or {}),
                            "negotiation_stage": "",
                            "negotiation_status": "",
                            "latest_request_status": ""
                        }
                    })
        
        # Merge db_sync_updates into local state copy for routing decisions
        for k, v in db_sync_updates.items():
            state[k] = v

        intent_obj = state.get("intent", {})
        intent = intent_obj.get("value") if isinstance(intent_obj, dict) else None
        
        last_routed_to = state.get("next_agent", "")
        conv_stage = state.get("conversation_stage", "greeting")
        is_resumed = state.get("metadata", {}).get("is_resumed", False)
        iteration = state.get("iteration_count", 0) + 1

        # LOOP PROTECTION: Hard limit of 12 steps per turn (Supervisor level)
        if iteration > 12:
            print(f"[SUPERVISOR] [WARN] LOOP GUARD TRIGGERED at iteration {iteration}. Forcing communication.")
            return {
                "next_agent": "communication",
                "active_agent": "supervisor",
                "iteration_count": iteration,
                "execution_logs": [self.log_action(state, "Loop guard activated", f"Forced END after {iteration} iterations")],
                "reasoning_traces": [self.create_trace("Safety guard: max iterations reached, routing to communication.")],
                **db_sync_updates
            }

        print(f"\n==================================================")
        print(f"[SUPERVISOR DIAGNOSTIC] Step Iteration: {iteration}")
        print(f"[SUPERVISOR DIAGNOSTIC] Active Intent: {intent}")
        print(f"[SUPERVISOR DIAGNOSTIC] Last Completed Agent: '{last_routed_to}'")
        print(f"[SUPERVISOR DIAGNOSTIC] Conversation Stage: {conv_stage}")
        print(f"==================================================")

        next_agent = "communication"
        reasoning = ""

        # === STEP 1: No intent yet -> Run intent agent ===
        if not intent:
            if is_resumed and not last_routed_to:
                next_agent = "memory"
                reasoning = "Resumed session - restore context first."
            else:
                next_agent = "intent"
                reasoning = "No intent classified yet - routing to IntentAgent."
            
            log = self.log_action(state, f"Routing to {next_agent}", reasoning)
            trace = self.create_trace(f"[iter {iteration}] No intent -> {next_agent}")
            
            # Record routed history
            turn_routed_agents = state.get("turn_routed_agents", []) or []
            new_routed_agents = list(turn_routed_agents) + [next_agent]
            
            return {
                "next_agent": next_agent,
                "active_agent": "supervisor",
                "iteration_count": iteration,
                "turn_routed_agents": new_routed_agents,
                "execution_logs": [log],
                "reasoning_traces": [trace],
                **db_sync_updates
            }

        # === STEP 2: Deterministic routing based on intent + last completed step ===
        if intent == "greeting":
            next_agent = "communication"
            conv_stage = "greeting"
            reasoning = "Greeting -> respond directly."

        elif intent == "query_services":
            if last_routed_to in ("", "intent"):
                next_agent = "knowledge"
                reasoning = "Fetch available service categories."
            else:
                next_agent = "communication"
                reasoning = "Services fetched, respond to user."

        elif intent == "service_request":
            pipeline = {
                "intent":     "extraction",
                "extraction": "memory",
                "memory":     "knowledge",
                "knowledge":  "matching",
                "matching":   "communication",
            }
            if last_routed_to in pipeline:
                next_agent = pipeline[last_routed_to]
                reasoning = f"Pipeline step: {last_routed_to} done -> {next_agent}"
                if next_agent == "communication":
                    conv_stage = "selection"
            else:
                next_agent = "extraction"
                reasoning = "Starting service_request pipeline from extraction."

        elif intent == "provider_selection":
            selected = state.get("selected_provider", {}) or {}
            booking_ctx = state.get("booking_context", {}) or {}
            has_date = bool(booking_ctx.get("requested_date"))
            has_time = bool(booking_ctx.get("requested_time"))
            has_price = bool(booking_ctx.get("offered_price"))
            all_details_present = has_date and has_time and has_price

            print(f"[SUPERVISOR] provider_selection check: selected={selected.get('name','NONE')}, price={has_price}, date={has_date}, time={has_time}", flush=True)

            if selected and all_details_present:
                pipeline = {
                    "intent":      "extraction",
                    "extraction":  "negotiation",
                    "negotiation": "request_creation",
                    "request_creation": "communication"
                }
            elif selected and not all_details_present:
                pipeline = {
                    "intent":     "extraction",
                    "extraction": "communication"
                }
            else:
                pipeline = {
                    "intent":     "extraction",
                    "extraction": "communication"
                }

            if last_routed_to in pipeline:
                next_agent = pipeline[last_routed_to]
                reasoning = f"Provider selection pipeline: {last_routed_to} -> {next_agent}"

                if last_routed_to == "extraction" and not state.get("selected_provider"):
                    next_agent = "communication"
                    reasoning = "No provider in state after extraction — ask user to clarify."
                elif next_agent == "communication":
                    if last_routed_to in ("negotiation", "request_creation"):
                        conv_stage = "awaiting_response"
                    elif state.get("selected_provider"):
                        conv_stage = "scheduling"
                    else:
                        conv_stage = "selection"
            else:
                next_agent = "extraction"
                reasoning = "Extract selection/negotiation inputs from user message."

        elif intent == "booking_confirmation":
            selected = state.get("selected_provider", {}) or {}
            booking_ctx = state.get("booking_context", {}) or {}
            active_request_id = state.get("active_request_id") or state.get("booking_details", {}).get("request_id")

            has_date = bool(booking_ctx.get("requested_date"))
            has_time = bool(booking_ctx.get("requested_time"))
            has_price = bool(booking_ctx.get("offered_price"))
            all_details = has_date and has_time and has_price

            print(f"[SUPERVISOR] booking_confirmation: active_request_id={active_request_id}, selected={selected.get('name','NONE')}, all_details={all_details}", flush=True)

            # CASE 1: Request already created → finalize booking
            if active_request_id:
                pipeline = {
                    "intent":     "booking",
                    "booking":    "scheduling",
                    "scheduling": "communication"
                }
                if last_routed_to in pipeline:
                    next_agent = pipeline[last_routed_to]
                    reasoning = f"Booking pipeline: {last_routed_to} → {next_agent}"
                    if next_agent == "communication":
                        conv_stage = "completion"
                else:
                    next_agent = "booking"
                    reasoning = "Active request exists → finalize booking."

            # CASE 2: No request yet but provider + details present → create request first
            elif selected and all_details:
                pipeline = {
                    "intent":           "extraction",
                    "extraction":       "negotiation",
                    "negotiation":      "request_creation",
                    "request_creation": "communication"
                }
                if last_routed_to in pipeline:
                    next_agent = pipeline[last_routed_to]
                    reasoning = f"Request creation pipeline: {last_routed_to} → {next_agent}"
                    if next_agent == "communication":
                        conv_stage = "awaiting_response"
                else:
                    next_agent = "extraction"
                    reasoning = "No active request — create it first via negotiation + request_creation."

            # CASE 3: Missing info → ask user
            else:
                pipeline = {
                    "intent":     "extraction",
                    "extraction": "communication"
                }
                if last_routed_to in pipeline:
                    next_agent = pipeline[last_routed_to]
                    reasoning = f"Missing details: {last_routed_to} → {next_agent}"
                else:
                    next_agent = "extraction"
                    reasoning = "Missing booking details — extract and ask user."

        elif intent == "check_status":
            if last_routed_to in ("", "intent"):
                next_agent = "negotiation"
                reasoning = "Real-time request status check -> fetch live request from MongoDB."
            else:
                next_agent = "communication"
                reasoning = "Status sync completed -> route to communication to respond."

        else:
            next_agent = "communication"
            reasoning = f"General intent '{intent}' -> communicate."

        # LOOP SAFETY GUARD (PART 10)
        turn_routed_agents = state.get("turn_routed_agents", []) or []
        if next_agent != "communication" and next_agent in turn_routed_agents:
            print(f"[SUPERVISOR] Loop safety guard triggered! Agent '{next_agent}' has already run in this turn. Forcing communication.")
            next_agent = "communication"
            reasoning = f"Safety loop guard: Forcing routing to communication because '{next_agent}' was already executed in this turn."
            conv_stage = "selection"

        new_routed_agents = list(turn_routed_agents) + [next_agent]

        log = self.log_action(state, f"Routing to {next_agent}", reasoning)
        trace = self.create_trace(f"[iter {iteration}] Intent={intent}, Last={last_routed_to} -> {next_agent}")
        print(f"[SUPERVISOR DIAGNOSTIC] -> SUCCESSFUL ROUTING DECISION: Routing next to '{next_agent}'")
        print(f"[SUPERVISOR DIAGNOSTIC] Reason: {reasoning}")
        print(f"==================================================\n")

        return {
            "next_agent": next_agent,
            "active_agent": "supervisor",
            "conversation_stage": conv_stage,
            "iteration_count": iteration,
            "turn_routed_agents": new_routed_agents,
            "execution_logs": [log],
            "reasoning_traces": [trace],
            **db_sync_updates
        }



# ============================================================
# COMMUNICATION AGENT — Frontier UX Agent
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

        # Read transactional request creation status
        request_creation_success = state.get("request_creation_success")
        request_creation_error = state.get("request_creation_error")

        # PART 5: LIVE VERIFICATION CHAIN (DB Verification Chain)
        verification_ok = True
        verification_error = ""
        if intent == "provider_selection" and request_creation_success is True:
            active_request_id = state.get("active_request_id")
            verification_ok = False
            
            if active_request_id and self.db is not None:
                from bson import ObjectId
                try:
                    refetched = self.db.active_requests.find_one({"_id": ObjectId(active_request_id)})
                    if refetched:
                        refetched_price = refetched.get("offered_price")
                        refetched_date = refetched.get("requested_date")
                        refetched_time = refetched.get("requested_time")
                        
                        expected_price = booking_ctx.get("offered_price")
                        expected_date = booking_ctx.get("requested_date")
                        expected_time = booking_ctx.get("requested_time")
                        
                        price_match = str(refetched_price) == str(expected_price) if refetched_price and expected_price else True
                        date_match = refetched_date == expected_date
                        time_match = refetched_time == expected_time
                        
                        if price_match and date_match and time_match:
                            verification_ok = True
                            print(f"[COMMUNICATION VERIFICATION] Verification chain succeeded for request {active_request_id}")
                        else:
                            verification_error = f"Fields mismatch. Refetched vs Expected: Price ({refetched_price} vs {expected_price}), Date ({refetched_date} vs {expected_date}), Time ({refetched_time} vs {expected_time})"
                            print(f"[COMMUNICATION VERIFICATION ERROR] {verification_error}")
                    else:
                        verification_error = "Active request document not found in MongoDB."
                        print(f"[COMMUNICATION VERIFICATION ERROR] {verification_error}")
                except Exception as e:
                    verification_error = f"Database read exception: {str(e)}"
                    print(f"[COMMUNICATION VERIFICATION ERROR] {verification_error}")
            else:
                verification_error = "Missing active_request_id or database connection."
                print(f"[COMMUNICATION VERIFICATION ERROR] {verification_error}")
            
            if not verification_ok:
                print("[COMMUNICATION VERIFICATION ERROR] Verification chain failed! Overriding success to failure.")
                request_creation_success = False
                request_creation_error = f"Verification chain failed: {verification_error}"

        request_creation_instructions = ""
        if request_creation_success is True:
            request_creation_instructions = (
                "\nCRITICAL STATE UPDATE: The active request has been successfully saved to MongoDB and verified. "
                "You MUST inform the user clearly that their request has been sent successfully. Make sure to state: "
                "'Your request has been sent successfully.' and display the confirmed schedule and price details."
            )
        elif request_creation_success is False:
            request_creation_instructions = (
                f"\nCRITICAL STATE UPDATE: Active request creation has FAILED. Reason: {request_creation_error}. "
                "You MUST inform the user exactly: 'I encountered an issue while creating your request. Please try again.' "
                "Do NOT under any circumstances claim success, state that the request was sent, or say the provider was notified."
            )

        retrieval_confidence = state.get("retrieval_confidence")
        retrieval_instructions = ""
        if retrieval_confidence in ["LOW", "NONE"]:
            retrieval_instructions = (
                f"\nCRITICAL STATE UPDATE: The latest search for providers yielded {retrieval_confidence} confidence. "
                "You MUST ask the user to clarify their request or provide more details. DO NOT say 'No providers found' or tell them we don't have the service. "
                "Instead, say something like 'Could you please provide more details about the exact service you need?' or 'I want to make sure I find the perfect match, could you be a bit more specific?'"
            )

        system_prompt = f"""You are the Frontier Agent of Flowtica AI — a professional, helpful service marketplace assistant.

CONVERSATION CONTEXT:
- Current Intent: {intent}
- Conversation Stage: {stage}
- Session Summary (if resumed): {summary}
- Iteration: {iteration}{request_creation_instructions}{retrieval_instructions}

AVAILABLE DATA:
- Available Services: {services}
- Shortlisted Providers: {json.dumps(shortlist, default=str)}
- Selected Provider: {json.dumps(selected, default=str)}
- Booking Context: {json.dumps(booking_ctx, default=str)}
- Booking Details (Output from Booking Agent): {json.dumps(booking_details, default=str)}
- Entities: {json.dumps(state.get('entities', {}), default=str)}

RESPONSE RULES:
1. LANGUAGE: Always respond in the SAME language as the user's latest message.
2. FIRST GREETING: Only say "Welcome to Flowtica AI!" on first message (stage='greeting', no history).
3. CONTEXT: Read full conversation history and respond to what user ACTUALLY said.
4. SERVICE REQUESTS: If user asked for a service, mention that specific service.
5. PROVIDERS: If shortlisted_providers exist, present them clearly numbered. You MUST format each recommendation exactly in this style:
   Provider: [Name]
   Service: [Service Name]
   Specialization: [Specialization]
   Price: [Rate] (with currency like PKR or USD)
6. SELECTION, NEGOTIATION & STATUS SYNC FLOWS:
   - If the user selects a provider (e.g. "I go with option 2", "select Provider 1"), acknowledge it: "Great! You have selected [Provider Name] for [Service Type]."
   - If ANY negotiation fields (offered_price, requested_date, requested_time) are missing, guide the customer to specify them clearly: "To submit this request, please specify: Offered Price (e.g. $25/hr), Preferred Date, and Time preference."
   - If a request is submitted and the request status (found in booking_details.status or latest_request_status) is:
     * "pending":
       Respond exactly that the request is sent and is awaiting provider review:
       "Awesome! Your service request has been sent to [Provider Name]. I will notify you as soon as they respond.
       
       Status: Pending Provider Response.
       Next step: Waiting for provider.
       Booking Agent has initialized the tracking record.
       Orchestrator Stage: Awaiting Provider Approval.
       Negotiation: Open.
       
       Target booking details:
       - Provider: [Provider Name]
       - Offered Price: [Offered Price]
       - Schedule: [Requested Date] [Requested Time]"
     * "counter_offer":
       Acknowledge the provider's proposed counter-offer clearly. Inform the user in this exact style:
       "[Provider Name] has proposed an updated offer:
       Price: $[Price]/hr (or [Price])
       Time: [Date], [Time]
       
       Would you like to accept this updated offer?"
     * "approved":
       Inform the customer that the provider has approved their request in this exact style:
       "Your request has been approved by [Provider Name]. Would you like me to finalize the booking?"
     * "denied":
       Apologize to the customer, state that the request was declined, recommend alternative providers from the shortlist (if any), and state that you are clearing the active negotiation state.
     * "booked" or "confirmed":
       Confirm to the customer that the service is successfully booked and confirmed.
       7. Be concise, warm, and professional. Avoid markdown formatting inside list items if it blocks layout readability.
       8. STALE CACHE AWARENESS: Always refer to the live status shown in booking_details and ignore older history states if they contradict. Ensure the user gets the real-time truth."""

        # Pass full conversation history to LLM
        messages_in_state = state.get("messages", [])
        llm_messages = [SystemMessage(content=system_prompt)] + list(messages_in_state)

        print(f"[COMMUNICATION] Generating response | Stage: {stage} | Intent: {intent} | Providers: {len(shortlist)}")
        response = self.llm.invoke(llm_messages)

        response_text = response.content

        # HARD Fallback override to absolutely guarantee zero lying to users:
        if request_creation_success is False:
            print("[COMMUNICATION WARNING] Hard fallback triggered due to verified request creation failure.")
            response_text = "I encountered an issue while creating your request. Please try again."

        log = self.log_action(state, "Generated response", f"Stage: {stage}, Intent: {intent}, iter: {iteration}")
        trace = self.create_trace(f"Response crafted with {len(messages_in_state)} history messages.")

        return_payload = {
            "messages": [AIMessage(content=response_text)],
            "frontier_response": response_text,
            "active_agent": "communication",
            "execution_logs": [log],
            "reasoning_traces": [trace],
            "is_complete": intent in ("booking_confirmation", "provider_selection") and bool(booking_details.get("request_id") or state.get("active_request_id"))
        }

        # If verification failed, persist that to state
        if intent == "provider_selection" and state.get("request_creation_success") is True and not verification_ok:
            return_payload.update({
                "request_creation_success": False,
                "request_creation_error": request_creation_error,
                "booking": {
                    **(state.get("booking", {}) or {}),
                    "request_creation_success": False,
                    "request_creation_error": request_creation_error
                }
            })

        return return_payload

