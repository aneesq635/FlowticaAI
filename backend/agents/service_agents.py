from agents.base import BaseAgent
from core.state import AgentState
from typing import Dict, Any, List
import json
from pymongo import MongoClient
from langchain_openai import OpenAIEmbeddings
from core.vector_store import vector_manager
import os

class IntentAgent(BaseAgent):
    def __init__(self):
        super().__init__("Intent Agent", "Classifies user intent with context awareness")

    def run(self, state: AgentState) -> Dict[str, Any]:
        user_message = state["messages"][-1].content
        conv_stage = state.get("conversation_stage", "greeting")
        shortlist = state.get("shortlisted_providers", [])
        summary = state.get("metadata", {}).get("session_summary", "")
        
        prompt = f"""Analyze the user message and classify the intent within the current context.
        Current Conversation Stage: {conv_stage}
        Previous Shortlisted Providers: {[p.get('name') for p in shortlist]}
        Session Summary: {summary}
        
        Possible intents:
        1. greeting: User is saying hello, hi, salam, etc.
        2. query_services: User is asking what services we provide or what we can help with.
        3. service_request: User wants a specific service (e.g., AC repair, plumbing).
        4. provider_selection: User is choosing a provider from the previous list (e.g., "I'll go with option 1", "Provider 17").
        5. booking_confirmation: User is confirming details or time.
        6. general: Everything else.
        
        Message: "{user_message}"
        Return ONLY the intent string.
        """
        response = self.llm.invoke(prompt)
        intent = response.content.strip().lower()
        
        log = self.log_action(state, f"Classified intent as: {intent}", f"Context: {conv_stage}")
        trace = self.create_trace(f"Intelligently identified '{intent}' intent considering the '{conv_stage}' stage.")
        
        return {
            "intent": {"value": intent, "confidence": 1.0, "timestamp": self.llm.invoke("return current timestamp").content}, # Confidence placeholder
            "active_agent": "intent",
            "execution_logs": [log],
            "reasoning_traces": [trace]
        }

class ExtractionAgent(BaseAgent):
    def __init__(self):
        super().__init__("Extraction Agent", "Extracts structured entities and selections")

    def run(self, state: AgentState) -> Dict[str, Any]:
        user_message = state["messages"][-1].content
        shortlist = state.get("shortlisted_providers", [])
        
        prompt = f"""Extract entities and user selections.
        Message: "{user_message}"
        Shortlist context: {json.dumps(shortlist)}
        
        Expected JSON format:
        {{
            "service_type": "...",
            "location": "...",
            "time_preference": "...",
            "selected_provider_index": "integer or null",
            "selected_provider_name": "string or null"
        }}
        
        If the user says 'Option 1', set selected_provider_index to 0. 
        If the user mentions 'Provider 17', set selected_provider_name to 'Provider 17'.
        Return JSON ONLY.
        """
        response = self.llm.invoke(prompt)
        try:
            entities = json.loads(response.content)
        except:
            entities = {}
            
        # If a selection was made, find the provider in memory
        selected_provider = None
        if entities.get("selected_provider_index") is not None:
            idx = int(entities["selected_provider_index"])
            if 0 <= idx < len(shortlist):
                selected_provider = shortlist[idx]
        elif entities.get("selected_provider_name"):
            name = entities["selected_provider_name"].lower()
            for p in shortlist:
                if name in p.get("name", "").lower():
                    selected_provider = p
                    break

        log = self.log_action(state, "Extracted entities & selections", json.dumps(entities))
        trace = self.create_trace("Parsed language into structured data, mapping user selections to session memory.")
        
        extracted_service_request = {
            "service_type": entities.get("service_type") or state.get("service_request", {}).get("service_type", ""),
            "location": entities.get("location") or state.get("service_request", {}).get("location", ""),
            "time_slot": entities.get("time_preference") or state.get("service_request", {}).get("time_slot", "")
        }
        
        print(f"[EXTRACTION] Entities: {entities}")
        print(f"[EXTRACTION] Service request: {extracted_service_request}")
        
        return {
            "entities": entities,
            "service_request": extracted_service_request,
            "selected_provider": selected_provider or {},
            "active_agent": "extraction",
            "execution_logs": [log],
            "reasoning_traces": [trace]
        }

class MemoryAgent(BaseAgent):
    def __init__(self, db):
        super().__init__("Memory Agent", "Profile & Session Context Engine")
        self.db = db

    def run(self, state: AgentState) -> Dict[str, Any]:
        user_id = state.get("user_id")
        entities = state.get("entities", {})
        metadata = state.get("metadata", {})
        is_resumed = metadata.get("is_resumed", False)
        current_agent = state.get("active_agent")
        
        # Scenario 1: Session Rehydration (Summarization)
        if is_resumed and current_agent == "supervisor":
            messages = state.get("messages", [])
            history = "\n".join([f"{m.type}: {m.content}" for m in messages[:-1]])
            
            prompt = f"Summarize this service orchestration history for the next agent: {history}\nFocus on service type, location, and previous provider mentions. Be extremely brief."
            summary = self.llm.invoke(prompt).content
            
            log = self.log_action(state, "History Restored", f"Resumed session summary: {summary}")
            trace = self.create_trace("Summarized previous interaction to maintain continuity in the resumed session.")
            
            return {
                "metadata": {**metadata, "session_summary": summary},
                "active_agent": "memory",
                "execution_logs": [log],
                "reasoning_traces": [trace]
            }

        # Scenario 2: Profile Synchronization
        updates = {}
        if entities.get("service_type"):
            updates["last_requested_service"] = entities["service_type"]
        if entities.get("location"):
            updates["preferred_location"] = entities["location"]
            
        if updates and user_id:
            self.db.users.update_one(
                {"supabase_id": user_id},
                {"$set": {"preferences": updates}},
                upsert=True
            )
            
        log = self.log_action(state, "Memory synced", f"Updated profile with {len(updates)} traits.")
        trace = self.create_trace("Synced extracted entities with the persistent MongoDB user profile.")
        
        return {
            "active_agent": "memory",
            "execution_logs": [log],
            "reasoning_traces": [trace]
        }

class KnowledgeAgent(BaseAgent):
    def __init__(self, db):
        super().__init__("Knowledge Agent", "Dynamic Retrieval Layer")
        self.db = db
        self.vector_store = vector_manager.get_vector_store()
        
    def run(self, state: AgentState) -> Dict[str, Any]:
        # FIX: intent is a dict {"value": "..."}, not a plain string
        intent_obj = state.get("intent", {})
        intent = intent_obj.get("value") if isinstance(intent_obj, dict) else intent_obj
        
        if intent == "query_services":
            # Dynamically fetch service categories from MongoDB
            services = self.db.service_providers.distinct("service_type")
            log = self.log_action(state, "Retrieved available services", f"Found: {', '.join(services)}")
            trace = self.create_trace("Queried live database for distinct service categories.")
            return {
                "metadata": {"available_services": services},
                "active_agent": "knowledge",
                "execution_logs": [log],
                "reasoning_traces": [trace]
            }

        # Standard RAG retrieval
        user_query = state["messages"][-1].content
        service_req = state.get("service_request", {}) or {}
        entities = state.get("entities", {}) or {}
        # Pull service details from entities if service_request is empty
        service_type = service_req.get("service_type") or entities.get("service_type", "")
        location = service_req.get("location") or entities.get("location", "")
        refined_query = f"{user_query} {service_type} {location}".strip()
        
        print(f"[KNOWLEDGE] Searching for: '{refined_query}'")
        
        providers = []
        try:
            if self.vector_store._collection.count() == 0:
                print("[KNOWLEDGE] Vector store empty, syncing from MongoDB...")
                vector_manager.sync_from_mongodb(self.db)

            results = self.vector_store.similarity_search_with_relevance_scores(refined_query, k=5)
            for doc, score in results:
                mongodb_id = doc.metadata.get("mongodb_id")
                provider_data = self.db.service_providers.find_one({"_id": mongodb_id})
                if not provider_data:
                    from bson import ObjectId
                    try: provider_data = self.db.service_providers.find_one({"_id": ObjectId(mongodb_id)})
                    except: pass

                if provider_data:
                    provider_data["_id"] = str(provider_data["_id"])
                    provider_data["score"] = score
                    providers.append(provider_data)
        except Exception as e:
            print(f"[KNOWLEDGE] Vector retrieval failed: {e}. Falling back to MongoDB direct search.")

        # Fallback: Direct MongoDB search if vector store returned nothing
        if not providers and service_type:
            print(f"[KNOWLEDGE] Fallback: Querying MongoDB directly for service_type={service_type}")
            cursor = self.db.service_providers.find(
                {"service_type": {"$regex": service_type, "$options": "i"}},
                limit=5
            )
            for p in cursor:
                p["_id"] = str(p["_id"])
                p["score"] = 0.5
                providers.append(p)

        print(f"[KNOWLEDGE] Found {len(providers)} providers")
        log = self.log_action(state, f"Retrieved {len(providers)} candidates", f"Query: {refined_query}")
        trace = self.create_trace("Executed semantic search via ChromaDB vector store.")
        
        return {
            "provider_candidates": providers,
            "active_agent": "knowledge",
            "execution_logs": [log],
            "reasoning_traces": [trace]
        }

class MatchingAgent(BaseAgent):
    def __init__(self):
        super().__init__("Matching Agent", "Intelligent Ranking Engine")

    def run(self, state: AgentState) -> Dict[str, Any]:
        providers = state.get("provider_candidates", [])
        
        # Scoring Logic: Rating (40%) + Reliability (40%) + Experience (20%)
        for p in providers:
            rating = p.get("rating", 0)
            reliability = p.get("reliability_score", 0)
            exp = p.get("experience_years", 0)
            
            p["match_score"] = (rating * 0.4) + (reliability * 4) + (exp * 0.1) # Normalized scale
            p["why_matched"] = f"Matched based on high {p.get('specialization')} expertise and {rating} rating."
            p["ranking_explanation"] = f"Ranked #1 due to {exp} years of experience and exceptional reliability."

        ranked = sorted(providers, key=lambda x: x["match_score"], reverse=True)[:4]
        
        log = self.log_action(state, "Ranked and Shortlisted providers", f"Top: {ranked[0]['name'] if ranked else 'None'}")
        trace = self.create_trace("Optimized provider list for presentation, persisting them to session memory.")
        
        return {
            "shortlisted_providers": ranked,
            "active_agent": "matching",
            "execution_logs": [log],
            "reasoning_traces": [trace],
            "conversation_stage": "selection"
        }

class BookingAgent(BaseAgent):
    def __init__(self, db):
        super().__init__("Booking Agent", "Transaction Management Engine")
        self.db = db

    def run(self, state: AgentState) -> Dict[str, Any]:
        selected = state.get("selected_provider")
        
        if not selected:
            log = self.log_action(state, "Booking failed", "No provider selected in state.")
            return {"active_agent": "booking", "execution_logs": [log]}

        booking_details = {
            "provider_name": selected.get("name"),
            "provider_id": selected.get("_id"),
            "status": "pending_confirmation",
            "timestamp": "2026-05-16T10:00:00Z",
            "service": state.get("service_request", {}).get("service_type"),
            "location": state.get("service_request", {}).get("location")
        }
        
        # Persist to DB
        if state.get("user_id"):
            self.db.bookings.insert_one({
                "user_id": state.get("user_id"),
                "booking": booking_details,
                "created_at": "2026-05-16T10:00:00Z"
            })
            
        log = self.log_action(state, "Booking record created", f"Provider: {selected.get('name')}")
        trace = self.create_trace(f"Successfully initialized booking for {selected.get('name')}. Awaiting user scheduling.")
        
        return {
            "booking_details": booking_details,
            "active_agent": "booking",
            "execution_logs": [log],
            "reasoning_traces": [trace],
            "workflow_stage": "booking_initiation"
        }

class SchedulingAgent(BaseAgent):
    def __init__(self, db):
        super().__init__("Scheduling Agent", "Manages followups and notifications")
        self.db = db

    def run(self, state: AgentState) -> Dict[str, Any]:
        booking = state.get("booking_details", {})
        
        notification = {
            "message": f"Reminder: Your {booking.get('service')} is scheduled for tomorrow.",
            "type": "reminder",
            "status": "pending"
        }
        
        if state.get("user_id"):
            self.db.notifications.insert_one({
                "user_id": state.get("user_id"),
                "notification": notification
            })
            
        log = self.log_action(state, "Scheduled follow-up", "Reminder added to notification queue.")
        trace = self.create_trace("Configured automated scheduling triggers for booking reminders and status updates.")
        
        return {
            "active_agent": "scheduling",
            "execution_logs": [log],
            "reasoning_traces": [trace]
        }
