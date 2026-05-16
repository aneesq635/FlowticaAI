from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from pymongo import MongoClient
from dotenv import load_dotenv
import os
import json
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

mongo_uri = os.getenv("MONGODB_URI")
client = MongoClient(mongo_uri)
db = client["flowtica"]
users_collection = db["users"]
conv_model = ConversationModel(db)
user_model = UserModel(db)
provider_model = ProviderModel(db)
checkpointer = MongoCheckpointer(db)

# RECOMPILED Graph with native persistence
graph = workflow.compile(checkpointer=checkpointer)

@socketio.on('connect')
def handle_connect():
    print('Client connected')
    emit('status', {'message': 'Connected to Flowtica AI Engine'})

def serialize_value(obj):
    """Helper to make LangGraph state serializable for SocketIO"""
    if isinstance(obj, (HumanMessage, AIMessage)):
        return {"content": obj.content, "type": obj.type}
    if isinstance(obj, list):
        return [serialize_value(i) for i in obj]
    if isinstance(obj, dict):
        return {k: serialize_value(v) for k, v in obj.items() if k != "embedding"}
    return obj

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

@socketio.on('user_message')
def handle_message(data):
    message_text = data.get('text')
    conversation_id = data.get('conversation_id')
    user_id = data.get('user_id', 'anonymous')
    
    print(f"\n[ORCHESTRATOR] === New Message Turn Started ===")
    print(f"[ORCHESTRATOR] Message: {message_text}")
    print(f"[ORCHESTRATOR] Conversation: {conversation_id}")

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
        # intent={} forces fresh intent classification (replace_if_new reducer clears old value)
        turn_input = {
            "messages": [HumanMessage(content=message_text)],
            "user_id": user_id,
            "active_agent": "start",
            "intent": {},           # Cleared by replace_if_new reducer
            "next_agent": "",       # Empty = fresh turn, supervisor uses this to track progress
            "iteration_count": 0,  # Reset loop guard counter
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

        emit('workflow_started', {'input': message_text})
        
        # Persist user message
        if conversation_id:
            conv_model.add_message(conversation_id, "user", message_text)

        # NATIVE LangGraph STREAM with persistence
        for event in graph.stream(turn_input, config=config):
            for node_name, state_update in event.items():
                print(f"--- Production Orchestration Node: {node_name} ---")
                print(f"[ORCHESTRATOR] Node '{node_name}' output keys: {list(state_update.keys())}")
                
                # Signal Agent Started
                emit('workflow_update', {
                    'type': 'agent_started',
                    'data': {'agent': node_name}
                })
                
                # Serialized delta to UI
                serialized_update = serialize_value(state_update)
                emit('workflow_update', {
                    'type': 'state_updated',
                    'data': {'agent': node_name, 'diff': serialized_update}
                })
                
                # Reasoning & Logs
                if "reasoning_traces" in state_update:
                    for trace in state_update["reasoning_traces"]:
                        emit('workflow_update', {
                            'type': 'trace_created',
                            'data': {'agent': node_name, 'reasoning': trace.get('reasoning')}
                        })

                if "execution_logs" in state_update:
                    for log in state_update["execution_logs"]:
                        emit('workflow_update', {
                            'type': 'execution_log',
                            'data': log
                        })
                
                # Signal Agent Completed
                emit('workflow_update', {
                    'type': 'agent_completed',
                    'data': {'agent': node_name}
                })

                # Final Response handling
                if "frontier_response" in state_update:
                    content = state_update["frontier_response"]
                    print(f"[ORCHESTRATOR] >>> EMITTING MESSAGE: {content[:50]}...")
                    
                    emit('chat_message', {
                        'role': 'assistant',
                        'content': content,
                        'agent': 'Frontier Agent',
                        'conversation_id': conversation_id
                    })
                    if conversation_id:
                        conv_model.add_message(conversation_id, "assistant", content, agent="Frontier Agent")
                        
                # NOTE: We NO LONGER manually update MongoDB here. 
                # MongoCheckpointer.put() is called automatically by graph.stream()
                # to persist the full merged state.

        emit('workflow_completed', {'status': 'success'})

    except Exception as e:
        import traceback
        error_type = type(e).__name__
        error_msg = str(e) or "No error message provided"
        print(f"!!! CRITICAL ORCHESTRATION ERROR [{error_type}]: {error_msg}")
        print(traceback.format_exc())
        
        emit('workflow_failed', {'error': f"{error_type}: {error_msg}"})
        emit('chat_message', {
            'role': 'assistant',
            'content': f"Orchestration failure: {error_type} - {error_msg}",
            'agent': 'System',
            'conversation_id': conversation_id
        })
    finally:
        print(f"[ORCHESTRATOR] === Message Turn Completed ===\n")

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
        
        return jsonify({"success": True, "profile": profile_data})
    except Exception as e:
        print(f"!!! API ERROR (setup_provider_profile): {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/providers/profile/<supabase_id>", methods=["GET"])
def get_provider_profile(supabase_id):
    try:
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

@app.route("/api/providers/service", methods=["POST"])
def add_provider_service():
    try:
        data = request.json
        print(f"--- API: Adding new provider service: {data.get('name')} ---")
        
        # Insert into MongoDB
        result = db.service_providers.insert_one(data)
        
        # Sync ChromaDB so RAG agents can see it
        vector_manager.sync_from_mongodb(db)
        
        return jsonify({"success": True, "id": str(result.inserted_id)})
    except Exception as e:
        print(f"!!! API ERROR (add_provider_service): {str(e)}")
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

if __name__ == "__main__":
    print("\n" + "="*50)
    print("FLOWTICA AI ORCHESTRATION ENGINE STARTING")
    print(f"Host: 0.0.0.0 | Port: 5000")
    print("="*50 + "\n")
    # Disable debug mode to prevent socket reloader issues on Windows
    socketio.run(app, host="0.0.0.0", port=5000, debug=False, allow_unsafe_werkzeug=True)