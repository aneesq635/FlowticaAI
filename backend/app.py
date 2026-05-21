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
import googlemaps

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = 'flowtica-secret'
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading', allow_upgrades=False)

# Initialize Google Maps Client
gmaps = None
if os.getenv("GOOGLE_MAPS_API_KEY"):
    try:
        gmaps = googlemaps.Client(key=os.getenv("GOOGLE_MAPS_API_KEY"))
        print("[STARTUP DIAGNOSTIC] Google Maps Client initialized.")
    except Exception as gmaps_err:
        print(f"[STARTUP DIAGNOSTIC] WARNING: Google Maps initialization failed: {gmaps_err}")

# Initialize Logger with SocketIO
logger.socketio = socketio

@socketio.on('join')
def on_join(data):
    user_id = data.get('userId')
    if user_id:
        from flask_socketio import join_room
        join_room(user_id)
        print(f"[SOCKET] User {user_id} joined room: {user_id}")

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


 
def finalize_negotiation_resolution(request_id, active_request, action="accepted"):
    """
    Standardized finalization of a negotiation into a confirmed booking.
    Ensures transactional consistency between active_request and booking collections.
    """
    try:
        from bson import ObjectId
        customer_id = active_request.get("customer_supabase_id")
        provider_id = active_request.get("provider_supabase_id")
        conversation_id = active_request.get("conversation_id")
        
        if action == "accepted":
            final_price = active_request.get("counter_offer_price") or active_request.get("offered_price")
            final_date = active_request.get("counter_offer_date") or active_request.get("requested_date")
            final_time = active_request.get("counter_offer_time") or active_request.get("requested_time")
            
            # Deep Snapshot from Source-of-Truth
            service_snap = db.service_providers.find_one({
                "provider_supabase_id": provider_id,
                "service_type": active_request.get("service_type")
            })
            cust_snap = db.users.find_one({"supabase_id": customer_id})
            
            booking_doc = {
                "active_request_id": str(request_id),
                "conversation_id": conversation_id,
                "customer_supabase_id": customer_id,
                "provider_supabase_id": provider_id,
                "service_type": active_request.get("service_type"),
                "scheduled_time": f"{final_date}T{final_time}",
                "requested_date": final_date,
                "requested_time": final_time,
                "price": final_price,
                "status": "confirmed",
                "confirmed_at": datetime.utcnow(),
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "snapshot": {
                    "provider_name": service_snap.get("provider_name") if service_snap else active_request.get("provider_name"),
                    "provider_phone": service_snap.get("provider_phone") if service_snap else active_request.get("provider_phone"),
                    "provider_avatar": service_snap.get("provider_avatar") if service_snap else active_request.get("provider_avatar"),
                    "provider_location_data": service_snap.get("provider_location_data") if service_snap else active_request.get("provider_location_data"),
                    "customer_name": cust_snap.get("name") if cust_snap else active_request.get("customer_name"),
                    "customer_phone": cust_snap.get("phone") if cust_snap else active_request.get("customer_phone"),
                    "customer_avatar": cust_snap.get("avatar_url") if cust_snap else active_request.get("customer_avatar"),
                    "customer_location_data": cust_snap.get("location_data") if cust_snap else active_request.get("customer_location_data")
                }
            }
            db.bookings.insert_one(booking_doc)
            
            # Availability block
            db.provider_availability.update_one(
                {"provider_supabase_id": provider_id},
                {"$push": {f"booked_slots.{final_date}": final_time}},
                upsert=True
            )
            
            # Notification logic (for Provider Dashboard)
            db.follow_up.insert_one({
                "user_supabase_id": provider_id,
                "role": "seller",
                "type": "booking_confirmed",
                "title": "Booking Confirmed!",
                "message": f"Customer accepted your counter offer for {active_request.get('service_type')}.",
                "related_id": str(request_id),
                "created_at": datetime.utcnow()
            })
            
            # Update active_request status
            history_entry = {
                "role": "customer",
                "action": "accept",
                "timestamp": datetime.utcnow()
            }
            db.active_requests.update_one(
                {"_id": ObjectId(request_id)},
                {
                    "$set": {"status": "confirmed", "updated_at": datetime.utcnow()},
                    "$push": {"negotiation_history": history_entry}
                }
            )
            
            # Standardized Payloads to BOTH rooms
            socketio.emit("request_status_updated", {
                "request_id": str(request_id),
                "status": "confirmed"
            }, room=provider_id)
            
            socketio.emit("booking_confirmed", {
                "request_id": str(request_id),
                "conversation_id": conversation_id,
                "status": "confirmed"
            }, room=customer_id)
            
            # Persist into chat history
            if conversation_id:
                conv_model.add_message(
                    conversation_id,
                    "system",
                    "Counter offer accepted. Booking confirmed.",
                    metadata={"type": "counter_offer_accepted", "request_id": str(request_id)}
                )
            return True
        else:
            # Rejection flow
            history_entry = {
                "role": "customer",
                "action": "reject",
                "timestamp": datetime.utcnow()
            }
            db.active_requests.update_one(
                {"_id": ObjectId(request_id)},
                {
                    "$set": {"status": "rejected", "updated_at": datetime.utcnow()},
                    "$push": {"negotiation_history": history_entry}
                }
            )
            socketio.emit('request_status_updated', {"request_id": str(request_id), "status": "rejected"}, room=provider_id)
            socketio.emit('request_status_updated', {"request_id": str(request_id), "status": "rejected"}, room=customer_id)
            return True
    except Exception as e:
        print(f"[NEGOTIATION RESOLUTION ERROR] {e}")
        return False

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
            
    print(f"[ORCHESTRATOR] User ID: {user_id}")
    print(f"[ORCHESTRATOR] Target Socket SID: {socketio_sid}")

    # --- PHASE C.1: HIGH-PRIORITY NEGOTIATION CHECK ---
    # Intercept acceptance intents to prevent AI fallback into provider search
    try:
        from bson import ObjectId
        active_neg = db.active_requests.find_one({
            "conversation_id": conversation_id,
            "status": "countered"
        })
        
        if active_neg:
            acceptance_tokens = {"accept", "ok", "confirm", "yes", "deal", "yup", "yeah", "yep", "sure", "confirmed", "okay", "i accept"}
            msg_clean = message_text.lower().strip().rstrip('.!?*() ')
            if any(token in msg_clean for token in acceptance_tokens):
                print(f"[ORCHESTRATOR] Detected acceptance for active negotiation: {active_neg['_id']}")
                success = finalize_negotiation_resolution(active_neg['_id'], active_neg, action="accepted")
                if success:
                    # Inform frontend via legacy chat_message so the UI updates
                    socketio.emit('chat_message', {
                        'role': 'assistant',
                        'content': "Counter-offer accepted! Your booking has been confirmed.",
                        'agent': 'Orchestrator',
                        'conversation_id': conversation_id,
                        'type': 'counter_offer_accepted'
                    }, room=user_id)
                    return # EXIT EARLY - DO NOT RUN GRAPH
    except Exception as neg_inter_err:
        print(f"[ORCHESTRATOR WARNING] Negotiation interception failed: {neg_inter_err}")



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
                    # Get shortlisted providers for UI cards (Phase 3)
                    full_state = graph.get_state(config).values
                    shortlist = serialize_value(full_state.get("shortlisted_providers", []))

                    custom_emit('chat_message', {
                        'role': 'assistant',
                        'content': content,
                        'agent': 'Frontier Agent',
                        'conversation_id': conversation_id,
                        'providers': shortlist
                    })
                    has_emitted_final_reply = True
                    final_reply_text = content
                    print("[SOCKET] Final response emitted successfully via node delta.")
                    
                    if conversation_id:
                        conv_model.add_message(
                            conversation_id, "assistant", content, 
                            agent="Frontier Agent", 
                            metadata={"providers": shortlist}
                        )

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
                    # Get shortlisted providers for UI cards (Phase 3)
                    shortlist = serialize_value(final_state.get("shortlisted_providers", []))

                    custom_emit('chat_message', {
                        'role': 'assistant',
                        'content': content,
                        'agent': 'Frontier Agent',
                        'conversation_id': conversation_id,
                        'providers': shortlist
                    })
                    has_emitted_final_reply = True
                    final_reply_text = content
                    print("[SOCKET] Fallback response emitted successfully.")
                    if conversation_id:
                        conv_model.add_message(
                            conversation_id, "assistant", content, 
                            agent="Frontier Agent", 
                            metadata={"providers": shortlist}
                        )
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
# Location & Geocoding Endpoints
# ---------------------------------------------------------------------------

@app.route("/api/location/geocode", methods=["POST"])
def geocode_address():
    """Converts a street address to latitude/longitude coordinates."""
    if not gmaps:
        return jsonify({"success": False, "error": "Google Maps API not configured"}), 500
    
    data = request.json or {}
    address = data.get("address")
    if not address:
        return jsonify({"success": False, "error": "Address is required"}), 400

    try:
        geocode_result = gmaps.geocode(address)
        if not geocode_result:
            return jsonify({"success": False, "error": "No results found for this address"}), 404
        
        result = geocode_result[0]
        location = result['geometry']['location']
        
        # Extract city and country if possible
        city = ""
        country = ""
        for component in result['address_components']:
            if "locality" in component['types']:
                city = component['long_name']
            if "country" in component['types']:
                country = component['long_name']

        return jsonify({
            "success": True,
            "location_data": {
                "address": result.get('formatted_address', address),
                "city": city,
                "country": country,
                "latitude": location['lat'],
                "longitude": location['lng']
            }
        }), 200
    except Exception as e:
        print(f"[GEOCODE ERROR] {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/location/reverse-geocode", methods=["POST"])
def reverse_geocode():
    """Converts latitude/longitude coordinates to a street address."""
    if not gmaps:
        return jsonify({"success": False, "error": "Google Maps API not configured"}), 500
    
    data = request.json or {}
    lat = data.get("latitude")
    lng = data.get("longitude")
    
    if lat is None or lng is None:
        return jsonify({"success": False, "error": "Latitude and longitude are required"}), 400

    try:
        reverse_result = gmaps.reverse_geocode((lat, lng))
        if not reverse_result:
            return jsonify({"success": False, "error": "No results found for these coordinates"}), 404
        
        result = reverse_result[0]
        
        # Extract city and country
        city = ""
        country = ""
        for component in result['address_components']:
            if "locality" in component['types']:
                city = component['long_name']
            if "country" in component['types']:
                country = component['long_name']

        return jsonify({
            "success": True,
            "location_data": {
                "address": result.get('formatted_address'),
                "city": city,
                "country": country,
                "latitude": lat,
                "longitude": lng
            }
        }), 200
    except Exception as e:
        print(f"[REVERSE GEOCODE ERROR] {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/location/autocomplete", methods=["POST"])
def place_autocomplete():
    """Provides location suggestions based on user input using Places API (New)."""
    google_api_key = os.getenv("GOOGLE_MAPS_API_KEY")
    if not google_api_key:
        return jsonify({"success": False, "error": "Google Maps API Key not configured"}), 500
    
    try:
        data = request.json or {}
        input_text = data.get("input")
        if not input_text:
            return jsonify({"success": False, "error": "Input text is required"}), 400
            
        url = "https://places.googleapis.com/v1/places:autocomplete"
        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": google_api_key,
        }
        
        # biasing to Pakistan (PK) for Flowtica
        payload = {
            "input": input_text,
            "includedRegionCodes": ["pk"]
        }
        
        import requests
        resp = requests.post(url, headers=headers, json=payload)
        resp_data = resp.json()
        
        if resp.status_code == 200:
            # Map API (New) response format to expected frontend format
            # API (New) returns 'suggestions' with 'placePrediction'
            suggestions = resp_data.get("suggestions", [])
            predictions = []
            for s in suggestions:
                p = s.get("placePrediction", {})
                predictions.append({
                    "description": p.get("text", {}).get("text"),
                    "place_id": p.get("placeId")
                })
                
            return jsonify({
                "success": True,
                "predictions": predictions
            }), 200
        else:
            print(f"[AUTOCOMPLETE ERROR] Status: {resp.status_code}, Body: {resp.text}")
            return jsonify({"success": False, "error": resp_data.get("error", {}).get("message", "API Error")}), resp.status_code
            
    except Exception as e:
        print(f"[AUTOCOMPLETE ERROR] {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/location/details", methods=["POST"])
def place_details():
    """Fetches full coordinates and formatted address using Places API (New)."""
    google_api_key = os.getenv("GOOGLE_MAPS_API_KEY")
    if not google_api_key:
        return jsonify({"success": False, "error": "Google Maps API Key not configured"}), 500
        
    try:
        data = request.json or {}
        place_id = data.get("place_id")
        if not place_id:
            return jsonify({"success": False, "error": "Place ID is required"}), 400
            
        url = f"https://places.googleapis.com/v1/places/{place_id}"
        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": google_api_key,
            "X-Goog-FieldMask": "id,location,formattedAddress,addressComponents"
        }
        
        import requests
        resp = requests.get(url, headers=headers)
        resp_data = resp.json()
        
        if resp.status_code == 200:
            lat = resp_data.get("location", {}).get("latitude")
            lng = resp_data.get("location", {}).get("longitude")
            address = resp_data.get("formattedAddress")
            
            city = ""
            country = ""
            # Extract city/country from addressComponents (New format)
            for component in resp_data.get("addressComponents", []):
                types = component.get("types", [])
                if "locality" in types:
                    city = component.get("longText")
                if "country" in types:
                    country = component.get("longText")

            location_data = {
                "address": address,
                "city": city,
                "country": country,
                "latitude": lat,
                "longitude": lng
            }
            
            return jsonify({
                "success": True,
                "location_data": location_data
            }), 200
        else:
            print(f"[PLACE DETAILS ERROR] Status: {resp.status_code}, Body: {resp.text}")
            return jsonify({"success": False, "error": resp_data.get("error", {}).get("message", "API Error")}), resp.status_code
            
    except Exception as e:
        print(f"[PLACE DETAILS ERROR] {e}")
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
    # 0. Initial values from Payload (Priority 1 for Phone)
    provider_supabase_id = data.get("provider_supabase_id")
    provider_phone = data.get("phone") or ""
    
    # 1. Fetch provider details from provider_info
    provider_doc = db.provider_info.find_one({"supabase_id": provider_supabase_id})
    provider_name = "Unknown Provider"
    provider_email = ""
    provider_location = ""
    provider_rating = 0.0
    reliability_score = 0.0
    review_count = 0
    cancellation_rate = 0.0
    provider_location_data = {}
    
    if provider_doc:
        provider_name = provider_doc.get("name") or provider_name
        if not provider_phone:
            provider_phone = provider_doc.get("phone") or ""
        provider_email = provider_doc.get("email") or provider_email
        provider_location = provider_doc.get("location") or provider_location
        provider_location_data = provider_doc.get("location_data") or {}
        provider_rating = float(provider_doc.get("rating") or 0.0)
        reliability_score = float(provider_doc.get("reliability_score") or 0.0)
        review_count = int(provider_doc.get("review_count") or 0)
        cancellation_rate = float(provider_doc.get("cancellation_rate") or 0.0)
        
    # Fallback/merge with users collection (Priority 2 for Phone)
    user_doc = db.users.find_one({"supabase_id": provider_supabase_id})
    if user_doc:
        if not provider_name or provider_name == "Unknown Provider":
            provider_name = user_doc.get("name") or provider_name
        if not provider_phone:
            provider_phone = user_doc.get("phone") or ""
        if not provider_email:
            provider_email = user_doc.get("email") or provider_email
        if not provider_location_data:
            provider_location_data = user_doc.get("location_data") or {}

    service_name = data.get("service_name") or data.get("name") or "General Service"
    service_location = data.get("service_location") or data.get("location") or "Unknown"
    
    hourly_rate = data.get("hourly_rate")
    if hourly_rate is None:
        hourly_rate = data.get("pricing", {}).get("hourly_rate") or 0
    hourly_rate = float(hourly_rate)
    
    currency = data.get("currency") or data.get("pricing", {}).get("currency") or "USD"
    experience_years = int(data.get("experience_years") or 0)
    languages = data.get("languages", [])
    
    # Phase 6.8: New Optional Structured Fields
    travel_radius = float(data.get("travel_radius") or 10.0)
    working_hours = data.get("working_hours") or "09:00 - 18:00"
    emergency_availability = data.get("emergency_availability") in [True, "true", "True"]
    response_speed = int(data.get("response_speed") or 30) # Default 30 mins
    
    # Fix Location Ownership (Official Rule: location_data MUST be Service Location)
    # Geocode the service address
    service_location_data = {}
    try:
        gmaps = googlemaps.Client(key=os.getenv("GOOGLE_MAPS_API_KEY"))
        geocode_result = gmaps.geocode(service_location)
        if geocode_result:
            loc = geocode_result[0]['geometry']['location']
            service_location_data = {
                "latitude": loc['lat'],
                "longitude": loc['lng'],
                "address": geocode_result[0].get('formatted_address', service_location)
            }
        else:
            # Fallback if geocoding fails but we have previous data
            if existing_id:
                existing = db.service_providers.find_one({"_id": ObjectId(existing_id)})
                if existing:
                    service_location_data = existing.get("location_data", {})
    except Exception as e:
        print(f"[GEOCODE ERROR] {e}")

    # Build complete snapshot service document
    enriched = {
        "provider_supabase_id": provider_supabase_id,
        "provider_name": provider_name,
        "provider_phone": provider_phone,
        "provider_email": provider_email,
        "provider_location": provider_location,
        "location_data": service_location_data, # Official coordinates for the service
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
        
        # Phase 6.8: Real Technical Data
        "travel_radius": travel_radius,
        "working_hours": working_hours,
        "emergency_availability": emergency_availability,
        "response_speed": response_speed,
        
        # Legacy/Compatibility mappings
        "name": provider_name,
        "location": service_location,
        "rating": provider_rating,
        "phone": provider_phone, # Phase 6.8: Ensure 'phone' field is also populated
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
                    "providers": m.get("metadata", {}).get("providers"),
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
        status = request.args.get("status")
        query = {"provider_supabase_id": provider_supabase_id}
        if status:
            query["status"] = status
            
        print(f"--- API: Fetching requests for provider: {provider_supabase_id}, status: {status} ---")
        requests_cursor = db.active_requests.find(query).sort("created_at", -1)
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

@app.route("/api/bookings/respond", methods=["POST"])
@app.route("/api/providers/requests/<request_id>/respond", methods=["POST"])
def respond_to_request(request_id=None):
    """Phase B: Provider responds with approved, denied, or countered."""
    try:
        data = request.json
        # Handle both route patterns
        if not request_id:
            request_id = data.get("request_id")
            
        status = data.get("status")  # 'approved', 'denied', or 'counter_offer'
        
        print(f"--- API: Provider responding to request {request_id} with status: {status} ---")
        
        req_doc = db.active_requests.find_one({"_id": ObjectId(request_id)})
        if not req_doc:
            return jsonify({"error": "Request not found"}), 404
            
        customer_id = req_doc.get("customer_supabase_id")
        
        # 1. Update active_request Status & Negotiation Data
        update_fields = {
            "status": status,
            "updated_at": datetime.utcnow()
        }
        
        if status == "counter_offer":
            counter_offer_data = {
                "price": data.get("counter_price"),
                "date": data.get("counter_date"),
                "time": data.get("counter_time"),
                "message": data.get("counter_note")
            }
            
            # Update active_request with standardized fields and history
            history_entry = {
                "role": "provider",
                "action": "counter",
                "price": counter_offer_data["price"],
                "date": counter_offer_data["date"],
                "time": counter_offer_data["time"],
                "note": counter_offer_data["message"],
                "timestamp": datetime.utcnow()
            }
            
            db.active_requests.update_one(
                {"_id": ObjectId(request_id)},
                {
                    "$set": {
                        "counter_offer_price": counter_offer_data["price"],
                        "counter_offer_date": counter_offer_data["date"],
                        "counter_offer_time": counter_offer_data["time"],
                        "counter_note": counter_offer_data["message"],
                        "status": "countered",
                        "updated_at": datetime.utcnow()
                    },
                    "$push": {"negotiation_history": history_entry}
                }
            )
            status = "countered"
            
            # Real-time Propagation to BOTH rooms
            customer_supabase_id = req_doc.get("customer_supabase_id")
            conversation_id = req_doc.get("conversation_id")
            provider_name = req_doc.get("provider_name")
            provider_id = req_doc.get("provider_supabase_id")
            
            payload = {
                "request_id": str(request_id),
                "conversation_id": conversation_id,
                "provider_name": provider_name,
                "provider_id": provider_id,
                "customer_id": customer_supabase_id,
                "counter_offer": {
                    "price": counter_offer_data["price"],
                    "requested_date": counter_offer_data["date"],
                    "requested_time": counter_offer_data["time"],
                    "note": counter_offer_data["message"]
                },
                "status": "countered"
            }
            
            # Emit to customer room
            socketio.emit("counter_offer_received", payload, room=customer_supabase_id)
            # Emit to provider room for sync
            socketio.emit("request_status_updated", payload, room=provider_id)
            
            # PERSIESTENCE: Inject into chat history so it survives refresh
            if conversation_id:
                conv_model.add_message(
                    conversation_id, 
                    "assistant", 
                    f"I've sent a counter-offer: {counter_offer_data['price']} PKR on {counter_offer_data['date']}.",
                    agent="Provider",
                    metadata={
                        "type": "counter_offer",
                        "request_id": str(request_id),
                        "counter_price": counter_offer_data["price"],
                        "counter_date": counter_offer_data["date"],
                        "counter_time": counter_offer_data["time"],
                        "counter_note": counter_offer_data["message"],
                        "provider_name": provider_name
                    }
                )
            
            print(f"[SOCKET] Counter-offer emitted and persisted for customer: {customer_supabase_id}")
            return jsonify({"success": True, "status": "countered"})
            
        db.active_requests.update_one(
            {"_id": ObjectId(request_id)},
            {"$set": update_fields}
        )
        
        # 2. If approved, CREATE a finalized transactional booking entry
        if status == "approved":
            # Update status to confirmed as per Phase B rules
            db.active_requests.update_one(
                {"_id": ObjectId(request_id)},
                {"$set": {"status": "confirmed", "updated_at": datetime.utcnow()}}
            )
            status = "confirmed"

            final_date = req_doc.get("counter_date") or req_doc.get("requested_date")
            final_time = req_doc.get("counter_time") or req_doc.get("requested_time")
            
            service_snap = db.service_providers.find_one({
                "provider_supabase_id": req_doc.get("provider_supabase_id"),
                "service_type": req_doc.get("service_type")
            })
            cust_snap = db.users.find_one({"supabase_id": customer_id})
            
            booking_doc = {
                "active_request_id": str(request_id),
                "customer_supabase_id": customer_id,
                "provider_supabase_id": req_doc.get("provider_supabase_id"),
                "service_type": req_doc.get("service_type"),
                "scheduled_time": f"{final_date}T{final_time}",
                "requested_date": final_date,
                "requested_time": final_time,
                "price": req_doc.get("counter_price") or req_doc.get("offered_price"),
                "status": "confirmed",
                "confirmed_at": datetime.utcnow(),
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "snapshot": {
                    "provider_name": service_snap.get("provider_name") if service_snap else req_doc.get("provider_name"),
                    "provider_phone": service_snap.get("provider_phone") if service_snap else req_doc.get("provider_phone"),
                    "provider_avatar": service_snap.get("provider_avatar") if service_snap else req_doc.get("provider_avatar"),
                    "provider_location_data": service_snap.get("provider_location_data") if service_snap else req_doc.get("provider_location_data"),
                    "customer_name": cust_snap.get("name") if cust_snap else req_doc.get("customer_name"),
                    "customer_phone": cust_snap.get("phone") if cust_snap else req_doc.get("customer_phone"),
                    "customer_avatar": cust_snap.get("avatar_url") if cust_snap else req_doc.get("customer_avatar"),
                    "customer_location_data": cust_snap.get("location_data") if cust_snap else req_doc.get("customer_location_data")
                }
            }
            db.bookings.insert_one(booking_doc)
            
            # Correction 6: Availability block
            db.provider_availability.update_one(
                {"provider_supabase_id": req_doc.get("provider_supabase_id")},
                {"$push": {f"booked_slots.{final_date}": final_time}},
                upsert=True
            )

        # 3. Notification Logic
        try:
            db.follow_up.insert_one({
                "user_supabase_id": customer_id,
                "role": "buyer",
                "type": status,
                "title": f"Request {status.capitalize()}",
                "message": f"Your request for {req_doc.get('service_type')} has been {status}.",
                "related_id": str(request_id),
                "created_at": datetime.utcnow()
            })
            # Emit Socket (Correction 8: Refresh pending list)
            socketio.emit('request_status_updated', {"request_id": str(request_id), "status": status, "user_id": customer_id})
        except Exception as e:
            print(f"[NOTIF ERROR] {e}")
        
        return jsonify({"success": True})
            
        return jsonify({"success": True})
    except Exception as e:
        print(f"!!! API ERROR (respond_to_request): {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/bookings/counter/respond", methods=["POST"])
def respond_to_counter_offer():
    """Phase B: Customer accepts or rejects a counter offer."""
    try:
        data = request.json
        request_id = data.get("request_id")
        action = data.get("action")  # 'accepted' or 'rejected'
        conversation_id = data.get("conversation_id")
        
        print(f"--- API: Customer responding to counter: {request_id} ({action}) ---")
        
        req_doc = db.active_requests.find_one({"_id": ObjectId(request_id)})
        if not req_doc:
            return jsonify({"error": "Request not found"}), 404
            
        customer_id = req_doc.get("customer_supabase_id")
        provider_id = req_doc.get("provider_supabase_id")
        
        booking_id = None
        # Use centralized resolution logic
        success = finalize_negotiation_resolution(request_id, req_doc, action=action)
        if success:
            return jsonify({"success": True})
        else:
            return jsonify({"error": "Failed to finalize negotiation"}), 500

        return jsonify({"success": True})
    except Exception as e:
        print(f"!!! API ERROR (respond_to_counter_offer): {str(e)}")
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
        print(f"!!! API ERROR (get_customer_bookings): {str(e)}")
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

# --- Phase 4: Direct Booking & Availability APIs ---

@app.route("/api/providers/<supabase_id>/availability", methods=["GET"])
def get_detailed_availability(supabase_id):
    """Fetches blocked dates and taken slots for a provider."""
    try:
        date_str = request.args.get("date") # e.g. "2026-05-22"
        print(f"--- API: Fetching availability for provider: {supabase_id} on {date_str} ---")
        
        # 1. Base availability settings (Phase 5 Refined)
        avail_settings = db.provider_availability.find_one({"provider_supabase_id": supabase_id})
        
        # Optional structures
        blocked_dates = avail_settings.get("blocked_dates", []) if avail_settings else []
        weekly_schedule = avail_settings.get("weekly_schedule", {}) if avail_settings else {}
        manual_blocked_slots = avail_settings.get("booked_slots", {}).get(date_str, []) if avail_settings else []
        
        # 2. Daily taken slots from bookings (Dynamic check)
        query = {"provider_supabase_id": supabase_id, "status": {"$ne": "cancelled"}}
        if date_str:
            query["$or"] = [
                {"scheduled_time": {"$regex": f"^{date_str}"}},
                {"requested_date": date_str}
            ]
            
        taken_bookings = list(db.bookings.find(query))
        booking_taken = []
        for b in taken_bookings:
            s = b.get("scheduled_time") or b.get("requested_time")
            if isinstance(s, str) and "T" in s:
                booking_taken.append(s.split("T")[1][:5])
            else:
                booking_taken.append(s)

        # Merge dynamic bookings with manual overrides
        unique_taken = list(set(booking_taken + manual_blocked_slots))

        return jsonify({
            "success": True, 
            "blocked_dates": blocked_dates,
            "weekly_schedule": weekly_schedule,
            "taken_slots": unique_taken
        })
    except Exception as e:
        print(f"!!! API ERROR (get_detailed_availability): {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/bookings", methods=["POST"])
def create_direct_booking():
    """Phase A: Creates an active_request (Negotiation) ONLY. Booking is created later upon acceptance."""
    try:
        data = request.json
        print(f"--- API: Creating INITIAL REQUEST: {data} ---")
        
        provider_id = data.get("provider_supabase_id")
        customer_id = data.get("customer_supabase_id")
        service_type = data.get("service_type")
        scheduled_time = data.get("scheduled_time") # ISO String
        price = data.get("price")
        
        # Phase 6.5: Detailed error reporting
        missing = []
        if not provider_id: missing.append("provider_supabase_id")
        if not customer_id: missing.append("customer_supabase_id")
        if not scheduled_time: missing.append("scheduled_time")
        if missing:
            error_msg = f"Missing required booking fields: {', '.join(missing)}"
            return jsonify({"error": error_msg}), 400

        # Note: We check conflict against FINALIZED bookings only (Correction 1)
        existing = db.bookings.find_one({
            "provider_supabase_id": provider_id,
            "scheduled_time": scheduled_time,
            "status": {"$ne": "cancelled"}
        })
        if existing:
            return jsonify({"error": "This slot is already booked. Please select another time."}), 409
            
        booking_date = scheduled_time.split("T")[0]
        booking_slot = scheduled_time.split("T")[1][:5]
        
        # Phase B: Deep Snapshot Copying (No placeholders/mocks)
        # Sourced strictly from service_providers and users
        service_doc = db.service_providers.find_one({
            "provider_supabase_id": provider_id,
            "$or": [
                {"service_type": service_type},
                {"service_name": service_type}
            ]
        })
        
        if not service_doc:
            print(f"!!! [BOOKING ERROR] Service Provider NOT FOUND for ID: {provider_id}, Service: {service_type}")
            return jsonify({"error": "Service provider not found or data mismatch."}), 404
            
        cust_doc = db.users.find_one({"supabase_id": customer_id})
        if not cust_doc:
            print(f"!!! [BOOKING ERROR] Customer NOT FOUND for ID: {customer_id}")
            return jsonify({"error": "Customer profile not found."}), 404
        
        # Create Active Request (Negotiation single source of truth)
        req_doc = {
            "conversation_id": data.get("conversation_id"),
            
            # Provider Snapshot (Official Rule: Sourced STRICTLY from service_providers)
            "provider_supabase_id": provider_id,
            "provider_name": service_doc.get("provider_name"),
            "provider_phone": service_doc.get("provider_phone"),
            "provider_email": service_doc.get("provider_email"),
            "provider_avatar": service_doc.get("provider_avatar", ""),
            "provider_location": service_doc.get("service_location") or service_doc.get("provider_location"),
            "provider_location_data": service_doc.get("provider_location_data") or service_doc.get("location_data", {}),
            
            "service_type": service_type,
            "service_name": service_doc.get("service_name"),
            "service_id": str(service_doc.get("_id")),
            "specialization": service_doc.get("specialization"),
            
            "pricing": service_doc.get("pricing"),
            "rating": service_doc.get("rating"),
            "travel_radius": service_doc.get("travel_radius"),
            "working_hours": service_doc.get("working_hours"),
            "availability": service_doc.get("availability", []),
            
            # Customer Snapshot (Official Rule: From db.users collection)
            "customer_supabase_id": customer_id,
            "customer_name": cust_doc.get("name") if cust_doc else "Valued Client",
            "customer_phone": cust_doc.get("phone") if cust_doc else "",
            "customer_email": cust_doc.get("email") if cust_doc else "",
            "customer_avatar": cust_doc.get("avatar_url") if cust_doc else "",
            "customer_location": cust_doc.get("location") if cust_doc else "",
            "customer_location_data": cust_doc.get("location_data") if cust_doc else data.get("location_data", {}),
            
            "offered_price": price,
            "requested_date": booking_date,
            "requested_time": booking_slot,
            "location": data.get("location"),
            "status": "pending",
            "source": "direct_booking_flow",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        result = db.active_requests.insert_one(req_doc)
        request_id = str(result.inserted_id)
        
        # Sync socket informing provider of the new request
        socketio.emit('request_status_updated', {
            "provider_id": provider_id,
            "request_id": request_id,
            "status": "pending"
        })
        
        return jsonify({"success": True, "request_id": request_id})
    except Exception as e:
        print(f"!!! API ERROR (create_direct_booking): {str(e)}")
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