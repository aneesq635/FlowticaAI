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
            print(f"[SUPERVISOR] ⚠️  LOOP GUARD TRIGGERED at iteration {iteration}. Forcing communication.")
            return {
                "next_agent": "communication",
                "active_agent": "supervisor",
                "iteration_count": iteration,
                "execution_logs": [self.log_action(state, "Loop guard activated", f"Forced END after {iteration} iterations")],
                "reasoning_traces": [self.create_trace("Safety guard: max iterations reached, routing to communication.")]
            }

        print(f"[SUPERVISOR] Iteration: {iteration} | Intent: {intent} | Last routed to: '{last_routed_to}' | Stage: {conv_stage}")

        next_agent = "communication"
        reasoning = ""

        # ── STEP 1: No intent yet → Run intent agent ──────────────────
        if not intent:
            if is_resumed and not last_routed_to:
                next_agent = "memory"
                reasoning = "Resumed session — restore context first."
            else:
                next_agent = "intent"
                reasoning = "No intent classified yet — routing to IntentAgent."
            
            log = self.log_action(state, f"Routing to {next_agent}", reasoning)
            trace = self.create_trace(f"[iter {iteration}] No intent → {next_agent}")
            return {
                "next_agent": next_agent,
                "active_agent": "supervisor",
                "iteration_count": iteration,
                "execution_logs": [log],
                "reasoning_traces": [trace]
            }

        # ── STEP 2: Deterministic routing based on intent + last completed step ──

        if intent == "greeting":
            next_agent = "communication"
            conv_stage = "greeting"
            reasoning = "Greeting → respond directly."

        elif intent == "query_services":
            if last_routed_to in ("", "intent"):
                next_agent = "knowledge"
                reasoning = "Fetch available service categories."
            else:
                next_agent = "communication"
                reasoning = "Services fetched, respond to user."

        elif intent == "service_request":
            # Deterministic pipeline: intent → extraction → memory → knowledge → matching → communication
            pipeline = {
                "intent":     "extraction",
                "extraction": "memory",
                "memory":     "knowledge",
                "knowledge":  "matching",
                "matching":   "communication",
            }
            if last_routed_to in pipeline:
                next_agent = pipeline[last_routed_to]
                reasoning = f"Pipeline step: {last_routed_to} done → {next_agent}"
                if next_agent == "communication":
                    conv_stage = "selection"
            else:
                # First call after intent classified (last_routed_to="intent" already handled above)
                next_agent = "extraction"
                reasoning = "Starting service_request pipeline from extraction."

        elif intent == "provider_selection":
            pipeline = {
                "intent":     "extraction",
                "extraction": "booking",   # Skip to booking if provider selected
                "booking":    "communication",
            }
            if last_routed_to in pipeline:
                next_agent = pipeline[last_routed_to]
                reasoning = f"Provider selection pipeline: {last_routed_to} → {next_agent}"
                # If extraction done but no provider selected, ask user
                if last_routed_to == "extraction" and not state.get("selected_provider"):
                    next_agent = "communication"
                    reasoning = "No provider selected yet — ask user to clarify."
                elif next_agent == "communication":
                    conv_stage = "scheduling"
            else:
                next_agent = "extraction"
                reasoning = "Extract which provider user selected."

        elif intent == "booking_confirmation":
            if last_routed_to == "intent":
                next_agent = "scheduling"
            else:
                next_agent = "communication"
                conv_stage = "completion"
            reasoning = "Booking confirmation → scheduling."

        else:
            # General/fallback → respond directly
            next_agent = "communication"
            reasoning = f"General intent '{intent}' → communicate."

        log = self.log_action(state, f"Routing to {next_agent}", reasoning)
        trace = self.create_trace(f"[iter {iteration}] Intent={intent}, Last={last_routed_to} → {next_agent}")
        print(f"[SUPERVISOR] → Routing to: {next_agent}")

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

        system_prompt = f"""You are the Frontier Agent of Agentra AI — a professional, helpful service marketplace assistant.

CONVERSATION CONTEXT:
- Current Intent: {intent}
- Conversation Stage: {stage}
- Session Summary (if resumed): {summary}
- Iteration: {iteration}

AVAILABLE DATA:
- Available Services: {services}
- Shortlisted Providers: {json.dumps(shortlist, default=str)}
- Selected Provider: {json.dumps(selected, default=str)}
- Entities: {json.dumps(state.get('entities', {}), default=str)}

RESPONSE RULES:
1. LANGUAGE: Always respond in the SAME language as the user's latest message.
2. FIRST GREETING: Only say "Welcome to Agentra AI!" on first message (stage='greeting', no history).
3. CONTEXT: Read full conversation history and respond to what user ACTUALLY said.
4. SERVICE REQUESTS: If user asked for a service, mention that specific service.
5. PROVIDERS: If shortlisted_providers exist, present them clearly numbered.
6. SELECTION: If user selected a provider, confirm and ask for booking details.
7. Be concise, warm, and professional."""

        # Pass full conversation history to LLM
        messages_in_state = state.get("messages", [])
        llm_messages = [SystemMessage(content=system_prompt)] + list(messages_in_state)

        print(f"[COMMUNICATION] Generating response | Stage: {stage} | Intent: {intent} | Providers: {len(shortlist)}")
        response = self.llm.invoke(llm_messages)

        log = self.log_action(state, "Generated response", f"Stage: {stage}, Intent: {intent}, iter: {iteration}")
        trace = self.create_trace(f"Response crafted with {len(messages_in_state)} history messages.")

        return {
            "messages": [AIMessage(content=response.content)],
            "frontier_response": response.content,
            "active_agent": "communication",
            "execution_logs": [log],
            "reasoning_traces": [trace],
            "is_complete": intent == "booking_confirmation"
        }
