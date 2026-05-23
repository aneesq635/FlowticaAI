from abc import ABC, abstractmethod
from typing import Dict, Any, List
from core.state import AgentState
from core.logger import logger
from langchain_google_vertexai import ChatVertexAI
import os
import datetime

class BaseAgent(ABC):
    def __init__(self, name: str, role: str):
        self.name = name
        self.role = role
        # Initialize Vertex AI LLM
        self.llm = ChatVertexAI(
            model_name="gemini-2.5-flash-lite",
            project=os.getenv("GOOGLE_CLOUD_PROJECT"),
            location=os.getenv("VERTEX_AI_LOCATION", "us-central1"),
            temperature=0,
            max_output_tokens=8192
        )

    def log_action(self, state: AgentState, action: str, reasoning: str = ""):
        from core.logger import safe_text
        log_entry = {
            "timestamp": datetime.datetime.now().isoformat(),
            "agent": self.name,
            "action": safe_text(action),
            "reasoning": safe_text(reasoning)
        }
        # We'll return these to be added to the state via LangGraph's Annotated operator.add
        return log_entry

    def create_trace(self, reasoning: str, tools: List[str] = None):
        from core.logger import safe_text
        return {
            "timestamp": datetime.datetime.now().isoformat(),
            "agent": self.name,
            "reasoning": safe_text(reasoning),
            "tools": tools or []
        }

    @abstractmethod
    def run(self, state: AgentState) -> Dict[str, Any]:
        pass
