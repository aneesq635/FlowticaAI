from flask_socketio import emit
import json
from datetime import datetime

class WorkflowLogger:
    def __init__(self, socketio=None):
        self.socketio = socketio

    def log(self, event_type, data):
        """
        Emits a log event via Socket.IO
        """
        payload = {
            "timestamp": datetime.utcnow().isoformat(),
            "type": event_type,
            "data": data
        }
        if self.socketio:
            self.socketio.emit("workflow_update", payload)
        print(f"[{event_type}] {json.dumps(data, indent=2)}")

    def agent_started(self, agent_name, state_summary=None):
        self.log("agent_started", {"agent": agent_name, "summary": state_summary})

    def agent_completed(self, agent_name, output_summary=None):
        self.log("agent_completed", {"agent": agent_name, "output": output_summary})

    def state_updated(self, state_diff):
        self.log("state_updated", {"diff": state_diff})

    def trace_created(self, agent_name, reasoning):
        self.log("trace_created", {"agent": agent_name, "reasoning": reasoning})

    def execution_log(self, level, message):
        self.log("execution_log", {"level": level, "message": message})

# Singleton instance to be initialized in app.py
logger = WorkflowLogger()
