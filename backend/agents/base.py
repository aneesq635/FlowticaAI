from abc import ABC, abstractmethod
from typing import Dict, Any, List
from core.state import AgentState
from core.logger import logger
from langchain_openai import ChatOpenAI
import os
import datetime

class BaseAgent(ABC):
    def __init__(self, name: str, role: str):
        self.name = name
        self.role = role
        self.llm = ChatOpenAI(
            model="gpt-4o", 
            openai_api_key=os.getenv("OPENAI_API_KEY"),
            temperature=0
        )

    def log_action(self, state: AgentState, action: str, reasoning: str = ""):
        log_entry = {
            "timestamp": datetime.datetime.now().isoformat(),
            "agent": self.name,
            "action": action,
            "reasoning": reasoning
        }
        # We'll return these to be added to the state via LangGraph's Annotated operator.add
        return log_entry

    def create_trace(self, reasoning: str, tools: List[str] = None):
        return {
            "timestamp": datetime.datetime.now().isoformat(),
            "agent": self.name,
            "reasoning": reasoning,
            "tools": tools or []
        }

    @abstractmethod
    def run(self, state: AgentState) -> Dict[str, Any]:
        pass
