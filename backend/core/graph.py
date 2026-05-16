from langgraph.graph import StateGraph, END
from core.state import AgentState
from core.logger import logger
from agents.orchestrator import SupervisorAgent, CommunicationAgent
from agents.service_agents import (
    IntentAgent, ExtractionAgent, MemoryAgent, 
    KnowledgeAgent, MatchingAgent, BookingAgent, SchedulingAgent
)
from pymongo import MongoClient
import os

# Initialize DB for agents
client = MongoClient(os.getenv("MONGODB_URI"))
db = client["flowtica"]

# Instantiate Agents
supervisor = SupervisorAgent()
communication = CommunicationAgent()
intent_agent = IntentAgent()
extraction_agent = ExtractionAgent()
memory_agent = MemoryAgent(db)
knowledge_agent = KnowledgeAgent(db)
matching_agent = MatchingAgent()
booking_agent = BookingAgent(db)
scheduling_agent = SchedulingAgent(db)

def create_workflow():
    workflow = StateGraph(AgentState)

    # Add Nodes
    workflow.add_node("supervisor", supervisor.run)
    workflow.add_node("intent", intent_agent.run)
    workflow.add_node("extraction", extraction_agent.run)
    workflow.add_node("memory", memory_agent.run)
    workflow.add_node("knowledge", knowledge_agent.run)
    workflow.add_node("matching", matching_agent.run)
    workflow.add_node("booking", booking_agent.run)
    workflow.add_node("scheduling", scheduling_agent.run)
    workflow.add_node("communication", communication.run)

    # Define the Brain (Supervisor as entry point)
    workflow.set_entry_point("supervisor")

    # The Supervisor decides who goes next
    def route_from_supervisor(state: AgentState):
        return state.get("next_agent", "communication")

    workflow.add_conditional_edges(
        "supervisor",
        route_from_supervisor,
        {
            "intent": "intent",
            "extraction": "extraction",
            "memory": "memory",
            "knowledge": "knowledge",
            "matching": "matching",
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
    workflow.add_edge("booking", "supervisor")
    workflow.add_edge("scheduling", "supervisor")

    # Communication agent is the final frontier
    workflow.add_edge("communication", END)

    return workflow

# EXPOSE the raw workflow for compilation with checkpointers
workflow = create_workflow()
