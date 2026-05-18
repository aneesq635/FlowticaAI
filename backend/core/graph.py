from langgraph.graph import StateGraph, END
from core.state import AgentState
from core.logger import logger
from agents.orchestrator import SupervisorAgent, CommunicationAgent
from agents.service_agents import (
    IntentAgent, ExtractionAgent, MemoryAgent, 
    KnowledgeAgent, MatchingAgent, BookingAgent, SchedulingAgent, NegotiationAgent,
    RequestCreationAgent
)
from pymongo import MongoClient
import os

# Initialize DB for agents
client = MongoClient(os.getenv("MONGODB_URI"))
db = client["flowtica"]

# Instantiate Agents
supervisor = SupervisorAgent(db)
communication = CommunicationAgent(db)
intent_agent = IntentAgent()
extraction_agent = ExtractionAgent()
memory_agent = MemoryAgent(db)
knowledge_agent = KnowledgeAgent(db)
matching_agent = MatchingAgent()
booking_agent = BookingAgent(db)
negotiation_agent = NegotiationAgent(db)
request_creation_agent = RequestCreationAgent(db)
scheduling_agent = SchedulingAgent(db)

def make_safe_node(node_name, node_func):
    """
    Wraps LangGraph workflow nodes to safely intercept exceptions, print
    tracebacks, log diagnostics, and enforce a strict loop step count guard.
    """
    def safe_node_run(state: AgentState):
        from core.logger import safe_text
        print(f"\n[DIAGNOSTIC] >>> ENTERING NODE: {node_name}")
        
        # Guard: Ensure iteration count tracks turn-specific loop bounds
        iteration = state.get("iteration_count", 0) + 1
        
        # strict loop guard: MAX_GRAPH_STEPS = 25
        if iteration > 25:
            print(f"[DIAGNOSTIC] [WARN] MAX_GRAPH_STEPS safety guard triggered at iteration {iteration} on node '{node_name}'!")
            raise RuntimeError(f"MAX_GRAPH_STEPS safety guard triggered (limit 25) to prevent infinite orchestration loop.")
            
        try:
            # Create a turn-copy and force update iteration tracking
            state_copy = dict(state)
            state_copy["iteration_count"] = iteration
            
            # Execute node
            result = node_func(state_copy)
            
            if not isinstance(result, dict):
                result = {}
                
            # Keep iteration_count progression in the returned delta state
            result["iteration_count"] = iteration
            
            print(f"[DIAGNOSTIC] <<< EXITED NODE: {node_name} successfully. Iteration: {iteration}")
            return result
        except Exception as node_err:
            import traceback
            tb_str = traceback.format_exc()
            print(f"\n!!! [DIAGNOSTIC ERROR] Exception caught in node '{node_name}': {node_err}")
            print(tb_str)
            print("==================================================\n")
            raise node_err
    return safe_node_run

def create_workflow():
    workflow = StateGraph(AgentState)

    # Add Nodes wrapped in safe node shell with diagnostics
    workflow.add_node("supervisor", make_safe_node("supervisor", supervisor.run))
    workflow.add_node("intent", make_safe_node("intent", intent_agent.run))
    workflow.add_node("extraction", make_safe_node("extraction", extraction_agent.run))
    workflow.add_node("memory", make_safe_node("memory", memory_agent.run))
    workflow.add_node("knowledge", make_safe_node("knowledge", knowledge_agent.run))
    workflow.add_node("matching", make_safe_node("matching", matching_agent.run))
    workflow.add_node("negotiation", make_safe_node("negotiation", negotiation_agent.run))
    workflow.add_node("request_creation", make_safe_node("request_creation", request_creation_agent.run))
    workflow.add_node("booking", make_safe_node("booking", booking_agent.run))
    workflow.add_node("scheduling", make_safe_node("scheduling", scheduling_agent.run))
    workflow.add_node("communication", make_safe_node("communication", communication.run))

    # Define the Brain (Supervisor as entry point)
    workflow.set_entry_point("supervisor")

    # The Supervisor decides who goes next
    def route_from_supervisor(state: AgentState):
        next_agent = state.get("next_agent", "communication")
        print(f"[DIAGNOSTIC] Supervisor conditional router selected next node: '{next_agent}'")
        return next_agent

    workflow.add_conditional_edges(
        "supervisor",
        route_from_supervisor,
        {
            "intent": "intent",
            "extraction": "extraction",
            "memory": "memory",
            "knowledge": "knowledge",
            "matching": "matching",
            "negotiation": "negotiation",
            "request_creation": "request_creation",
            "booking": "booking",
            "scheduling": "scheduling",
            "communication": "communication"
        }
    )

    # All specialized agents MUST report back to the supervisor
    workflow.add_edge("intent", "supervisor")
    workflow.add_edge("extraction", "supervisor")
    workflow.add_edge("memory", "supervisor")
    workflow.add_edge("knowledge", "supervisor")
    workflow.add_edge("matching", "supervisor")
    workflow.add_edge("negotiation", "supervisor")
    workflow.add_edge("request_creation", "supervisor")
    workflow.add_edge("booking", "supervisor")
    workflow.add_edge("scheduling", "supervisor")

    # Communication agent is the final frontier
    workflow.add_edge("communication", END)

    return workflow

# EXPOSE the raw workflow for compilation with checkpointers
workflow = create_workflow()
