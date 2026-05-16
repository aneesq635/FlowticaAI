from datetime import datetime
from bson import ObjectId

class ConversationModel:
    def __init__(self, db):
        self.db = db
        self.conversations = db.conversations
        self.messages = db.conversation_messages
        self.shared_states = db.shared_states
        self.workflow_states = db.workflow_states

    def create_conversation(self, user_id, title="New Orchestration"):
        conversation = {
            "user_id": user_id,
            "title": title,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        result = self.conversations.insert_one(conversation)
        conv_id = str(result.inserted_id)
        
        # Initialize empty state and workflow
        self.shared_states.insert_one({
            "conversation_id": conv_id,
            "state": {},
            "updated_at": datetime.utcnow()
        })
        self.workflow_states.insert_one({
            "conversation_id": conv_id,
            "stage": "greeting",
            "active_agent": "supervisor",
            "updated_at": datetime.utcnow()
        })
        
        return {**conversation, "_id": conv_id}

    def get_user_conversations(self, user_id):
        convs = list(self.conversations.find({"user_id": user_id}).sort("updated_at", -1))
        for conv in convs:
            conv["_id"] = str(conv["_id"])
            # Load last message for preview
            last_msg = self.messages.find_one(
                {"conversation_id": conv["_id"]},
                sort=[("timestamp", -1)]
            )
            conv["last_message"] = last_msg["content"] if last_msg else None
        return convs

    def get_full_context(self, conversation_id):
        """Retrieves messages, shared state, and workflow stage for rehydration"""
        messages = list(self.messages.find({"conversation_id": conversation_id}).sort("timestamp", 1))
        shared_state = self.shared_states.find_one({"conversation_id": conversation_id})
        workflow = self.workflow_states.find_one({"conversation_id": conversation_id})
        
        return {
            "messages": messages,
            "shared_state": shared_state.get("state", {}) if shared_state else {},
            "workflow_stage": workflow.get("stage", "greeting") if workflow else "greeting",
            "active_agent": workflow.get("active_agent", "supervisor") if workflow else "supervisor"
        }

    def add_message(self, conversation_id, role, content, agent=None, metadata=None):
        message = {
            "conversation_id": conversation_id,
            "role": role,
            "content": content,
            "agent": agent,
            "metadata": metadata or {},
            "timestamp": datetime.utcnow()
        }
        self.messages.insert_one(message)
        self.conversations.update_one(
            {"_id": ObjectId(conversation_id)},
            {"$set": {"updated_at": datetime.utcnow()}}
        )

    def update_orchestration_state(self, conversation_id, state, stage=None, active_agent=None):
        """Persists the full shared state and workflow indicators"""
        self.shared_states.update_one(
            {"conversation_id": conversation_id},
            {"$set": {"state": state, "updated_at": datetime.utcnow()}},
            upsert=True
        )
        if stage or active_agent:
            update_fields = {"updated_at": datetime.utcnow()}
            if stage: update_fields["stage"] = stage
            if active_agent: update_fields["active_agent"] = active_agent
            self.workflow_states.update_one(
                {"conversation_id": conversation_id},
                {"$set": update_fields},
                upsert=True
            )

    def update_title(self, conversation_id, title):
        self.conversations.update_one(
            {"_id": ObjectId(conversation_id)},
            {"$set": {"title": title, "updated_at": datetime.utcnow()}}
        )

    def delete_conversation(self, conversation_id):
        conv_object_id = ObjectId(conversation_id)
        # Delete from all related collections
        self.conversations.delete_one({"_id": conv_object_id})
        self.messages.delete_many({"conversation_id": conversation_id})
        self.shared_states.delete_many({"conversation_id": conversation_id})
        self.workflow_states.delete_many({"conversation_id": conversation_id})
        self.db.langgraph_checkpoints.delete_many({"thread_id": conversation_id})
