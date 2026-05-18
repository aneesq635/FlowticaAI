from flask_socketio import emit
import json
from datetime import datetime

def safe_text(text):
    """
    Sanitizes arbitrary text by replacing common unicode embellishments
    with safe ASCII equivalents, and filtering out any unsupported characters
    to prevent system-wide UnicodeEncodeErrors.
    """
    if not isinstance(text, str):
        return text
        
    replacements = {
        "→": "->",
        "✅": "[DONE]",
        "⚡": "[RUNNING]",
        "✓": "[OK]",
        "✔": "[OK]",
        "⚠️": "[WARN]",
        "“": '"',
        "”": '"',
        "‘": "'",
        "’": "'",
    }
    for uni, asc in replacements.items():
        text = text.replace(uni, asc)
        
    try:
        # Check if text is Western-compatible (standard Windows prompt range)
        text.encode('cp1252')
        return text
    except UnicodeEncodeError:
        # Strict ASCII fallback for general emojis/decorative symbols
        return text.encode('ascii', errors='replace').decode('ascii')

def safe_value(val):
    """
    Recursively scans and sanitizes lists, dictionaries, strings, and sets
    to ensure full safety before printing, logging, or serialization.
    """
    if isinstance(val, str):
        return safe_text(val)
    elif isinstance(val, dict):
        return {safe_value(k): safe_value(v) for k, v in val.items()}
    elif isinstance(val, list):
        return [safe_value(item) for item in val]
    elif isinstance(val, tuple):
        return tuple(safe_value(item) for item in val)
    elif isinstance(val, set):
        return {safe_value(item) for item in val}
    return val

class WorkflowLogger:
    def __init__(self, socketio=None):
        self.socketio = socketio

    def log(self, event_type, data):
        """
        Emits a sanitized log event via Socket.IO and prints safely to stdout.
        """
        safe_data = safe_value(data)
        payload = {
            "timestamp": datetime.utcnow().isoformat(),
            "type": event_type,
            "data": safe_data
        }
        if self.socketio:
            try:
                self.socketio.emit("workflow_update", payload)
            except Exception as emit_err:
                print(f"[SOCKET ERROR] Failed to emit workflow update: {emit_err}")
                
        try:
            print(f"[{event_type}] {json.dumps(safe_data, indent=2)}")
        except Exception as print_err:
            print(f"[{event_type}] [PRINT_FALLBACK] Failed printing data: {print_err}")

    def agent_started(self, agent_name, state_summary=None):
        self.log("agent_started", {"agent": safe_text(agent_name), "summary": safe_value(state_summary)})

    def agent_completed(self, agent_name, output_summary=None):
        self.log("agent_completed", {"agent": safe_text(agent_name), "output": safe_value(output_summary)})

    def state_updated(self, state_diff):
        self.log("state_updated", {"diff": safe_value(state_diff)})

    def trace_created(self, agent_name, reasoning):
        self.log("trace_created", {"agent": safe_text(agent_name), "reasoning": safe_text(reasoning)})

    def execution_log(self, level, message):
        self.log("execution_log", {"level": safe_text(level), "message": safe_text(message)})

# Singleton instance to be initialized in app.py
logger = WorkflowLogger()
