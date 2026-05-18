from agents.base import BaseAgent
from core.state import AgentState
from typing import Dict, Any, List
from langchain_core.messages import AIMessage, SystemMessage
import json

# ============================================================
# SUPERVISOR AGENT — Deterministic State Machine Router
# ============================================================
class SupervisorAgent(BaseAgent):
    def __init__(self):
        super().__init__("Supervisor", "Stage-Aware Orchestrator")

    def run(self, state: AgentState) -> Dict[str, Any]:
        intent_obj = state.get("intent", {})
        intent = intent_obj.get("value") if isinstance(intent_obj, dict) else None
        
        # KEY FIX: Use 'next_agent' (set by previous supervisor call) as "what just completed"
        # This is the ONLY correct way — active_agent is overwritten by supervisor itself
        last_routed_to = state.get("next_agent", "")
        
        conv_stage = state.get("conversation_stage", "greeting")
        is_resumed = state.get("metadata", {}).get("is_resumed", False)
        iteration = state.get("iteration_count", 0) + 1

        # LOOP PROTECTION: Hard limit of 12 steps per turn
        if iteration > 12:
            print(f"[SUPERVISOR] [WARN] LOOP GUARD TRIGGERED at iteration {iteration}. Forcing communication.")
            return {
                "next_agent": "communication",
                "active_agent": "supervisor",
                "iteration_count": iteration,
                "execution_logs": [self.log_action(state, "Loop guard activated", f"Forced END after {iteration} iterations")],
                "reasoning_traces": [self.create_trace("Safety guard: max iterations reached, routing to communication.")]
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
            return {
                "next_agent": next_agent,
                "active_agent": "supervisor",
                "iteration_count": iteration,
                "execution_logs": [log],
                "reasoning_traces": [trace]
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
            # Deterministic pipeline: intent -> extraction -> memory -> knowledge -> matching -> communication
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
                # First call after intent classified (last_routed_to="intent" already handled above)
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
                    # ✅ Only move to scheduling stage if negotiation actually ran
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
            # Set up the sequential pipeline: booking -> scheduling -> communication
            pipeline = {
                "intent": "booking",
                "booking": "scheduling",
                "scheduling": "communication"
            }
            if last_routed_to in pipeline:
                next_agent = pipeline[last_routed_to]
                reasoning = f"Booking confirmation pipeline: {last_routed_to} -> {next_agent}"
                if next_agent == "communication":
                    conv_stage = "awaiting_response"
            else:
                next_agent = "booking"
                reasoning = "Booking confirmation triggered. Route to booking agent to create the database request."

        elif intent == "check_status":
            if last_routed_to in ("", "intent"):
                next_agent = "negotiation"
                reasoning = "Real-time request status check -> fetch live request from MongoDB."
            else:
                next_agent = "communication"
                reasoning = "Status sync completed -> route to communication to respond."

        else:
            # General/fallback -> respond directly
            next_agent = "communication"
            reasoning = f"General intent '{intent}' -> communicate."

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
            "execution_logs": [log],
            "reasoning_traces": [trace]
        }


# ============================================================
# COMMUNICATION AGENT — Frontier UX Agent
# ============================================================
class CommunicationAgent(BaseAgent):
    def __init__(self):
        super().__init__("Frontier Agent", "Conversational UX Interface")

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

        system_prompt = f"""You are the Frontier Agent of Flowtica AI — a professional, helpful service marketplace assistant.

CONVERSATION CONTEXT:
- Current Intent: {intent}
- Conversation Stage: {stage}
- Session Summary (if resumed): {summary}
- Iteration: {iteration}{request_creation_instructions}

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

        return {
            "messages": [AIMessage(content=response_text)],
            "frontier_response": response_text,
            "active_agent": "communication",
            "execution_logs": [log],
            "reasoning_traces": [trace],
            "is_complete": intent in ("booking_confirmation", "provider_selection") and bool(booking_details.get("request_id") or state.get("active_request_id"))
        }
