import sys
import io
import threading

# Global UTF-8 encoding configuration for Windows terminal compatibility
if sys.platform.startswith('win'):
    try:
        if hasattr(sys.stdout, 'reconfigure'):
            sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        else:
            sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
            
        if hasattr(sys.stderr, 'reconfigure'):
            sys.stderr.reconfigure(encoding='utf-8', errors='replace')
        else:
            sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
        print("[STARTUP DIAGNOSTIC] Reconfigured system standard outputs to UTF-8.")
    except Exception as enc_err:
        print(f"[STARTUP DIAGNOSTIC] Failed to reconfigure stdout/stderr encoding: {enc_err}")

import functools
print = functools.partial(print, flush=True)

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from pymongo import MongoClient
from dotenv import load_dotenv
import os
import json
import threading
from langchain_core.messages import HumanMessage, AIMessage

# Project Imports
from core.graph import workflow
from core.logger import logger
from core.state import AgentState
from core.persistence import MongoCheckpointer
from core.vector_store import vector_manager
from models.conversation import ConversationModel
from models.user import UserModel
from models.provider import ProviderModel

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = 'flowtica-secret'
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading', allow_upgrades=False)

# Initialize Logger with SocketIO
logger.socketio = socketio

# ── PATCH 1 ───────────────────────────────────────────────────────────────────
# Add this near the top of app.py, after the imports section.
# This dict maps conversation_id → threading.Lock() and prevents two socket
# messages for the same conversation from running the graph simultaneously.
 
_conversation_locks: dict = {}
_conversation_locks_mutex = threading.Lock()
 
 
def _get_conversation_lock(conversation_id: str) -> threading.Lock:
    """Returns (creating if needed) a per-conversation reentrant lock."""
    with _conversation_locks_mutex:
        if conversation_id not in _conversation_locks:
            _conversation_locks[conversation_id] = threading.Lock()
        return _conversation_locks[conversation_id]
 

print("\n==================================================")
print("[STARTUP DIAGNOSTIC] Core Services Boot Sequence")
print("==================================================")

try:
    mongo_uri = os.getenv("MONGODB_URI")
    print("[STARTUP DIAGNOSTIC] Validating MongoDB URI...")
    if not mongo_uri:
        raise ValueError("MONGODB_URI is not set in environment variables!")
    print(f"[STARTUP DIAGNOSTIC] MongoDB Target: {mongo_uri[:35]}... [PROTECTED]")
    
    print("[STARTUP DIAGNOSTIC] Verifying Database connection...")
    client = MongoClient(mongo_uri)
    client.admin.command('ping')
    print("[STARTUP DIAGNOSTIC] SUCCESS: MongoDB is connected & authenticating correctly.")
except Exception as e:
    print(f"[STARTUP DIAGNOSTIC] WARNING: MongoDB Validation failed: {str(e)}")

db = client["flowtica"]
users_collection = db["users"]

try:
    print("[STARTUP DIAGNOSTIC] Initializing Database Models...")
    conv_model = ConversationModel(db)
    user_model = UserModel(db)
    provider_model = ProviderModel(db)
    checkpointer = MongoCheckpointer(db)
    print(f"[STARTUP DIAGNOSTIC]  - UserModel: Initialized")
    print(f"[STARTUP DIAGNOSTIC]  - ProviderModel: Initialized")
    print(f"[STARTUP DIAGNOSTIC]  - ConversationModel: Initialized")
    print(f"[STARTUP DIAGNOSTIC]  - MongoCheckpointer: Initialized on 'flowtica' db")
except Exception as e:
    print(f"[STARTUP DIAGNOSTIC] WARNING: Model Initialization error: {str(e)}")



try:
    print("[STARTUP DIAGNOSTIC] Compiling LangGraph Multi-Agent Workflow...")
    graph = workflow.compile(checkpointer=checkpointer)
    print("[STARTUP DIAGNOSTIC] SUCCESS: LangGraph Multi-Agent Workflow compiled successfully with native MongoDB checkpointer.")
except Exception as e:
    print(f"[STARTUP DIAGNOSTIC] ERROR: LangGraph Compilation failed: {str(e)}")
    import traceback
    print(traceback.format_exc())

try:
    print("[CHROMA SYNC] Starting intelligent startup sync validation...")
    from core.vector_store import vector_manager
 
    vs = vector_manager.get_vector_store()
 
    # Count records in both stores
    mongo_count = db.service_providers.count_documents({})
    
    try:
        chroma_count = vs._collection.count()
    except Exception:
        chroma_count = 0
 
    print(f"[CHROMA SYNC] MongoDB records: {mongo_count} | ChromaDB records: {chroma_count}")
 
    if mongo_count == 0:
        print("[CHROMA SYNC] No services in MongoDB. Skipping sync.")
    elif chroma_count == 0:
        # ChromaDB is empty — full sync needed
        print("[CHROMA SYNC] ChromaDB is empty. Running full sync...")
        vector_manager.sync_from_mongodb(db)
    elif chroma_count < mongo_count:
        # Some records missing — find and sync only missing ones
        print(f"[CHROMA SYNC] {mongo_count - chroma_count} records missing. Syncing missing services...")
        
        # Get all IDs currently in ChromaDB
        try:
            chroma_ids = set(vs._collection.get()["ids"])
        except Exception:
            chroma_ids = set()
 
        # Find MongoDB records not in ChromaDB
        all_services = db.service_providers.find({}, {"_id": 1})
        missing_count = 0
        for svc in all_services:
            svc_id = str(svc["_id"])
            if svc_id not in chroma_ids:
                try:
                    vector_manager.upsert_service(db, svc_id)
                    missing_count += 1
                except Exception as e:
                    print(f"[CHROMA SYNC WARNING] Failed to sync {svc_id}: {e}")
 
        print(f"[CHROMA SYNC] Synced {missing_count} missing services.")
    else:
        print("[CHROMA SYNC] ChromaDB is up to date. No sync needed.")
 
    print("[CHROMA SYNC] Startup sync validation complete.")
except Exception as sync_err:
    print(f"[CHROMA SYNC WARNING] Startup sync failed (non-critical): {sync_err}")



print("==================================================\n")

from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, timedelta

def check_upcoming_bookings():
    """Background job: Reminds users and providers 1 hour before scheduled booking."""
    try:
        now = datetime.now()
        one_hour_later = now + timedelta(hours=1)
        # Assuming requested_date is YYYY-MM-DD and requested_time is HH:MM string in DB
        date_str = one_hour_later.strftime("%Y-%m-%d")
        time_str = one_hour_later.strftime("%H:%M") # Match up to the minute
        
        # We find bookings matching the EXACT date/time (ignoring seconds) that haven't been reminded
        upcoming_bookings = list(db.bookings.find({
            "requested_date": date_str,
            "requested_time": time_str,
            "status": "booked",
            "reminder_sent": {"$ne": True}
        }))
        
        for b in upcoming_bookings:
            c_id = b.get("customer_supabase_id")
            p_id = b.get("provider_supabase_id")
            svc = b.get("service_type")
            
            # Insert Customer Reminder
            db.notifications.insert_one({
                "user_supabase_id": c_id,
                "role": "buyer",
                "type": "reminder",
                "title": "Upcoming Service",
                "message": f"Reminder: Your {svc} booking is starting in 1 hour.",
                "related_id": str(b["_id"]),
                "status": "unread",
                "created_at": datetime.now()
            })
            
            # Insert Provider Reminder
            db.notifications.insert_one({
                "user_supabase_id": p_id,
                "role": "seller",
                "type": "reminder",
                "title": "Upcoming Job",
                "message": f"Reminder: You have a {svc} job starting in 1 hour.",
                "related_id": str(b["_id"]),
                "status": "unread",
                "created_at": datetime.now()
            })
            
            # Mark reminder sent
            db.bookings.update_one({"_id": b["_id"]}, {"$set": {"reminder_sent": True}})
            
            # Emit live socket updates
            socketio.emit('booking_notification', {"user_supabase_id": c_id})
            socketio.emit('booking_notification', {"user_supabase_id": p_id})
            print(f"[SCHEDULER] Reminders sent for booking {b['_id']}")
    except Exception as e:
        print(f"[SCHEDULER ERROR] {e}")

scheduler = BackgroundScheduler()
scheduler.add_job(func=check_upcoming_bookings, trigger="interval", minutes=1)
scheduler.start()


@socketio.on('connect')
def handle_connect():
    sid = getattr(request, 'sid', 'unknown')
    transport = request.args.get('transport', 'unknown')
    headers = dict(request.headers)
    print(f"\n[SOCKET CONNECT] === Client Connected ===")
    print(f"[SOCKET CONNECT] Session ID (SID): {sid}")
    print(f"[SOCKET CONNECT] Transport Type: {transport}")
    print(f"[SOCKET CONNECT] Origin Header: {headers.get('Origin', 'Not Provided')}")
    print(f"[SOCKET CONNECT] User-Agent: {headers.get('User-Agent', 'Not Provided')}")
    print(f"[SOCKET CONNECT] =========================\n")
    emit('status', {'message': 'Connected to Flowtica AI Engine', 'sid': sid, 'transport': transport})

@socketio.on('disconnect')
def handle_disconnect():
    sid = getattr(request, 'sid', 'unknown')
    print(f"\n[SOCKET DISCONNECT] === Client Disconnected ===")
    print(f"[SOCKET DISCONNECT] Session ID (SID): {sid}")
    print(f"[SOCKET DISCONNECT] ============================\n")

# def serialize_value(obj):
#     """Helper to make LangGraph state serializable for SocketIO"""
#     from core.logger import safe_value
#     if isinstance(obj, (HumanMessage, AIMessage)):
#         return {"content": safe_value(obj.content), "type": obj.type}
#     if isinstance(obj, list):
#         return [serialize_value(i) for i in obj]
#     if isinstance(obj, dict):
#         return {k: serialize_value(v) for k, v in obj.items() if k != "embedding"}
#     return safe_value(obj)
def serialize_value(obj):
    """Helper to make LangGraph state serializable for SocketIO"""
    from core.logger import safe_value
    from datetime import datetime
    from bson import ObjectId
    
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, ObjectId):
        return str(obj)
    if isinstance(obj, (HumanMessage, AIMessage)):
        return {"content": safe_value(obj.content), "type": obj.type}
    if isinstance(obj, list):
        return [serialize_value(i) for i in obj]
    if isinstance(obj, dict):
        return {k: serialize_value(v) for k, v in obj.items() if k != "embedding"}
    return safe_value(obj)

def map_messages_to_langchain(stored_messages):
    """Converts MongoDB stored JSON messages to LangChain Message objects"""
    lc_messages = []
    for msg in stored_messages:
        role = msg.get("role")
        content = msg.get("content")
        if role == "user":
            lc_messages.append(HumanMessage(content=content))
        elif role == "assistant":
            lc_messages.append(AIMessage(content=content))
    return lc_messages


 
def run_orchestration_flow(message_text, conversation_id, user_id, socketio_sid=None):
    """Executes the complete multi-agent LangGraph workflow for a message turn and streams updates."""
    # Try resolving from conversation collection if anonymous
    if (not user_id or user_id == 'anonymous') and conversation_id:
        try:
            from bson import ObjectId
            conv_doc = db.conversations.find_one({"_id": ObjectId(conversation_id)})
            if conv_doc and conv_doc.get("user_id"):
                user_id = conv_doc.get("user_id")
                print(f"[ORCHESTRATOR] Resolved customer user_id: {user_id} from conversations collection.")
        except Exception as conv_err:
            print(f"[ORCHESTRATOR] Failed to resolve conversation user_id: {conv_err}")
            
    print(f"\n[ORCHESTRATOR] === New Message Turn Started ===")
    print(f"[ORCHESTRATOR] Message: {message_text}")
    print(f"[ORCHESTRATOR] Conversation: {conversation_id}")
    print(f"[ORCHESTRATOR] User ID: {user_id}")
    print(f"[ORCHESTRATOR] Target Socket SID: {socketio_sid}")



    try:
        # PREPARE Production Config for Persistence
        config = {"configurable": {"thread_id": conversation_id or "default_thread"}}
        
        # Check if thread exists in Checkpointer
        print(f"[ORCHESTRATOR] Fetching state for thread: {config['configurable']['thread_id']}...")
        existing_state = graph.get_state(config)
        is_resumed = bool(existing_state.values)
        print(f"[ORCHESTRATOR] Session Resumed: {is_resumed}")
    
        # CRITICAL: Reset per-turn fields every message
        # next_agent="" tells supervisor this is a fresh turn (nothing completed yet)
        # intent={} forces fresh intent classification
        turn_input = {
            "messages": [HumanMessage(content=message_text)],
            "user_id": user_id,
            "conversation_id": conversation_id,
            "active_agent": "start",
            "intent": {},           # Cleared by replace_if_new reducer
            "next_agent": "",       # Empty = fresh turn, supervisor uses this to track progress
            "iteration_count": 0,  # Reset loop guard counter
            "turn_routed_agents": [],  # Reset loop safety guard routed list
            "booking_outcome": {},  
            "metadata": {"conversation_id": conversation_id, "is_resumed": is_resumed}
        }

        # Initialize pinned keys only for first-time orchestration
        if not is_resumed:
            turn_input.update({
                "conversation_id": conversation_id,
                "entities": {},
                "service_request": {},
                "provider_candidates": [],
                "workflow_stage": "discovery",
                "conversation_stage": "greeting",
                "shortlisted_providers": [],
                "selected_provider": {},
                "booking_context": {},
                "booking_details": {},
                "agent_states": {},
                "is_complete": False,
            })

        from core.logger import safe_text, safe_value

        # Custom emitter that targets a specific Socket.IO session SID if provided
        def custom_emit(event, payload):
            if socketio_sid:
                socketio.emit(event, payload, to=socketio_sid)
            else:
                socketio.emit(event, payload)

        custom_emit('workflow_started', {'input': safe_text(message_text)})
        
        # Persist user message
        if conversation_id:
            conv_model.add_message(conversation_id, "user", safe_text(message_text))

        if is_resumed:
            current_state = graph.get_state(config).values
            print(f"[DEBUG] selected_provider in state: {current_state.get('selected_provider', {}).get('name', 'EMPTY')}", flush=True)
            print(f"[DEBUG] booking_context in state: {current_state.get('booking_context', {})}", flush=True)
            print(f"[DEBUG] conversation_stage: {current_state.get('conversation_stage', 'EMPTY')}", flush=True)

        # NATIVE LangGraph STREAM with persistence
        print(f"\n[ORCHESTRATOR DIAGNOSTIC] Starting graph stream execution for conversation: {conversation_id}...")
        
        has_emitted_final_reply = False
        final_reply_text = ""
        
        for event in graph.stream(turn_input, config=config):
            # Print serialized event chunk safely
            try:
                print(f"\n[ORCHESTRATOR DIAGNOSTIC] Stream Event chunk generated: {json.dumps(serialize_value(event))[:500]}...")
            except Exception as ser_err:
                print(f"\n[ORCHESTRATOR DIAGNOSTIC] Stream Event chunk generated: [Serialization failed: {ser_err}]")
            
            for node_name, state_update in event.items():
                print(f"--- Production Orchestration Node: {safe_text(node_name)} ---")
                print(f"[ORCHESTRATOR DIAGNOSTIC] Evaluating node '{safe_text(node_name)}' with output keys: {list(state_update.keys())}")
                
                # Signal Agent Started
                print(f"[SOCKET] Emitting agent_started for: {safe_text(node_name)}")
                custom_emit('workflow_update', {
                    'type': 'agent_started',
                    'data': {'agent': safe_text(node_name)}
                })
                
                # Serialized delta to UI
                serialized_update = serialize_value(state_update)
                custom_emit('workflow_update', {
                    'type': 'state_updated',
                    'data': {'agent': safe_text(node_name), 'diff': serialized_update}
                })
                
                # Reasoning & Logs
                if "reasoning_traces" in state_update:
                    for trace in state_update["reasoning_traces"]:
                        trace_reasoning = safe_text(trace.get('reasoning', ''))
                        print(f"[ORCHESTRATOR DIAGNOSTIC] Node '{safe_text(node_name)}' trace: {trace_reasoning}")
                        custom_emit('workflow_update', {
                            'type': 'trace_created',
                            'data': {'agent': safe_text(node_name), 'reasoning': trace_reasoning}
                        })

                if "execution_logs" in state_update:
                    for log in state_update["execution_logs"]:
                        log_msg = safe_text(log.get('message', ''))
                        print(f"[ORCHESTRATOR DIAGNOSTIC] Node '{safe_text(node_name)}' log: {log_msg}")
                        custom_emit('workflow_update', {
                            'type': 'execution_log',
                            'data': safe_value(log)
                        })
                
                # Signal Agent Completed
                print(f"[SOCKET] Emitting agent_completed for: {safe_text(node_name)}")
                custom_emit('workflow_update', {
                    'type': 'agent_completed',
                    'data': {'agent': safe_text(node_name)}
                })

                # Final Response handling
                if "frontier_response" in state_update:
                    content = safe_text(state_update["frontier_response"])
                    print(f"[SOCKET] Emitting final assistant response from '{safe_text(node_name)}' delta!")
                    print(f"[SOCKET PAYLOAD] {content[:100]}...")
                    
                    custom_emit('chat_message', {
                        'role': 'assistant',
                        'content': content,
                        'agent': 'Frontier Agent',
                        'conversation_id': conversation_id
                    })
                    has_emitted_final_reply = True
                    final_reply_text = content
                    print("[SOCKET] Final response emitted successfully via node delta.")
                    
                    if conversation_id:
                        conv_model.add_message(conversation_id, "assistant", content, agent="Frontier Agent")

        print("[ORCHESTRATOR DIAGNOSTIC] Graph stream loop execution finished.")

        # --- STEP 2: PRINT & VERIFY FINAL STATE ---
        try:
            final_state_obj = graph.get_state(config)
            final_state = final_state_obj.values if final_state_obj else {}
            print(f"\n[ORCHESTRATOR DIAGNOSTIC] === FINAL STATE AUDIT ===")
            print(f"[ORCHESTRATOR DIAGNOSTIC] Final State keys: {list(final_state.keys())}")
            print(f"[ORCHESTRATOR DIAGNOSTIC] next_agent: {safe_text(final_state.get('next_agent'))}")
            print(f"[ORCHESTRATOR DIAGNOSTIC] is_complete: {final_state.get('is_complete')}")
            print(f"[ORCHESTRATOR DIAGNOSTIC] active_agent: {safe_text(final_state.get('active_agent'))}")
            
            # If the delta event was missed but the final state has a response, emit it!
            if not has_emitted_final_reply:
                content = safe_text(final_state.get("frontier_response"))
                if content:
                    print(f"[SOCKET WARNING] Delta stream missed frontier_response emission! Triggering aggregated final state fallback emit.")
                    print(f"[SOCKET PAYLOAD] {content[:100]}...")
                    custom_emit('chat_message', {
                        'role': 'assistant',
                        'content': content,
                        'agent': 'Frontier Agent',
                        'conversation_id': conversation_id
                    })
                    has_emitted_final_reply = True
                    final_reply_text = content
                    print("[SOCKET] Fallback response emitted successfully.")
                    if conversation_id:
                        conv_model.add_message(conversation_id, "assistant", content, agent="Frontier Agent")
                else:
                    print(f"[ORCHESTRATOR ERROR] Critical! No 'frontier_response' found in the final state values!")
            
            print(f"[ORCHESTRATOR DIAGNOSTIC] ==============================\n")
        except Exception as state_err:
            print(f"[ORCHESTRATOR DIAGNOSTIC] ERROR retrieving final state values: {state_err}")

        custom_emit('workflow_completed', {'status': 'success'})
        return final_reply_text

    except Exception as e:
        import traceback
        error_type = safe_text(type(e).__name__)
        error_msg = safe_text(str(e) or "No error message provided")
        print(f"!!! CRITICAL ORCHESTRATION ERROR [{error_type}]: {error_msg}")
        print(traceback.format_exc())
        
        custom_emit('workflow_failed', {'error': f"{error_type}: {error_msg}"})
        custom_emit('chat_message', {
            'role': 'assistant',
            'content': f"Orchestration failure: {error_type} - {error_msg}",
            'agent': 'System',
            'conversation_id': conversation_id
        })
        return f"Orchestration failure: {error_type} - {error_msg}"
    finally:
        print(f"[ORCHESTRATOR] === Message Turn Completed ===\n")


@socketio.on('user_message')
def handle_message(data):
    """SocketIO event listener — serialises concurrent messages per conversation."""
    message_text = data.get('text')
    conversation_id = data.get('conversation_id')
    user_id = data.get('user_id') or 'anonymous'
    sid = getattr(request, 'sid', None)
 
    lock = _get_conversation_lock(conversation_id or 'default')
 
    if not lock.acquire(blocking=False):
        # Another message is already being processed for this conversation.
        # Emit a transient busy signal and drop the duplicate.
        print(f"[SOCKET] Conversation {conversation_id} is busy — dropping duplicate message.")
        if sid:
            socketio.emit('workflow_update', {
                'type': 'busy',
                'data': {'message': 'Processing your previous message, please wait…'}
            }, to=sid)
        return
 
    try:
        run_orchestration_flow(message_text, conversation_id, user_id, socketio_sid=sid)
    finally:
        lock.release()


# In-Memory Session registry for short-lived Gemini Voice Session Tokens
GEMINI_SESSIONS = {}
SESSION_EXPIRY_SECONDS = 300  # Tickets are valid for 5 minutes from generation

@app.route("/api/gemini/token", methods=["POST"])
def generate_gemini_token():
    """Generates an ephemeral, single-use ticket for the frontend to authenticate a voice WebSocket session."""
    try:
        import uuid
        import time
        
        data = request.json or {}
        conversation_id = data.get("conversation_id")
        user_id = data.get("user_id") or "anonymous"
        socketio_sid = data.get("socketio_sid")
        
        if not conversation_id:
            return jsonify({"success": False, "error": "conversation_id is required"}), 400
            
        token = str(uuid.uuid4())
        GEMINI_SESSIONS[token] = {
            "conversation_id": conversation_id,
            "user_id": user_id,
            "socketio_sid": socketio_sid,
            "created_at": time.time()
        }
        
        print(f"[GEMINI TOKEN] Generated ephemeral session token: {token[:8]}... for user {user_id}")
        return jsonify({
            "success": True,
            "token": token,
            "expires_in": SESSION_EXPIRY_SECONDS
        }), 200
    except Exception as e:
        print(f"[GEMINI TOKEN ERROR] {e}")
        return jsonify({"success": False, "error": str(e)}), 500


# ---------------------------------------------------------------------------
# Gemini Voice WebSocket Proxy — runs on a DEDICATED port (5001) in a
# daemon background thread.  Werkzeug (used by Flask-SocketIO threading
# mode) does NOT implement the HTTP→WebSocket upgrade protocol, so a raw
# WebSocket server must live outside of Flask entirely.
# The `websockets` package (>=13) ships `websockets.sync.server` which is
# synchronous and thread-safe — perfect for this threading-mode backend.
# ---------------------------------------------------------------------------

def _gemini_ws_handler(client_ws):
    """
    Handler called by the websockets.sync.server for every new connection
    to ws://HOST:5001/api/gemini/ws?token=<TOKEN>
    """
    import time
    import base64
    import threading
    import urllib.parse
    from websockets.sync.client import connect as gemini_connect
    from websockets.exceptions import ConnectionClosed as GeminiClosed
    from websockets.exceptions import ConnectionClosed as WSClosed

    # --- Parse token from query string ---
    raw_path = client_ws.request.path          # e.g. /api/gemini/ws?token=...
    qs = urllib.parse.urlparse(raw_path).query
    params = urllib.parse.parse_qs(qs)
    token = (params.get("token") or [None])[0]

    if not token or token not in GEMINI_SESSIONS:
        print("[GEMINI PROXY WARNING] Connection rejected: Invalid or missing token.")
        client_ws.close()
        return

    session_info = GEMINI_SESSIONS.pop(token)   # single-use — pop immediately

    if time.time() - session_info["created_at"] > SESSION_EXPIRY_SECONDS:
        print("[GEMINI PROXY WARNING] Connection rejected: Token expired.")
        client_ws.close()
        return

    gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not gemini_key:
        print("[GEMINI PROXY ERROR] GEMINI_API_KEY not set in backend/.env")
        client_ws.close()
        return

    conv_id = session_info["conversation_id"]
    u_id    = session_info["user_id"]
    sid     = session_info["socketio_sid"]

    print(f"[GEMINI PROXY] Client WebSocket accepted for conversation {conv_id}")

    # --- Connect to Google Gemini Live Bidi API ---
    gemini_url = (
        "wss://generativelanguage.googleapis.com/ws/"
        "google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent"
        f"?key={gemini_key}"
    )
    try:
        print("[GEMINI PROXY] Opening connection to Gemini Live Bidi API...")
        gemini_ws = gemini_connect(gemini_url)
        print("[GEMINI PROXY] SUCCESS: Connected to Gemini Live API.")

        setup_payload = {
            "setup": {
                "model": "models/gemini-2.0-flash-live-001",
                "generationConfig": {
                    "responseModalities": ["AUDIO"],
                    "speechConfig": {
                        "voiceConfig": {
                            "prebuiltVoiceConfig": {"voiceName": "Puck"}
                        }
                    }
                },
                "systemInstruction": {
                    "parts": [{
                        "text": (
                            "You are a voice interface proxy. You must NEVER answer the "
                            "user's questions yourself or generate any independent responses. "
                            "When the user speaks to you, simply listen and do NOT reply. "
                            "The system will send you text content via clientContent, and "
                            "your only job is to read that text out loud exactly as written "
                            "in a professional, warm voice. Never speak anything else."
                        )
                    }]
                }
            }
        }
        gemini_ws.send(json.dumps(setup_payload))
        print("[GEMINI PROXY] Setup instructions sent.")

    except Exception as conn_err:
        print(f"[GEMINI PROXY ERROR] Cannot connect to Gemini Live API: {conn_err}")
        client_ws.close()
        return

    # --- Gemini → Client forwarding thread ---
    def forward_gemini_to_client():
        try:
            for message in gemini_ws:
                data = json.loads(message)

                if "serverContent" in data:
                    content = data["serverContent"]
                    if "modelTurn" in content and "parts" in content["modelTurn"]:
                        for part in content["modelTurn"]["parts"]:
                            if "inlineData" in part:
                                client_ws.send(json.dumps({
                                    "type": "audio",
                                    "data": part["inlineData"]["data"]
                                }))
                                if sid:
                                    socketio.emit("voice_status", {"isSpeaking": True}, to=sid)

                    if content.get("turnComplete"):
                        print("[GEMINI PROXY] Gemini finished audio turn.")
                        if sid:
                            socketio.emit("voice_status", {"isSpeaking": False}, to=sid)

                if "inputTranscription" in data:
                    trans = data["inputTranscription"]
                    if "parts" in trans:
                        text_chunk = "".join(p.get("text", "") for p in trans["parts"])
                        if text_chunk:
                            client_ws.send(json.dumps({
                                "type": "caption", "role": "user", "text": text_chunk
                            }))

                            if trans.get("done"):
                                print(f"[GEMINI PROXY] Full user speech: '{text_chunk}'")

                                def execute_and_synthesize(query_text):
                                    if sid:
                                        socketio.emit("voice_status", {"isThinking": True}, to=sid)

                                    frontier_response = run_orchestration_flow(
                                        query_text, conv_id, u_id, socketio_sid=sid
                                    )

                                    if sid:
                                        socketio.emit("voice_status", {"isThinking": False}, to=sid)

                                    client_ws.send(json.dumps({
                                        "type": "caption", "role": "assistant",
                                        "text": frontier_response
                                    }))

                                    speak_payload = {
                                        "clientContent": {
                                            "turns": [{
                                                "role": "user",
                                                "parts": [{"text": frontier_response}]
                                            }],
                                            "turnComplete": True
                                        }
                                    }
                                    gemini_ws.send(json.dumps(speak_payload))
                                    print(f"[GEMINI PROXY] Injected TTS text: {frontier_response[:80]}...")

                                threading.Thread(
                                    target=execute_and_synthesize,
                                    args=(text_chunk,),
                                    daemon=True
                                ).start()

        except (GeminiClosed, WSClosed):
            print("[GEMINI PROXY] Gemini WS closed (forward thread).")
        except Exception as fwd_err:
            print(f"[GEMINI PROXY ERROR] Forward thread: {fwd_err}")
        finally:
            try:
                client_ws.close()
            except Exception:
                pass

    threading.Thread(target=forward_gemini_to_client, daemon=True).start()

    # --- Client → Gemini forwarding loop (main handler thread) ---
    try:
        for client_msg in client_ws:
            if isinstance(client_msg, bytes):
                audio_b64 = base64.b64encode(client_msg).decode("utf-8")
                gemini_ws.send(json.dumps({
                    "realtimeInput": {
                        "mediaChunks": [{
                            "mimeType": "audio/pcm;rate=16000",
                            "data": audio_b64
                        }]
                    }
                }))
            else:
                try:
                    cmd = json.loads(client_msg)
                    if cmd.get("type") == "interrupt":
                        print("[GEMINI PROXY] Barge-in interrupt received.")
                        gemini_ws.send(json.dumps({
                            "clientContent": {"turns": [], "turnComplete": True}
                        }))
                except Exception as cmd_err:
                    print(f"[GEMINI PROXY ERROR] Client cmd parse error: {cmd_err}")
    except (WSClosed, GeminiClosed):
        pass
    except Exception as proxy_err:
        print(f"[GEMINI PROXY ERROR] Client→Gemini loop: {proxy_err}")
    finally:
        print("[GEMINI PROXY] Session closed.")
        try:
            gemini_ws.close()
        except Exception:
            pass


def _start_gemini_ws_server():
    """Starts the standalone WebSocket server for the Gemini voice proxy on port 5001.
    Uses SO_REUSEADDR so the port is reclaimed immediately when the old process dies
    (important on Windows where TIME_WAIT can hold the socket for a few seconds).
    Retries up to 10 times with a 2-second back-off to survive brief port conflicts.
    """
    import socket
    import time
    from websockets.sync.server import serve as ws_serve

    host = "0.0.0.0"
    port = 5001

    def make_socket():
        """Create a TCP socket with SO_REUSEADDR so we can rebind immediately."""
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.bind((host, port))
        return sock

    print(f"[GEMINI WS SERVER] Starting dedicated WebSocket server on ws://{host}:{port}")

    for attempt in range(1, 11):
        try:
            with ws_serve(_gemini_ws_handler, sock=make_socket()) as server:
                print(f"[GEMINI WS SERVER] Listening on port {port} (attempt {attempt})")
                server.serve_forever()
            break  # clean exit — stop retrying
        except OSError as os_err:
            # Port still occupied by the previous process — wait and retry
            print(f"[GEMINI WS SERVER] Port {port} busy (attempt {attempt}/10): {os_err}")
            if attempt < 10:
                time.sleep(2)
            else:
                print(f"[GEMINI WS SERVER ERROR] Could not bind to port {port} after 10 attempts. Voice proxy disabled.")
        except Exception as ws_srv_err:
            print(f"[GEMINI WS SERVER ERROR] Unexpected error: {ws_srv_err}")
            break


# Launch WebSocket server in a daemon thread so it starts alongside Flask
_gemini_ws_thread = threading.Thread(target=_start_gemini_ws_server, daemon=True)
_gemini_ws_thread.start()

# Diagnostic Routes
@app.route("/health", methods=["GET"])
def health_check():
    """Diagnostic health check to verify backend reachability and DB status."""
    try:
        # Check database connection
        db.command("ping")
        return jsonify({
            "success": True,
            "message": "Backend reachable",
            "database": "connected",
            "timestamp": datetime.now().isoformat()
        }), 200
    except Exception as e:
        print(f"!!! DIAGNOSTIC HEALTH CHECK FAILURE: {str(e)}")
        return jsonify({
            "success": False,
            "message": "Backend reachable, but database failed",
            "error": str(e)
        }), 500

@app.route("/api/echo", methods=["POST"])
def api_echo():
    """Diagnostic echo endpoint to verify frontend payload transmission and CORS."""
    try:
        data = request.json or {}
        print(f"[DIAGNOSTIC] Echo requested with data: {data}")
        return jsonify({
            "success": True,
            "echo": data,
            "headers": dict(request.headers)
        }), 200
    except Exception as e:
        print(f"!!! DIAGNOSTIC ECHO FAILURE: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

# Existing User APIs
@app.route("/create-user", methods=["POST"])
def create_user():
    try:
        data = request.json
        supabase_id = data.get("supabase_id")
        print(f"--- API: Creating USER: {supabase_id} ---")
        user = user_model.get_or_create_user(supabase_id, data)
        return jsonify({"success": True, "user": user})
    except Exception as e:
        print(f"!!! API ERROR (create_user): {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route("/update-user", methods=["PUT"])
def update_user():
    try:
        data = request.json
        supabase_id = data.get("supabase_id") or data.get("id")
        if not supabase_id:
            return jsonify({"error": "Missing supabase_id"}), 400
            
        print(f"--- API: Updating USER: {supabase_id} ---")
        user = user_model.update_user(supabase_id, data)
        if user:
            return jsonify({"success": True, "user": user})
        else:
            return jsonify({"error": "User not found"}), 404
    except Exception as e:
        print(f"!!! API ERROR (update_user): {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/providers/profile", methods=["POST"])
def setup_provider_profile():
    try:
        data = request.json
        supabase_id = data.get("supabase_id")
        print(f"--- API: Setting up provider profile for: {supabase_id} ---")
        
        # Upsert the provider main info using the new model
        profile_data = provider_model.create_or_update_provider(
            supabase_id=supabase_id,
            name=data.get("name"),
            main_service=data.get("main_service"),
            status=data.get("status", "active")
        )
        
        # Trigger real-time sync of all provider's services to update provider_name etc. in vector store
        try:
            services = list(db.service_providers.find({"provider_supabase_id": supabase_id}))
            for s in services:
                # Re-build and update each service document
                enriched = build_enriched_service_document(s, existing_id=str(s["_id"]))
                update_fields = {k: v for k, v in enriched.items() if k != "_id"}
                db.service_providers.update_one({"_id": s["_id"]}, {"$set": update_fields})
                vector_manager.upsert_service(db, str(s["_id"]))
            print(f"[SYNC] Triggered real-time vector re-sync for all {len(services)} services of provider: {supabase_id}")
        except Exception as sync_err:
            print(f"[SYNC ERROR] Failed to sync services for provider {supabase_id}: {sync_err}")
            
        return jsonify({"success": True, "profile": profile_data})
    except Exception as e:
        print(f"!!! API ERROR (setup_provider_profile): {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/providers/profile/<supabase_id>", methods=["GET"])
def get_provider_profile(supabase_id):
    try:
        from bson import ObjectId
        # 1. Get main profile using the new model
        profile = provider_model.get_provider_by_supabase_id(supabase_id)
        if profile:
            profile["_id"] = str(profile["_id"])
            
        # 2. Get all services added by this provider
        services_cursor = db.service_providers.find({"provider_supabase_id": supabase_id})
        services = []
        for s in services_cursor:
            s["_id"] = str(s["_id"])
            services.append(s)
            
        # 3. Dynamic insights calculations
        total_jobs = db.bookings.count_documents({"provider_supabase_id": supabase_id})
        completed_jobs = db.bookings.count_documents({"provider_supabase_id": supabase_id, "status": "completed"})
        active_requests_count = db.active_requests.count_documents({"provider_supabase_id": supabase_id, "status": {"$in": ["pending", "counter_offer"]}})
        
        # Calculate total earnings from completed bookings
        pipeline_earnings = [
            {"$match": {"provider_supabase_id": supabase_id, "status": "completed"}},
            {"$group": {"_id": None, "total": {"$sum": "$price"}}}
        ]
        agg_earnings = list(db.bookings.aggregate(pipeline_earnings))
        total_earnings = agg_earnings[0]["total"] if agg_earnings else 0
        
        # Calculate total work hours from completed bookings/services
        pipeline_hours = [
            {"$match": {"provider_id": supabase_id}},
            {"$group": {"_id": None, "total": {"$sum": "$hours"}}}
        ]
        agg_hours = list(db.completed_services.aggregate(pipeline_hours))
        total_hours_worked = agg_hours[0]["total"] if agg_hours else 0
        
        # Update provider_info stats to guarantee DB consistency and sync users collection if needed
        if profile:
            db.provider_info.update_one(
                {"supabase_id": supabase_id},
                {"$set": {
                    "completed_jobs": completed_jobs,
                    "total_earnings": total_earnings,
                    "total_hours_worked": total_hours_worked
                }}
            )
            
            # Sync user profile in case user table is out of date
            user_doc = db.users.find_one({"supabase_id": supabase_id})
            if user_doc:
                db.provider_info.update_one(
                    {"supabase_id": supabase_id},
                    {"$set": {
                        "name": user_doc.get("name") or profile.get("name"),
                        "phone": user_doc.get("phone") or profile.get("phone"),
                        "email": user_doc.get("email") or profile.get("email"),
                        "location": user_doc.get("location") or profile.get("location"),
                        "avatar_url": user_doc.get("avatar_url") or profile.get("avatar_url")
                    }}
                )
                # Refetch to keep returned profile completely synced
                profile = provider_model.get_provider_by_supabase_id(supabase_id)
                if profile:
                    profile["_id"] = str(profile["_id"])
            
            # Populate computed fields into profile mapping response
            profile["total_jobs"] = total_jobs
            profile["completed_jobs"] = completed_jobs
            profile["total_earnings"] = total_earnings
            profile["total_hours_worked"] = total_hours_worked
            profile["active_requests"] = active_requests_count
            
        return jsonify({
            "success": True, 
            "profile": profile,
            "services": services
        })
    except Exception as e:
        print(f"!!! API ERROR (get_provider_profile): {str(e)}")
        return jsonify({"error": str(e)}), 500
        
@app.route("/api/providers/availability", methods=["POST"])
def update_provider_availability():
    try:
        data = request.json
        supabase_id = data.get("supabase_id")
        availability = data.get("availability")
        print(f"--- API: Updating availability for provider: {supabase_id} to {availability} ---")
        
        provider_model.update_availability(supabase_id, availability)
        return jsonify({"success": True})
    except Exception as e:
        print(f"!!! API ERROR (update_provider_availability): {str(e)}")
        return jsonify({"error": str(e)}), 500

def build_enriched_service_document(data, existing_id=None):
    from bson import ObjectId
    provider_supabase_id = data.get("provider_supabase_id")
    
    # 1. Fetch provider details from provider_info
    provider_doc = db.provider_info.find_one({"supabase_id": provider_supabase_id})
    provider_name = "Unknown Provider"
    provider_phone = ""
    provider_email = ""
    provider_location = ""
    provider_rating = 5.0
    reliability_score = 0.95
    review_count = 12
    cancellation_rate = 0.02
    
    if provider_doc:
        provider_name = provider_doc.get("name") or provider_name
        provider_phone = provider_doc.get("phone") or provider_phone
        provider_email = provider_doc.get("email") or provider_email
        provider_location = provider_doc.get("location") or provider_location
        provider_rating = float(provider_doc.get("rating") or provider_rating)
        reliability_score = float(provider_doc.get("reliability_score") or reliability_score)
        review_count = int(provider_doc.get("review_count") or review_count)
        cancellation_rate = float(provider_doc.get("cancellation_rate") or cancellation_rate)
        
    # Fallback/merge with users collection
    user_doc = db.users.find_one({"supabase_id": provider_supabase_id})
    if user_doc:
        if not provider_name or provider_name == "Unknown Provider":
            provider_name = user_doc.get("name") or provider_name
        if not provider_phone:
            provider_phone = user_doc.get("phone") or provider_phone
        if not provider_email:
            provider_email = user_doc.get("email") or provider_email
        if not provider_location:
            provider_location = user_doc.get("location") or provider_location

    service_name = data.get("service_name") or data.get("name") or "General Service"
    service_location = data.get("service_location") or data.get("location") or "Unknown"
    
    hourly_rate = data.get("hourly_rate")
    if hourly_rate is None:
        hourly_rate = data.get("pricing", {}).get("hourly_rate") or 0
    hourly_rate = float(hourly_rate)
    
    currency = data.get("currency") or data.get("pricing", {}).get("currency") or "USD"
    experience_years = int(data.get("experience_years") or 0)
    languages = data.get("languages", [])
    
    # Build complete snapshot service document
    enriched = {
        "provider_supabase_id": provider_supabase_id,
        "provider_name": provider_name,
        "provider_phone": provider_phone,
        "provider_email": provider_email,
        "provider_location": provider_location,
        "provider_rating": provider_rating,
        
        "service_name": service_name,
        "service_type": data.get("service_type") or "General",
        "specialization": data.get("specialization") or "",
        "description": data.get("description") or "",
        "service_location": service_location,
        "hourly_rate": hourly_rate,
        "currency": currency,
        "experience_years": experience_years,
        "languages": languages,
        
        # Legacy/Compatibility mappings to preserve existing frontend dashboard card/matching UI
        "name": provider_name,
        "location": service_location,
        "rating": provider_rating,
        "pricing": {
            "hourly_rate": hourly_rate,
            "currency": currency
        },
        "experience_years": experience_years,
        "languages": languages,
        "availability": data.get("availability") or ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        "reliability_score": reliability_score,
        "review_count": review_count,
        "cancellation_rate": cancellation_rate,
        "is_verified": True
    }
    
    if existing_id:
        enriched["service_id"] = str(existing_id)
        enriched["_id"] = ObjectId(existing_id)
        
    # Generate searchable_text using the vector store helper
    enriched["searchable_text"] = vector_manager.generate_searchable_text(enriched)
    return enriched

@app.route("/api/providers/service", methods=["POST"])
def add_provider_service():
    try:
        data = request.json
        print(f"--- API: Adding new provider service: {data.get('name')} ---")
        
        # Build enriched document
        enriched = build_enriched_service_document(data)
        
        # Insert into MongoDB
        result = db.service_providers.insert_one(enriched)
        inserted_id = result.inserted_id
        
        # Update with service_id field
        db.service_providers.update_one(
            {"_id": inserted_id},
            {"$set": {"service_id": str(inserted_id)}}
        )
        
        # Real-time upsert to ChromaDB
        vector_manager.upsert_service(db, str(inserted_id))
        
        return jsonify({"success": True, "id": str(inserted_id)})
    except Exception as e:
        print(f"!!! API ERROR (add_provider_service): {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/providers/services/<service_id>", methods=["PUT"])
def update_provider_service(service_id):
    try:
        from bson import ObjectId
        data = request.json
        print(f"--- API: Updating provider service: {service_id} ---")
        
        # Rebuild fully enriched document to capture any updated provider info as well as updated service info
        enriched = build_enriched_service_document(data, existing_id=service_id)
        
        # Remove _id from set to prevent modification error
        update_fields = {k: v for k, v in enriched.items() if k != "_id"}
        
        db.service_providers.update_one(
            {"_id": ObjectId(service_id)},
            {"$set": update_fields}
        )
        
        # Real-time upsert to ChromaDB
        vector_manager.upsert_service(db, service_id)
        
        return jsonify({"success": True, "message": "Service listing updated successfully."})
    except Exception as e:
        print(f"!!! API ERROR (update_provider_service): {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/providers/services/<service_id>", methods=["DELETE"])
def delete_provider_service(service_id):
    try:
        from bson import ObjectId
        print(f"--- API: Deleting provider service: {service_id} ---")
        
        result = db.service_providers.delete_one({"_id": ObjectId(service_id)})
        if result.deleted_count > 0:
            # Real-time delete from ChromaDB
            vector_manager.delete_service(service_id)
            return jsonify({"success": True, "message": "Service listing deleted successfully."})
            
        return jsonify({"error": "Service not found."}), 404
    except Exception as e:
        print(f"!!! API ERROR (delete_provider_service): {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route("/user/<supabase_id>", methods=["GET"])
def get_user(supabase_id):
    try:
        user = user_model.users.find_one({"supabase_id": supabase_id})
        if user:
            user["_id"] = str(user["_id"])
            return jsonify({"success": True, "user": user})
        return jsonify({"error": "User not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/conversations/<user_id>", methods=["GET"])
def get_conversations(user_id):
    try:
        print(f"--- API: Fetching conversations for user: {user_id} ---")
        convs = conv_model.get_user_conversations(user_id)
        return jsonify({"success": True, "conversations": convs})
    except Exception as e:
        print(f"!!! API ERROR (get_conversations): {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route("/conversations", methods=["POST"])
def create_conversation():
    try:
        data = request.json
        user_id = data.get("user_id")
        title = data.get("title", "New Orchestration")
        print(f"--- API: Creating NEW conversation: '{title}' for user: {user_id} ---")
        conv = conv_model.create_conversation(user_id, title)
        return jsonify({"success": True, "conversation": conv})
    except Exception as e:
        print(f"!!! API ERROR (create_conversation): {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route("/conversations/<conversation_id>", methods=["PUT"])
def update_conversation(conversation_id):
    try:
        data = request.json
        conv_model.conversations.update_one(
            {"_id": ObjectId(conversation_id)},
            {"$set": data}
        )
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/conversations/<conversation_id>/context", methods=["GET"])
def get_conversation_context(conversation_id):
    try:
        print(f"--- API: Hydrating CONTEXT for: {conversation_id} ---")
        # Load from LangGraph Checkpointer
        config = {"configurable": {"thread_id": conversation_id}}
        state = graph.get_state(config)
        
        # Load messages from Chat History
        messages_data = conv_model.get_full_context(conversation_id)
        messages = messages_data.get("messages", [])
        
        # Merge LangGraph state into context
        context = {
            "messages": [
                {
                    "id": str(m.get("_id", i)),
                    "role": m.get("role"),
                    "content": m.get("content"),
                    "agent": m.get("agent"),
                    "timestamp": m.get("timestamp").isoformat() if m.get("timestamp") else None
                } for i, m in enumerate(messages)
            ],
            "shared_state": serialize_value(state.values) if state.values else {},
            "logs": serialize_value(state.values.get("execution_logs", [])) if state.values else [],
            "traces": serialize_value(state.values.get("reasoning_traces", [])) if state.values else [],
            "active_agent": state.values.get("active_agent", "supervisor") if state.values else "supervisor"
        }
        return jsonify({"success": True, "context": context})
    except Exception as e:
        print(f"!!! API ERROR (get_conversation_context): {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route("/conversations/<conversation_id>", methods=["DELETE"])
def delete_conversation(conversation_id):
    try:
        print(f"--- API: DELETING conversation: {conversation_id} ---")
        conv_model.delete_conversation(conversation_id)
        return jsonify({"success": True, "message": "Conversation deleted successfully"})
    except Exception as e:
        print(f"!!! API ERROR (delete_conversation): {str(e)}")
        return jsonify({"error": str(e)}), 500

# ============================================================
# PROVIDER REQUEST & BOOKING LIFE-CYCLE ENDPOINTS
# ============================================================
from bson import ObjectId
from datetime import datetime

@app.route("/api/providers/requests/<provider_supabase_id>", methods=["GET"])
def get_provider_requests(provider_supabase_id):
    try:
        print(f"--- API: Fetching incoming requests for provider: {provider_supabase_id} ---")
        requests_cursor = db.active_requests.find({"provider_supabase_id": provider_supabase_id}).sort("created_at", -1)
        active_reqs = []
        for r in requests_cursor:
            r["_id"] = str(r["_id"])
            if "created_at" in r and isinstance(r["created_at"], datetime):
                r["created_at"] = r["created_at"].isoformat()
            if "updated_at" in r and isinstance(r["updated_at"], datetime):
                r["updated_at"] = r["updated_at"].isoformat()
            active_reqs.append(r)
        return jsonify({"success": True, "requests": active_reqs})
    except Exception as e:
        print(f"!!! API ERROR (get_provider_requests): {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/providers/requests/<request_id>", methods=["DELETE"])
def delete_provider_request(request_id):
    try:
        print(f"--- API: DELETING request record: {request_id} ---")
        result = db.active_requests.delete_one({"_id": ObjectId(request_id)})
        if result.deleted_count > 0:
            return jsonify({"success": True, "message": "Request record deleted successfully"})
        return jsonify({"error": "Request record not found"}), 404
    except Exception as e:
        print(f"!!! API ERROR (delete_provider_request): {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/providers/requests/<request_id>/respond", methods=["POST"])
def respond_to_request(request_id):
    try:
        data = request.json
        status = data.get("status")  # 'approved', 'denied', or 'counter_offer'
        print(f"--- API: Provider responding to request {request_id} with status: {status} ---")
        
        update_fields = {
            "status": status,
            "updated_at": datetime.utcnow()
        }
        
        if status == "counter_offer":
            update_fields.update({
                "counter_price": data.get("counter_price"),
                "counter_date": data.get("counter_date"),
                "counter_time": data.get("counter_time"),
                "counter_note": data.get("counter_note")
            })
            
        db.active_requests.update_one(
            {"_id": ObjectId(request_id)},
            {"$set": update_fields}
        )
        
        # Fetch request details to build notification / booking
        req_doc = db.active_requests.find_one({"_id": ObjectId(request_id)})
        if not req_doc:
            return jsonify({"error": "Request not found"}), 404
            
        customer_id = req_doc.get("customer_supabase_id")
        conversation_id = req_doc.get("conversation_id")
        
        # Try resolving from conversation collection if anonymous
        if (not customer_id or customer_id == 'anonymous') and conversation_id:
            try:
                conv_doc = db.conversations.find_one({"_id": ObjectId(conversation_id)})
                if conv_doc and conv_doc.get("user_id"):
                    customer_id = conv_doc.get("user_id")
                    # Update active_requests collection to keep DB state clean
                    db.active_requests.update_one(
                        {"_id": ObjectId(request_id)},
                        {"$set": {"customer_supabase_id": customer_id}}
                    )
                    print(f"[RESPOND API] Resolved real customer_id={customer_id} from conversations and synced active_requests.")
            except Exception as conv_err:
                print(f"[RESPOND API] Failed to resolve conversation user_id: {conv_err}")
        
        # If approved, insert into permanent bookings collection
        if status == "approved":
            final_price = req_doc.get("counter_price") or req_doc.get("offered_price")
            final_date = req_doc.get("counter_date") or req_doc.get("requested_date")
            final_time = req_doc.get("counter_time") or req_doc.get("requested_time")
            
            # Retrieve complete Provider details from provider_info or req_doc
            provider_supabase_id = req_doc.get("provider_supabase_id")
            prov_doc = db.provider_info.find_one({"supabase_id": provider_supabase_id})
            
            provider_name = req_doc.get("provider_name")
            provider_phone = "Not provided"
            provider_email = "Not provided"
            provider_location = "Not provided"
            provider_avatar = ""
            
            if prov_doc:
                provider_name = prov_doc.get("name") or provider_name
                provider_phone = prov_doc.get("phone") or provider_phone
                provider_email = prov_doc.get("email") or provider_email
                provider_location = prov_doc.get("location") or provider_location
                provider_avatar = prov_doc.get("avatar_url") or provider_avatar
            
            # Retrieve complete Customer details from users or req_doc
            cust_doc = db.users.find_one({"supabase_id": customer_id})
            
            customer_name = req_doc.get("customer_name")
            customer_phone = req_doc.get("customer_phone") or "Not provided"
            customer_email = req_doc.get("customer_email") or "Not provided"
            customer_location = req_doc.get("customer_location") or "Not provided"
            customer_avatar = req_doc.get("customer_avatar") or ""
            
            if cust_doc:
                customer_name = cust_doc.get("name") or customer_name
                customer_phone = cust_doc.get("phone") or customer_phone
                customer_email = cust_doc.get("email") or customer_email
                customer_location = cust_doc.get("location") or customer_location
                customer_avatar = cust_doc.get("avatar_url") or customer_avatar
            
            booking_doc = {
                # Provider Snapshot
                "provider_supabase_id": provider_supabase_id,
                "provider_name": provider_name,
                "provider_phone": provider_phone,
                "provider_email": provider_email,
                "provider_location": provider_location,
                "provider_avatar": provider_avatar,
                
                # Customer Snapshot
                "customer_supabase_id": customer_id,
                "customer_name": customer_name,
                "customer_phone": customer_phone,
                "customer_email": customer_email,
                "customer_location": customer_location,
                "customer_avatar": customer_avatar,
                
                # Service Details
                "service_type": req_doc.get("service_type"),
                "specialization": req_doc.get("specialization") or req_doc.get("service_type"),
                "offered_price": req_doc.get("offered_price"),
                "price": final_price,
                "requested_date": final_date,
                "requested_time": final_time,
                "location": req_doc.get("location") or customer_location,
                "status": "confirmed",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "conversation_id": conversation_id
            }
            
            db.bookings.insert_one(booking_doc)
            print(f"[BOOKINGS] Inserted complete snapshot booking document for customer={customer_id}, provider={provider_supabase_id}")
            
        # Create user notification in follow_up collection
        title = "Request Approved!" if status == "approved" else ("New Counter Offer" if status == "counter_offer" else "Request Denied")
        message = f"Your request for {req_doc.get('service_type')} has been approved by the provider." if status == "approved" else (
            f"Provider countered with ${data.get('counter_price')} for {data.get('counter_date')} at {data.get('counter_time')}." if status == "counter_offer" else
            f"Your request for {req_doc.get('service_type')} was declined."
        )
        
        notif_doc = {
            "user_supabase_id": customer_id,
            "title": title,
            "message": message,
            "type": status,
            "request_id": request_id,
            "status": "unread",
            "created_at": datetime.utcnow()
        }
        db.follow_up.insert_one(notif_doc)
        
        print(f"[REQUEST] Provider updated request {request_id} to status: {status}")

        # Send proactive chat message inside the active conversation in real-time
        if conversation_id:
            try:
                # Format proactive message based on status
                if status == "approved":
                    agent_message = f"Your request has been approved by {req_doc.get('specialization') or 'the provider'}. I have successfully booked your slot!"
                elif status == "denied":
                    agent_message = f"Apologies, but your request for {req_doc.get('service_type')} was declined by the provider."
                elif status == "counter_offer":
                    agent_message = f"{req_doc.get('specialization') or 'The provider'} has proposed an updated offer:\nPrice: ${data.get('counter_price')}/hr\nTime: {data.get('counter_date')}, {data.get('counter_time')}\n\nWould you like to accept this updated offer?"
                else:
                    agent_message = f"Your service request status is now: {status}."

                # Add to DB conversation_messages
                conv_model.add_message(conversation_id, "assistant", agent_message, agent="Frontier Agent")
                
                # Emit chat_message event so the chat panel updates instantly
                socketio.emit('chat_message', {
                    'role': 'assistant',
                    'content': agent_message,
                    'agent': 'Frontier Agent',
                    'conversation_id': conversation_id
                })
                print(f"[ORCHESTRATOR] Successfully sent proactive agent message for request status update: '{status}'")
            except Exception as msg_err:
                print(f"[RESPOND API] Failed to send proactive assistant message: {msg_err}")

        # Natively sync LangGraph thread checkpoints to avoid stale memory
        conversation_id = req_doc.get("conversation_id")
        if conversation_id:
            print(f"[SYNC] Refreshing shared state for conversation/thread: {conversation_id}")
            config = {"configurable": {"thread_id": conversation_id}}
            try:
                latest_state = graph.get_state(config)
                if latest_state.values:
                    booking_details = latest_state.values.get("booking_details", {}) or {}
                    updated_booking = {
                        **booking_details,
                        "request_id": request_id,
                        "status": status,
                        "offered_price": data.get("counter_price") if status == "counter_offer" else req_doc.get("offered_price"),
                        "requested_date": data.get("counter_date") if status == "counter_offer" else req_doc.get("requested_date"),
                        "requested_time": data.get("counter_time") if status == "counter_offer" else req_doc.get("requested_time"),
                        "provider_name": req_doc.get("specialization") or "Provider"
                    }
                    
                    # Compute stages dynamically
                    new_stage = "selection" if status in ("counter_offer", "denied") else "completion"
                    new_workflow = "discovery" if status == "denied" else "booking_initiation"
                    
                    new_values = {
                        "booking_details": updated_booking,
                        "active_request_id": request_id,
                        "latest_request_status": status,
                        "last_provider_response": data.get("counter_note") or data.get("provider_note") or "",
                        "negotiation_stage": status,
                        "conversation_stage": new_stage,
                        "workflow_stage": new_workflow
                    }
                    
                    # Dynamic state checkpointer injection
                    graph.update_state(config, new_values, as_node="booking")
                    print(f"[SYNC] Shared state refreshed successfully inside checkpoint thread.")
            except Exception as graph_err:
                print(f"[RESPOND API] Failed to update LangGraph checkpointer state: {graph_err}")

        # Store and Emit real-time notifications
        try:
            db.notifications.insert_one({
                "user_supabase_id": customer_id,
                "role": "buyer",
                "type": status,
                "title": title,
                "message": message,
                "related_id": request_id,
                "status": "unread",
                "created_at": datetime.now()
            })
            socketio.emit('booking_notification', {
                "user_supabase_id": customer_id,
                "title": title,
                "message": message,
                "type": status,
                "request_id": request_id
            })
            print(f"[RESPOND API] Saved & emitted booking_notification for user: {customer_id}")
        except Exception as notif_err:
            print(f"[RESPOND API] Notification insert/emit skipped or failed: {notif_err}")

        # Emit the requested realtime request_updated socket event
        try:
            payload = {
                "request_id": request_id,
                "status": status,
                "offered_price": data.get("counter_price") if status == "counter_offer" else req_doc.get("offered_price"),
                "requested_date": data.get("counter_date") if status == "counter_offer" else req_doc.get("requested_date"),
                "requested_time": data.get("counter_time") if status == "counter_offer" else req_doc.get("requested_time"),
                "provider_note": data.get("counter_note") or data.get("provider_note") or ""
            }
            socketio.emit('request_updated', payload)
            print(f"[SOCKET] request_updated emitted: {payload}")
        except Exception as socket_err2:
            print(f"[RESPOND API] Socket emit request_updated failed: {socket_err2}")
            
        # Clean up active requests upon terminal state transitions (approved or denied)
        if status in ("approved", "denied"):
            try:
                db.active_requests.delete_one({"_id": ObjectId(request_id)})
                print(f"[CLEANUP] Deleted request {request_id} from active_requests after status transitions to {status}.")
            except Exception as cleanup_err:
                print(f"[CLEANUP] Error removing request from active_requests: {cleanup_err}")
                
        return jsonify({"success": True})
    except Exception as e:
        print(f"!!! API ERROR (respond_to_request): {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/bookings/customer/<customer_supabase_id>", methods=["GET"])
def get_customer_bookings(customer_supabase_id):
    try:
        bookings = list(db.bookings.find({"customer_supabase_id": customer_supabase_id}).sort("created_at", -1))
        for b in bookings:
            b["_id"] = str(b["_id"])
            if "created_at" in b and isinstance(b["created_at"], datetime):
                b["created_at"] = b["created_at"].isoformat()
        return jsonify({"success": True, "bookings": bookings})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/bookings/provider/<provider_supabase_id>", methods=["GET"])
def get_provider_bookings(provider_supabase_id):
    try:
        bookings = list(db.bookings.find({"provider_supabase_id": provider_supabase_id}).sort("created_at", -1))
        for b in bookings:
            b["_id"] = str(b["_id"])
            if "created_at" in b and isinstance(b["created_at"], datetime):
                b["created_at"] = b["created_at"].isoformat()
        return jsonify({"success": True, "bookings": bookings})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/bookings/<booking_id>/complete", methods=["POST"])
def complete_booking(booking_id):
    try:
        from bson import ObjectId
        data = request.json
        rating = data.get("rating", 5)
        feedback = data.get("feedback", "")

        booking = db.bookings.find_one({"_id": ObjectId(booking_id)})
        if not booking:
            return jsonify({"error": "Booking not found"}), 404

        # Save to completed_services
        db.completed_services.insert_one({
            "booking_id": booking_id,
            "customer_id": booking.get("customer_supabase_id"),
            "provider_id": booking.get("provider_supabase_id"),
            "rating": rating,
            "feedback": feedback,
            "completed_at": datetime.now()
        })

        # Update provider stats (rating from customer)
        provider_model.complete_job(booking.get("provider_supabase_id"), float(rating), hours=0, earnings=0)

        # Update booking status
        db.bookings.update_one({"_id": ObjectId(booking_id)}, {"$set": {"status": "completed"}})
        
        # Send Notification to Provider
        db.notifications.insert_one({
            "user_supabase_id": booking.get("provider_supabase_id"),
            "role": "seller",
            "type": "completed",
            "title": "Job Completed",
            "message": f"Customer marked your {booking.get('service_type')} job as completed and left a {rating}-star rating.",
            "related_id": booking_id,
            "status": "unread",
            "created_at": datetime.now()
        })
        socketio.emit('booking_notification', {"user_supabase_id": booking.get("provider_supabase_id")})

        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/bookings/<booking_id>/provider-complete", methods=["POST"])
def provider_complete_booking(booking_id):
    try:
        from bson import ObjectId
        data = request.json
        hours = data.get("hours_worked", 0)
        earnings = data.get("total_earned", 0)
        note = data.get("note", "")

        booking = db.bookings.find_one({"_id": ObjectId(booking_id)})
        if not booking:
            return jsonify({"error": "Booking not found"}), 404

        # Save to completed_services
        db.completed_services.insert_one({
            "booking_id": booking_id,
            "customer_id": booking.get("customer_supabase_id"),
            "provider_id": booking.get("provider_supabase_id"),
            "hours": hours,
            "earnings": earnings,
            "provider_note": note,
            "completed_by": "provider",
            "completed_at": datetime.now()
        })

        # Update provider stats (no new rating yet, so pass current or just 5)
        # We will assume they just get hours and earnings, rating remains same via logic in model (or pass 5 to average it out, but best is to just ignore rating shift. Our complete_job averages it, we can just pass current rating).
        provider_doc = db.provider_info.find_one({"supabase_id": booking.get("provider_supabase_id")})
        current_rating = provider_doc.get("rating", 5.0) if provider_doc else 5.0
        provider_model.complete_job(booking.get("provider_supabase_id"), current_rating, hours=hours, earnings=earnings)

        # Update booking status
        db.bookings.update_one({"_id": ObjectId(booking_id)}, {"$set": {"status": "completed"}})
        
        # Send Notification to Customer
        db.notifications.insert_one({
            "user_supabase_id": booking.get("customer_supabase_id"),
            "role": "buyer",
            "type": "completed",
            "title": "Job Completed",
            "message": f"Provider marked your {booking.get('service_type')} job as completed.",
            "related_id": booking_id,
            "status": "unread",
            "created_at": datetime.now()
        })
        socketio.emit('booking_notification', {"user_supabase_id": booking.get("customer_supabase_id")})

        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/bookings/<booking_id>", methods=["DELETE"])
def delete_booking(booking_id):
    try:
        from bson import ObjectId
        result = db.bookings.delete_one({"_id": ObjectId(booking_id)})
        if result.deleted_count == 0:
            return jsonify({"error": "Booking not found"}), 404
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/bookings/<booking_id>/cancel", methods=["POST"])
def cancel_booking(booking_id):
    try:
        from bson import ObjectId
        data = request.json
        user_id = data.get("user_supabase_id") # Who canceled it
        role = data.get("role") # buyer or seller

        booking = db.bookings.find_one({"_id": ObjectId(booking_id)})
        if not booking:
            return jsonify({"error": "Booking not found"}), 404

        # Update booking status to cancelled
        db.bookings.update_one({"_id": ObjectId(booking_id)}, {"$set": {"status": "cancelled"}})
        
        # Determine who to notify
        target_id = booking.get("provider_supabase_id") if role == "buyer" else booking.get("customer_supabase_id")
        target_role = "seller" if role == "buyer" else "buyer"
        
        # Send Notification
        db.notifications.insert_one({
            "user_supabase_id": target_id,
            "role": target_role,
            "type": "cancelled",
            "title": "Booking Cancelled",
            "message": f"The {'customer' if role == 'buyer' else 'provider'} has cancelled the {booking.get('service_type')} booking.",
            "related_id": booking_id,
            "status": "unread",
            "created_at": datetime.now()
        })
        socketio.emit('booking_notification', {"user_supabase_id": target_id})

        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/notifications/<user_supabase_id>", methods=["GET"])
def get_user_notifications(user_supabase_id):
    try:
        notifs_cursor = db.notifications.find({"user_supabase_id": user_supabase_id}).sort("created_at", -1)
        notifs = []
        for n in notifs_cursor:
            n["_id"] = str(n["_id"])
            if "created_at" in n and isinstance(n["created_at"], datetime):
                n["created_at"] = n["created_at"].isoformat()
            notifs.append(n)
        return jsonify({"success": True, "notifications": notifs})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/notifications/read", methods=["PUT"])
def mark_notifications_read():
    try:
        data = request.json
        user_supabase_id = data.get("user_supabase_id")
        db.notifications.update_many(
            {"user_supabase_id": user_supabase_id, "status": "unread"},
            {"$set": {"status": "read"}}
        )
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/notifications/<notif_id>", methods=["DELETE"])
def delete_notification(notif_id):
    try:
        from bson import ObjectId
        db.notifications.delete_one({"_id": ObjectId(notif_id)})
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/notifications/clear/<user_supabase_id>", methods=["DELETE"])
def clear_all_notifications(user_supabase_id):
    try:
        db.notifications.delete_many({"user_supabase_id": user_supabase_id})
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    print("\n" + "="*50)
    print("FLOWTICA AI ORCHESTRATION ENGINE STARTING")
    print(f"Host: 0.0.0.0 | Port: 5000")
    print("="*50 + "\n")
    # Disable debug mode to prevent socket reloader issues on Windows
    socketio.run(app, host="0.0.0.0", port=5000, debug=False, allow_unsafe_werkzeug=True)