from agents.base import BaseAgent
from core.state import AgentState
from typing import Dict, Any, List
import json
from datetime import datetime
from pymongo import MongoClient
from langchain_openai import OpenAIEmbeddings
from core.vector_store import vector_manager
from core.knowledge_engine import HybridRetrievalEngine
import os

class IntentAgent(BaseAgent):
    def __init__(self):
        super().__init__("Intent Agent", "Classifies user intent with context awareness")

    def run(self, state: AgentState) -> Dict[str, Any]:
        user_message = state["messages"][-1].content
        conv_stage = state.get("conversation_stage", "greeting")
        shortlist = state.get("shortlisted_providers", [])
        summary = state.get("metadata", {}).get("session_summary", "")
        selected = state.get("selected_provider", {})
        
        prompt = f"""Analyze the user message and classify the intent within the current context.
        Current Conversation Stage: {conv_stage}
        Previous Shortlisted Providers: {[p.get('name') for p in shortlist]}
        Selected Provider: {selected.get('name') if selected else 'None'}
        Session Summary: {summary}
        
        Possible intents:
        1. greeting: User is saying hello, hi, salam, etc.
        2. query_services: User is asking what services we provide or what we can help with.
        3. service_request: User wants a specific service (e.g., AC repair, plumbing).
        4. provider_selection: User is choosing a provider (e.g., "I'll go with option 1", "Provider 17", "select option 2") OR the user is providing booking details (such as price, date, time, e.g., "tomorrow at 3pm for $25/hr") after a provider has been selected.
        5. booking_confirmation: User is confirming booking details or time.
        6. check_status: User is asking for the status of their service request, booking, or negotiation, or asking if the provider responded yet (e.g., "what is the status", "did provider respond", "any update", "status?", "check status").
        7. general: Everything else.
        
        Message: "{user_message}"
        Return ONLY the intent string (e.g. 'greeting', 'query_services', 'service_request', 'provider_selection', 'booking_confirmation', 'check_status', 'general').
        """
        response = self.llm.invoke(prompt)
        intent = response.content.strip().lower()
        
        # Rule-based validation to ensure short affirmation/acknowledgement messages
        # are mapped to booking_confirmation when a provider selection context is active.
        msg_clean = user_message.strip().lower().rstrip('.!?*() ')
        confirm_tokens = {"okay", "ok", "yes", "confirm", "confirmed", "go ahead", "sure", "do it", "yup", "yeah", "yep", "approved", "approve", "done"}
        
        is_short_affirmation = False
        if msg_clean in confirm_tokens:
            is_short_affirmation = True
        else:
            words = [w.strip() for w in msg_clean.split() if w.strip()]
            if len(words) <= 3 and any(w in confirm_tokens for w in words):
                is_short_affirmation = True
                
        if is_short_affirmation and (selected or conv_stage in ("selection", "scheduling", "negotiation")):
            intent = "booking_confirmation"
        elif "check_status" in intent or "status" in intent or "respond" in intent or "update" in intent:
            intent = "check_status"
        elif "provider_selection" in intent:
            intent = "provider_selection"
        elif "booking_confirmation" in intent:
            intent = "booking_confirmation"
        elif "service_request" in intent:
            intent = "service_request"
        elif "query_services" in intent:
            intent = "query_services"
        elif "greeting" in intent:
            intent = "greeting"
        else:
            intent = "general"
        
        from datetime import datetime
        log = self.log_action(state, f"Classified intent as: {intent}", f"Context: {conv_stage}")
        trace = self.create_trace(f"Intelligently identified '{intent}' intent considering the '{conv_stage}' stage.")
        
        return {
            "intent": {"value": intent, "confidence": 1.0, "timestamp": datetime.utcnow().isoformat()},
            "active_agent": "intent",
            "execution_logs": [log],
            "reasoning_traces": [trace]
        }

class ExtractionAgent(BaseAgent):
    def __init__(self):
        super().__init__("Extraction Agent", "Extracts structured entities and selections")

    def run(self, state: AgentState) -> Dict[str, Any]:
        user_message = state["messages"][-1].content
        shortlist = state.get("shortlisted_providers", []) or state.get("last_search_results", [])
        
        prompt = f"""Extract entities and user selections.
        Message: "{user_message}"
        Shortlist context: {json.dumps(shortlist)}
        
        Expected JSON format:
        {{
            "service_type": "...",
            "location": "...",
            "time_preference": "...",
            "selected_provider_index": "integer or null",
            "selected_provider_name": "string or null",
            "requested_date": "YYYY-MM-DD or string or null",
            "requested_time": "HH:MM or string or null",
            "offered_price": "number or null"
        }}
        
        If the user says 'Option 1' or 'option 2' or 'choose option 3', set selected_provider_index to the 0-based index (e.g. 'Option 1' is 0, 'Option 2' is 1).
        If the user mentions a provider's name or rating or specialization, e.g. 'Provider 1', set selected_provider_name to 'Provider 1'.
        If they specify a date (e.g. 'tomorrow', 'Monday', 'May 18'), extract it into requested_date.
        If they specify a time (e.g. '2pm', '14:00', 'morning'), extract it into requested_time.
        If they specify a price or rate (e.g. '$25', '25/hr', '3000 PKR'), extract the numeric value into offered_price.
        Return JSON ONLY.
        """
        response = self.llm.invoke(prompt)
        try:
            # Clean possible markdown block
            content = response.content.strip()
            if content.startswith("```json"):
                content = content[7:]
            if content.endswith("```"):
                content = content[:-3]
            entities = json.loads(content.strip())
        except:
            entities = {}
            
        # If a selection was made, find the provider in memory
        selected_provider = state.get("selected_provider", {}) or {}
        if entities.get("selected_provider_index") is not None:
            try:
                idx = int(entities["selected_provider_index"])
                if 0 <= idx < len(shortlist):
                    selected_provider = shortlist[idx]
            except:
                pass
        elif entities.get("selected_provider_name"):
            name = entities["selected_provider_name"].lower()
            for p in shortlist:
                if name in p.get("name", "").lower() or name in p.get("provider_name", "").lower():
                    selected_provider = p
                    break
        else:
            selected_provider = state.get("selected_provider", {}) or {}

        log = self.log_action(state, "Extracted entities & selections", json.dumps(entities))
        trace = self.create_trace("Parsed language into structured data, mapping user selections to session memory.")
        
        extracted_service_request = {
            "service_type": entities.get("service_type") or state.get("service_request", {}).get("service_type", ""),
            "location": entities.get("location") or state.get("service_request", {}).get("location", ""),
            "time_slot": entities.get("time_preference") or state.get("service_request", {}).get("time_slot", "")
        }
        
        # Merge scheduling/offered details into state's booking_context
        booking_context = state.get("booking_context", {}) or {}
        new_context = {**booking_context}
        if entities.get("requested_date"):
            new_context["requested_date"] = entities["requested_date"]
        if entities.get("requested_time"):
            new_context["requested_time"] = entities["requested_time"]
        if entities.get("offered_price"):
            new_context["offered_price"] = entities["offered_price"]
        
        print(f"[EXTRACTION] Entities: {entities}")
        print(f"[EXTRACTION] Service request: {extracted_service_request}")
        print(f"[EXTRACTION] Merged booking context: {new_context}")
        
        new_selection_found = bool(entities.get("selected_provider_index") is not None or entities.get("selected_provider_name"))
        
        result = {
            "entities": entities,
            "service_request": extracted_service_request,
            "booking_context": new_context,
            "active_agent": "extraction",
            "execution_logs": [log],
            "reasoning_traces": [trace]
        }
        
        # Only update selected_provider if user actually selected something new
        if new_selection_found and selected_provider:
            result["selected_provider"] = selected_provider
            
        return result


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
            
            # PART 6: Live DB Active Request Context Rehydration
            rehydrated_data = {}
            active_request_id = state.get("active_request_id")
            conversation_id = state.get("conversation_id")
            customer_supabase_id = state.get("user_id")
            
            real_request = None
            if self.db is not None:
                if active_request_id:
                    from bson import ObjectId
                    try:
                        real_request = self.db.active_requests.find_one({"_id": ObjectId(active_request_id)})
                    except Exception as e:
                        print(f"[MEMORY REHYDRATE WARNING] Failed to find request by ID {active_request_id}: {e}")
                
                if not real_request and conversation_id:
                    real_request = self.db.active_requests.find_one({"conversation_id": conversation_id})
                    if real_request:
                        active_request_id = str(real_request["_id"])
                        
                if not real_request and customer_supabase_id and customer_supabase_id != "anonymous":
                    real_request = self.db.active_requests.find_one({
                        "customer_supabase_id": customer_supabase_id,
                        "status": {"$ne": "booked"}
                    })
                    if real_request:
                        active_request_id = str(real_request["_id"])
                
                if real_request:
                    db_status = real_request.get("status", "pending")
                    print(f"[MEMORY REHYDRATE] Rehydrating active request {active_request_id} with status '{db_status}'.")
                    
                    booking_details = {
                        "request_id": active_request_id,
                        "provider_name": real_request.get("provider_name", "Specialist"),
                        "provider_id": real_request.get("provider_supabase_id"),
                        "status": db_status,
                        "timestamp": real_request.get("created_at", datetime.utcnow()).isoformat() if real_request.get("created_at") else datetime.utcnow().isoformat(),
                        "service": real_request.get("service_type"),
                        "location": real_request.get("location", "Unknown"),
                        "offered_price": real_request.get("offered_price"),
                        "requested_date": real_request.get("requested_date"),
                        "requested_time": real_request.get("requested_time")
                    }
                    
                    negotiation_data = state.get("negotiation", {}) or {}
                    booking_data = state.get("booking", {}) or {}
                    
                    updated_negotiation = {
                        **negotiation_data,
                        "negotiation_stage": db_status,
                        "negotiation_status": db_status,
                        "latest_request_status": db_status
                    }
                    
                    updated_booking = {
                        **booking_data,
                        "active_request_id": active_request_id,
                        "active_request": real_request,
                        "latest_request_status": db_status,
                    }
                    
                    rehydrated_data.update({
                        "active_request_id": active_request_id,
                        "latest_request_status": db_status,
                        "negotiation_stage": db_status,
                        "negotiation_status": db_status,
                        "active_request": real_request,
                        "booking_details": booking_details,
                        "negotiation": updated_negotiation,
                        "booking": updated_booking
                    })
            
            log = self.log_action(state, "History Restored", f"Resumed session summary: {summary}. Active request rehydrated: {bool(real_request)}")
            trace = self.create_trace("Summarized previous interaction and rehydrated live active request context from MongoDB.")
            
            return {
                "metadata": {**metadata, "session_summary": summary},
                "active_agent": "memory",
                "execution_logs": [log],
                "reasoning_traces": [trace],
                **rehydrated_data
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

        # Hybrid Search & Retrieval System
        user_query = state["messages"][-1].content
        
        engine = HybridRetrievalEngine(self.db, self.llm)
        search_output = engine.search(user_query)
        
        providers = search_output["results"]
        confidence = search_output["confidence"]
        debug_info = search_output["debug"]
        
        log = self.log_action(state, f"Retrieved {len(providers)} candidates via Hybrid Engine", f"Confidence: {confidence}")
        trace = self.create_trace(f"Executed HybridRetrievalEngine. Found {len(providers)} candidates with {confidence} confidence.")
        
        return {
            "provider_candidates": providers,
            "last_search_results": providers,
            "last_search_query": user_query,
            "retrieval_confidence": confidence,
            "retrieval_debug": debug_info,
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

class NegotiationAgent(BaseAgent):
    def __init__(self, db):
        super().__init__("Negotiation Agent", "Handles provider requests and negotiations")
        self.db = db

    def run(self, state: AgentState) -> Dict[str, Any]:
        intent_obj = state.get("intent", {})
        intent = intent_obj.get("value") if isinstance(intent_obj, dict) else intent_obj
        
        # [OK] Temporary debug - remove after confirming fix works
        print(f"[NEGOTIATION] booking_context from state: {state.get('booking_context')}")
        print(f"[NEGOTIATION] selected_provider from state: {state.get('selected_provider', {}).get('name')}")
        
        # --- STATUS CHECK ROUTINE ---
        if intent == "check_status":
            user_id = state.get("user_id")
            conv_id = state.get("conversation_id")
            booking_details = state.get("booking_details", {}) or {}
            request_id = booking_details.get("request_id") or state.get("active_request_id")
            
            print(f"[STATUS] NegotiationAgent fetching latest DB request: user={user_id}, conv={conv_id}, request={request_id}")
            
            request_doc = None
            if request_id:
                from bson import ObjectId
                try:
                    request_doc = self.db.active_requests.find_one({"_id": ObjectId(request_id)})
                except Exception as e:
                    print(f"[STATUS] Error fetching request by ID {request_id}: {e}")
                    
            if not request_doc:
                query = {}
                if conv_id:
                    query["conversation_id"] = conv_id
                if user_id:
                    query["customer_supabase_id"] = user_id
                    
                if query:
                    request_doc = self.db.active_requests.find_one(query, sort=[("updated_at", -1)])
                    
            if not request_doc and user_id:
                request_doc = self.db.active_requests.find_one(
                    {"customer_supabase_id": user_id},
                    sort=[("updated_at", -1)]
                )
                
            if request_doc:
                req_id_str = str(request_doc["_id"])
                status = request_doc.get("status", "pending")
                print(f"[STATUS] Latest DB request fetched: {req_id_str} | Status: {status}")
                
                log = self.log_action(state, f"Fetched latest request from MongoDB", f"ID: {req_id_str} | Status: {status}")
                trace = self.create_trace(f"Synchronized orchestrator state with live DB status '{status}'.")
                
                updated_booking = {
                    **(booking_details or {}),
                    "request_id": req_id_str,
                    "status": status,
                    "offered_price": request_doc.get("counter_price") if status == "counter_offer" else request_doc.get("offered_price"),
                    "requested_date": request_doc.get("counter_date") if status == "counter_offer" else request_doc.get("requested_date"),
                    "requested_time": request_doc.get("counter_time") if status == "counter_offer" else request_doc.get("requested_time"),
                    "provider_name": request_doc.get("specialization") or "Provider"
                }
                
                last_provider_response = request_doc.get("counter_note") or request_doc.get("provider_note") or ""
                
                # Dynamic stages based on status
                new_conv_stage = "awaiting_response"
                if status in ("counter_offer", "denied"):
                    new_conv_stage = "selection"
                elif status in ("approved", "booked"):
                    new_conv_stage = "completion"
                    
                return {
                    "booking_details": updated_booking,
                    "active_request_id": req_id_str,
                    "latest_request_status": status,
                    "last_provider_response": last_provider_response,
                    "negotiation_stage": status,
                    "conversation_stage": new_conv_stage,
                    "active_agent": "negotiation",
                    "execution_logs": [log],
                    "reasoning_traces": [trace]
                }
            else:
                print("[STATUS] No active request found in DB.")
                log = self.log_action(state, "No active request found in DB", "Proceeding with empty status context.")
                trace = self.create_trace("Evaluated status but found no matching database request record.")
                return {
                    "active_agent": "negotiation",
                    "execution_logs": [log],
                    "reasoning_traces": [trace]
                }
                
        # --- ACTIVE REQUEST INITIALIZATION ROUTINE ---
        selected = state.get("selected_provider")
        booking_ctx = state.get("booking_context", {}) or {}
        
        if not selected:
            log = self.log_action(state, "Negotiation failed", "No provider selected in state.")
            return {"active_agent": "negotiation", "execution_logs": [log]}

        from datetime import datetime
        
        # Get customer details if possible
        customer_name = "Valued Customer"
        customer_phone = "Not provided"
        customer_email = "Not provided"
        
        user_id = state.get("user_id") or "anonymous"
        conversation_id = state.get("conversation_id")
        
        if (not user_id or user_id == "anonymous") and conversation_id:
            try:
                from bson import ObjectId
                conv_doc = self.db.conversations.find_one({"_id": ObjectId(conversation_id)})
                if conv_doc and conv_doc.get("user_id"):
                    user_id = conv_doc.get("user_id")
                    print(f"[NEGOTIATION] Resolved real customer user_id={user_id} from conversations collection.")
            except Exception as e:
                print(f"[NEGOTIATION] Failed to resolve user_id from conversations collection: {e}")
                
        customer_location = "Not provided"
        customer_avatar = ""
        if user_id and user_id != "anonymous":
            try:
                user_doc = self.db.users.find_one({"supabase_id": user_id})
                if user_doc:
                    customer_name = user_doc.get("name") or customer_name
                    customer_phone = user_doc.get("phone") or customer_phone
                    customer_email = user_doc.get("email") or customer_email
                    customer_location = user_doc.get("location") or customer_location
                    customer_avatar = user_doc.get("avatar_url") or customer_avatar
            except Exception as e:
                print(f"[NEGOTIATION] Failed to fetch customer details: {e}")

        # Retrieve Provider full snapshot
        provider_supabase_id = selected.get("provider_supabase_id") or selected.get("provider_id") or "anonymous_provider"
        provider_name = selected.get("name") or "Specialist"
        provider_phone = "Not provided"
        provider_email = "Not provided"
        provider_location = "Not provided"
        provider_avatar = ""
        try:
            prov_doc = self.db.provider_info.find_one({"supabase_id": provider_supabase_id})
            if prov_doc:
                provider_name = prov_doc.get("name") or provider_name
                provider_phone = prov_doc.get("phone") or provider_phone
                provider_email = prov_doc.get("email") or provider_email
                provider_location = prov_doc.get("location") or provider_location
                provider_avatar = prov_doc.get("avatar_url") or provider_avatar
            
            # fallback/merge with user details
            prov_user_doc = self.db.users.find_one({"supabase_id": provider_supabase_id})
            if prov_user_doc:
                provider_phone = prov_user_doc.get("phone") or provider_phone
                provider_email = prov_user_doc.get("email") or provider_email
                provider_location = prov_user_doc.get("location") or provider_location
                provider_avatar = prov_user_doc.get("avatar_url") or provider_avatar
        except Exception as e:
            print(f"[NEGOTIATION] Failed to fetch provider details: {e}")
        offered_price = booking_ctx.get("offered_price")
        requested_date = booking_ctx.get("requested_date")
        requested_time = booking_ctx.get("requested_time")
        service_type = selected.get("service_type") or state.get("service_request", {}).get("service_type") or "General Service"
        specialization = selected.get("specialization") or "Specialist"
        location = selected.get("location") or state.get("service_request", {}).get("location") or "Unknown"

        # Step 1: Validate Payload
        print("[NEGOTIATION] Validating active request context")
        if not offered_price or not requested_date or not requested_time:
            print("[NEGOTIATION ERROR] Missing payload values for active request creation")
            log = self.log_action(state, "Negotiation failed", "Missing booking context fields (price, date, or time).")
            return {
                "active_agent": "negotiation", 
                "execution_logs": [log],
                "errors": ["Missing price, date, or time parameters for request dispatching."]
            }
        print("[NEGOTIATION] Payload validated")

        # Step 2: Prevent Duplicate Active Requests
        # If an active request already exists for this thread and provider with a non-terminal status, reuse it.
        try:
            existing_req = self.db.active_requests.find_one({
                "conversation_id": conversation_id,
                "provider_supabase_id": provider_supabase_id,
                "status": {"$in": ["pending", "counter_offer", "approved"]}
            })
            if existing_req:
                request_id = str(existing_req["_id"])
                print(f"[NEGOTIATION] Active request already exists with ID: {request_id}. Reusing/Skipping creation.")
                log = self.log_action(state, "Active request already exists", f"Reusing ID: {request_id}")
                trace = self.create_trace(f"Reused existing active request {request_id} to avoid duplication.")
                
                # Update state variables
                booking_details = {
                    "request_id": request_id,
                    "provider_name": selected.get("name"),
                    "provider_id": selected.get("_id"),
                    "status": existing_req.get("status", "pending"),
                    "timestamp": existing_req.get("created_at", datetime.utcnow()).isoformat(),
                    "service": service_type,
                    "location": location,
                    "offered_price": offered_price,
                    "requested_date": requested_date,
                    "requested_time": requested_time
                }
                
                return {
                    "active_request_id": request_id,
                    "request_creation_success": True,
                    "negotiation_stage": existing_req.get("status", "pending"),
                    "pending_provider_id": provider_supabase_id,
                    "latest_offer": {"price": offered_price, "date": requested_date, "time": requested_time},
                    "request_status": existing_req.get("status", "pending"),
                    "latest_request_status": existing_req.get("status", "pending"),
                    "booking_details": booking_details,
                    "active_agent": "negotiation",
                    "execution_logs": [log],
                    "reasoning_traces": [trace],
                    "workflow_stage": "booking_initiation",
                    "conversation_stage": "awaiting_response"
                }
        except Exception as dup_err:
            print(f"[NEGOTIATION WARNING] Duplicate check failed: {dup_err}")

        # Return negotiation details that are collected, confirmed, and ready to be processed by RequestCreationAgent
        log = self.log_action(state, "Negotiation parameters confirmed", f"Provider: {provider_name} | Price: {offered_price} | Date: {requested_date} | Time: {requested_time}")
        trace = self.create_trace(f"Collected and verified negotiation parameters for provider {provider_name}. Ready to transact.")
        
        booking_details = {
            "provider_name": provider_name,
            "provider_id": selected.get("_id"),
            "status": "pending",
            "timestamp": datetime.utcnow().isoformat(),
            "service": service_type,
            "location": location,
            "offered_price": offered_price,
            "requested_date": requested_date,
            "requested_time": requested_time
        }
        
        return {
            "negotiation_stage": "pending",
            "pending_provider_id": provider_supabase_id,
            "latest_offer": {"price": offered_price, "date": requested_date, "time": requested_time},
            "booking_details": booking_details,
            "active_agent": "negotiation",
            "execution_logs": [log],
            "reasoning_traces": [trace],
            "workflow_stage": "booking_initiation",
            "conversation_stage": "awaiting_response"
        }
class RequestCreationAgent(BaseAgent):
    def __init__(self, db):
        super().__init__("Request Creation Agent", "Transactional Request Dispatcher")
        self.db = db

    def run(self, state: AgentState) -> Dict[str, Any]:
        from datetime import datetime
        import traceback
        from bson import ObjectId

        print("\n[REQUEST FLOW] >>> ENTERING REQUEST CREATION AGENT <<<")
        
        # 1. Retrieve essential values from state
        conversation_id = state.get("conversation_id")
        user_id = state.get("user_id") or "anonymous"
        selected = state.get("selected_provider", {}) or {}
        booking_ctx = state.get("booking_context", {}) or {}
        
        provider_supabase_id = selected.get("provider_supabase_id") or selected.get("provider_id")
        customer_supabase_id = user_id
        service_type = selected.get("service_type") or state.get("service_request", {}).get("service_type")
        requested_date = booking_ctx.get("requested_date")
        requested_time = booking_ctx.get("requested_time")
        offered_price = booking_ctx.get("offered_price")

        # Log active validation parameters
        print(f"[REQUEST FLOW] Starting validation process for Active Request:")
        print(f"  - Provider Supabase ID: {provider_supabase_id}")
        print(f"  - Customer Supabase ID: {customer_supabase_id}")
        print(f"  - Service Type: {service_type}")
        print(f"  - Requested Date: {requested_date}")
        print(f"  - Requested Time: {requested_time}")
        print(f"  - Offered Price: {offered_price}")

        # HARD VALIDATION: Stop workflow on missing fields
        missing_fields = []
        if not provider_supabase_id: missing_fields.append("provider_supabase_id")
        if not customer_supabase_id or customer_supabase_id == "anonymous": missing_fields.append("customer_supabase_id")
        if not service_type: missing_fields.append("service_type")
        if not requested_date: missing_fields.append("requested_date")
        if not requested_time: missing_fields.append("requested_time")
        if not offered_price: missing_fields.append("offered_price")

        if missing_fields:
            err_msg = f"Hard validation failed. Missing required fields: {', '.join(missing_fields)}"
            print(f"[REQUEST FLOW ERROR] {err_msg}")
            log = self.log_action(state, "Validation Error", err_msg)
            return {
                "request_creation_success": False,
                "request_creation_error": err_msg,
                "active_agent": "request_creation",
                "execution_logs": [log],
                "errors": [err_msg]
            }

        try:
            # DUPLICATE CREATE GUARD (PART 3)
            print("[REQUEST FLOW] Checking for existing active request to prevent duplicates...")
            existing_req = self.db.active_requests.find_one({
                "conversation_id": conversation_id,
                "status": {"$in": ["pending", "counter_offer"]}
            })
            
            if existing_req:
                existing_id = str(existing_req["_id"])
                print(f"[REQUEST FLOW WARNING] Duplicate request suppressed. Rehydrating existing ID: {existing_id}")
                
                booking_details = {
                    "request_id": existing_id,
                    "provider_name": existing_req.get("provider_name", "Specialist"),
                    "provider_id": existing_req.get("provider_supabase_id"),
                    "status": existing_req.get("status"),
                    "timestamp": existing_req.get("created_at", datetime.utcnow()).isoformat() if existing_req.get("created_at") else datetime.utcnow().isoformat(),
                    "service": existing_req.get("service_type"),
                    "location": existing_req.get("location", "Unknown"),
                    "offered_price": existing_req.get("offered_price"),
                    "requested_date": existing_req.get("requested_date"),
                    "requested_time": existing_req.get("requested_time")
                }
                
                log = self.log_action(state, "Duplicate request suppressed", f"Rehydrating ID: {existing_id}")
                trace = self.create_trace(f"Found existing active request {existing_id} for conversation. Suppressed duplicate insertion.")
                
                return {
                    "active_request_id": existing_id,
                    "request_creation_success": True,
                    "request_id": existing_id,
                    "request_data": existing_req,
                    "negotiation_stage": existing_req.get("status"),
                    "pending_provider_id": existing_req.get("provider_supabase_id"),
                    "latest_offer": {"price": existing_req.get("offered_price"), "date": existing_req.get("requested_date"), "time": existing_req.get("requested_time")},
                    "request_status": existing_req.get("status"),
                    "latest_request_status": existing_req.get("status"),
                    "booking_details": booking_details,
                    "active_agent": "request_creation",
                    "execution_logs": [log],
                    "reasoning_traces": [trace],
                    "workflow_stage": "booking_initiation",
                    "conversation_stage": "awaiting_response"
                }

            # 2. Entity existence verification
            # Customer lookup
            print("[REQUEST FLOW] Validating customer existence in MongoDB...")
            customer_doc = self.db.users.find_one({"supabase_id": customer_supabase_id})
            if not customer_doc:
                err_msg = f"Customer profile not found for supabase_id: {customer_supabase_id}"
                print(f"[REQUEST FLOW ERROR] {err_msg}")
                log = self.log_action(state, "Entity Verification Error", err_msg)
                return {
                    "request_creation_success": False,
                    "request_creation_error": err_msg,
                    "active_agent": "request_creation",
                    "execution_logs": [log],
                    "errors": [err_msg]
                }
            print(f"[REQUEST FLOW] Customer verified: {customer_doc.get('name')} (email: {customer_doc.get('email')})")

            # Provider lookup
            print("[REQUEST FLOW] Validating provider existence in MongoDB...")
            provider_doc = self.db.provider_info.find_one({"supabase_id": provider_supabase_id})
            if not provider_doc:
                # fallback user check
                provider_doc = self.db.users.find_one({"supabase_id": provider_supabase_id})
            
            if not provider_doc:
                err_msg = f"Provider profile not found for supabase_id: {provider_supabase_id}"
                print(f"[REQUEST FLOW ERROR] {err_msg}")
                log = self.log_action(state, "Entity Verification Error", err_msg)
                return {
                    "request_creation_success": False,
                    "request_creation_error": err_msg,
                    "active_agent": "request_creation",
                    "execution_logs": [log],
                    "errors": [err_msg]
                }
            provider_name = provider_doc.get("name") or "Specialist"
            print(f"[REQUEST FLOW] Provider verified: {provider_name} (email: {provider_doc.get('email')})")

            # Service lookup
            print("[REQUEST FLOW] Validating service existence in MongoDB...")
            service_doc = None
            service_id = selected.get("_id") or selected.get("service_id")
            if service_id:
                try:
                    service_doc = self.db.service_providers.find_one({"_id": ObjectId(service_id)})
                except Exception as oid_err:
                    print(f"[REQUEST FLOW] service_id ObjectId parsing skipped: {oid_err}")
            
            if not service_doc:
                # search by provider_supabase_id
                service_doc = self.db.service_providers.find_one({"provider_supabase_id": provider_supabase_id})
                
            if not service_doc:
                err_msg = f"No active service listing found for provider {provider_supabase_id} / {provider_name}"
                print(f"[REQUEST FLOW ERROR] {err_msg}")
                log = self.log_action(state, "Entity Verification Error", err_msg)
                return {
                    "request_creation_success": False,
                    "request_creation_error": err_msg,
                    "active_agent": "request_creation",
                    "execution_logs": [log],
                    "errors": [err_msg]
                }
            print(f"[REQUEST FLOW] Service listing verified: {service_doc.get('service_type')} by provider {provider_supabase_id}")

            # 3. Build snapshot details for request
            customer_name = customer_doc.get("name") or "Valued Client"
            customer_phone = customer_doc.get("phone") or "Not provided"
            customer_email = customer_doc.get("email") or "Not provided"
            customer_location = customer_doc.get("location") or "Not provided"
            customer_avatar = customer_doc.get("avatar_url") or ""

            provider_phone = provider_doc.get("phone") or "Not provided"
            provider_email = provider_doc.get("email") or "Not provided"
            provider_location = provider_doc.get("location") or "Not provided"
            provider_avatar = provider_doc.get("avatar_url") or ""

            specialization = selected.get("specialization") or service_doc.get("specialization") or "Specialist"
            location = selected.get("location") or service_doc.get("location") or "Unknown"

            request_doc = {
                "conversation_id": conversation_id,
                "provider_supabase_id": provider_supabase_id,
                "provider_name": provider_name,
                "provider_phone": provider_phone,
                "provider_email": provider_email,
                "provider_location": provider_location,
                "provider_avatar": provider_avatar,
                
                "customer_supabase_id": customer_supabase_id,
                "customer_name": customer_name,
                "customer_phone": customer_phone,
                "customer_email": customer_email,
                "customer_location": customer_location,
                "customer_avatar": customer_avatar,
                
                "service_type": service_type,
                "specialization": specialization,
                "location": location,
                "offered_price": offered_price,
                "requested_date": requested_date,
                "requested_time": requested_time,
                "status": "pending",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }

            # 4. Perform Mongo Insert
            print("[REQUEST FLOW] Payload prepared, Mongo insert started...")
            result = self.db.active_requests.insert_one(request_doc)
            
            if not result or not result.acknowledged or not result.inserted_id:
                raise RuntimeError("MongoDB insert_one operation was not acknowledged or did not return an inserted_id.")
                
            request_id = str(result.inserted_id)
            print(f"[REQUEST FLOW] Mongo insert success. inserted_id: {request_id}")

            # 5. POST-INSERT VERIFICATION: Fetch immediately to confirm presence
            print(f"[REQUEST FLOW] Initiating post-insert verification for request ID: {request_id}")
            verified_doc = self.db.active_requests.find_one({"_id": ObjectId(request_id)})
            
            if not verified_doc:
                raise RuntimeError(f"Post-insert verification failed! Request document {request_id} not found in database immediately after insertion.")
            
            print(f"[REQUEST FLOW] Request verification success. Confirmed document: {verified_doc.get('_id')}")

            # 6. TRIGGER ALERTS & NOTIFICATIONS (Only after success is guaranteed)
            booking_details = {
                "request_id": request_id,
                "provider_name": provider_name,
                "provider_id": str(service_doc.get("_id")),
                "status": "pending",
                "timestamp": datetime.utcnow().isoformat(),
                "service": service_type,
                "location": location,
                "offered_price": offered_price,
                "requested_date": requested_date,
                "requested_time": requested_time
            }

            try:
                from app import socketio
                
                # Insert DB notification
                self.db.notifications.insert_one({
                    "user_supabase_id": provider_supabase_id,
                    "role": "seller",
                    "type": "new_request",
                    "title": "New Service Request",
                    "message": f"You received a new {service_type} request from {customer_name} for {requested_date} at {requested_time}.",
                    "related_id": request_id,
                    "status": "unread",
                    "created_at": datetime.utcnow()
                })
                
                # Emit events to websocket clients
                socketio.emit('new_provider_request', {
                    "request_id": request_id,
                    "provider_supabase_id": provider_supabase_id,
                    "customer_name": customer_name,
                    "price": offered_price,
                    "date": requested_date,
                    "time": requested_time,
                    "location": location,
                    "contact_phone": customer_phone,
                    "contact_email": customer_email,
                    "specialization": specialization,
                    "service_type": service_type
                })
                
                socketio.emit('new_service_request', {
                    "request_id": request_id,
                    "provider_supabase_id": provider_supabase_id,
                    "customer_name": customer_name,
                    "service_type": service_type,
                    "offered_price": offered_price,
                    "requested_date": requested_date,
                    "requested_time": requested_time
                })
                print(f"[REQUEST FLOW] Successfully triggered Socket.IO emits and saved DB notification.")
            except Exception as socket_err:
                print(f"[REQUEST FLOW WARNING] Socket notifications skipped or failed: {socket_err}")

            log = self.log_action(state, "Active request confirmed and inserted", f"Request ID: {request_id}")
            trace = self.create_trace(f"Verified request {request_id} created successfully and triggered real-time seller alerts.")
            
            return {
                "active_request_id": request_id,
                "request_creation_success": True,
                "request_id": request_id,
                "request_data": request_doc,
                "negotiation_stage": "pending",
                "pending_provider_id": provider_supabase_id,
                "latest_offer": {"price": offered_price, "date": requested_date, "time": requested_time},
                "request_status": "pending",
                "latest_request_status": "pending",
                "booking_details": booking_details,
                "active_agent": "request_creation",
                "execution_logs": [log],
                "reasoning_traces": [trace],
                "workflow_stage": "booking_initiation",
                "conversation_stage": "awaiting_response"
            }

        except Exception as err:
            tb_str = traceback.format_exc()
            print(f"[REQUEST FLOW ERROR] Traceback of database or validation failure:\n{tb_str}")
            log = self.log_action(state, "Request Creation Exception", f"Error: {err}")
            return {
                "request_creation_success": False,
                "request_creation_error": f"Orchestration database insertion exception: {str(err)}",
                "active_agent": "request_creation",
                "execution_logs": [log],
                "errors": [f"Request creation failed: {str(err)}"]
            }

class BookingAgent(BaseAgent):
    def __init__(self, db):
        super().__init__("Booking Agent", "Transaction Management Engine")
        self.db = db

    def run(self, state: AgentState) -> Dict[str, Any]:
        from datetime import datetime
        print("[BOOKING] Initiating final booking confirmation stage")
        
        user_id = state.get("user_id") or "anonymous"
        conversation_id = state.get("conversation_id")
        booking_details = state.get("booking_details", {}) or {}
        
        # 1. Fetch the request ID from state
        request_id = state.get("active_request_id") or booking_details.get("request_id")
        
        if not request_id:
            print("[BOOKING ERROR] No active request ID found in state")
            log = self.log_action(state, "Booking failed", "Missing request tracking ID.")
            return {
                "active_agent": "booking",
                "execution_logs": [log],
                "errors": ["No active request found to confirm. Please request a service first."]
            }
            
        from bson import ObjectId
        request_doc = None
        try:
            request_doc = self.db.active_requests.find_one({"_id": ObjectId(request_id)})
        except Exception as fetch_err:
            print(f"[BOOKING ERROR] Failed to fetch request doc: {fetch_err}")
            
        if not request_doc:
            print(f"[BOOKING ERROR] Active request record not found in MongoDB for ID: {request_id}")
            log = self.log_action(state, "Booking failed", f"Request {request_id} not found in DB.")
            return {
                "active_agent": "booking",
                "execution_logs": [log],
                "errors": ["Matching negotiation record not found in database."]
            }
            
        status = request_doc.get("status", "pending")
        provider_supabase_id = request_doc.get("provider_supabase_id")
        customer_id = request_doc.get("customer_supabase_id") or user_id
        
        # 2. Prevent Booking before Provider Approval
        if status != "approved":
            print(f"[BOOKING ERROR] Premature booking attempt. Current status is '{status}', must be 'approved'")
            log = self.log_action(state, "Booking rejected", f"Request status is '{status}' (requires 'approved').")
            trace = self.create_trace("Safety check failed: provider has not approved this request yet.")
            
            return {
                "active_agent": "booking",
                "execution_logs": [log],
                "reasoning_traces": [trace],
                "errors": ["Provider has not approved the slot yet. Current status: " + status]
            }
            
        # 3. Prevent Duplicate Booking Creation
        final_price = request_doc.get("counter_price") or request_doc.get("offered_price")
        final_date = request_doc.get("counter_date") or request_doc.get("requested_date")
        final_time = request_doc.get("counter_time") or request_doc.get("requested_time")
        
        try:
            existing_booking = self.db.bookings.find_one({
                "customer_supabase_id": customer_id,
                "provider_supabase_id": provider_supabase_id,
                "date": final_date,
                "time": final_time,
                "status": "confirmed"
            })
            if existing_booking:
                print("[BOOKING] Duplicate booking detected in DB, skipping insert.")
                log = self.log_action(state, "Duplicate booking prevented", "Slot is already confirmed in DB.")
                trace = self.create_trace("Avoided duplicate document creation in bookings collection.")
                
                # Update request status to booked just in case
                self.db.active_requests.update_one(
                    {"_id": ObjectId(request_id)},
                    {"$set": {"status": "booked", "updated_at": datetime.utcnow()}}
                )
                
                updated_booking = {
                    **booking_details,
                    "request_id": request_id,
                    "status": "confirmed",
                    "timestamp": datetime.utcnow().isoformat(),
                    "service": request_doc.get("service_type"),
                    "location": request_doc.get("location"),
                    "offered_price": final_price,
                    "requested_date": final_date,
                    "requested_time": final_time
                }
                
                return {
                    "booking_details": updated_booking,
                    "latest_request_status": "booked",
                    "negotiation_stage": "booked",
                    "conversation_stage": "completion",
                    "active_agent": "booking",
                    "execution_logs": [log],
                    "reasoning_traces": [trace]
                }
        except Exception as dup_err:
            print(f"[BOOKING WARNING] Duplicate booking check failed: {dup_err}")

        # 4. Insert Verified Transaction Document
        booking_doc = {
            # Customer Snapshot
            "customer_supabase_id": customer_id,
            "customer_name": request_doc.get("customer_name"),
            "customer_phone": request_doc.get("customer_phone") or request_doc.get("contact_phone", "Not provided"),
            "customer_email": request_doc.get("customer_email") or request_doc.get("contact_email", "Not provided"),
            "customer_location": request_doc.get("customer_location", "Not provided"),
            "customer_avatar": request_doc.get("customer_avatar", ""),
            
            # Provider Snapshot
            "provider_supabase_id": provider_supabase_id,
            "provider_name": request_doc.get("provider_name"),
            "provider_phone": request_doc.get("provider_phone", "Not provided"),
            "provider_email": request_doc.get("provider_email", "Not provided"),
            "provider_location": request_doc.get("provider_location", "Not provided"),
            "provider_avatar": request_doc.get("provider_avatar", ""),
            
            # Service Details
            "service_type": request_doc.get("service_type"),
            "specialization": request_doc.get("specialization") or request_doc.get("service_type"),
            "offered_price": request_doc.get("offered_price"),
            "price": final_price,
            "requested_date": final_date,
            "requested_time": final_time,
            "location": request_doc.get("location") or request_doc.get("customer_location", "Not provided"),
            "status": "confirmed",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "conversation_id": conversation_id
        }
        
        try:
            print("[MONGO] Inserting confirmed booking document")
            result = self.db.bookings.insert_one(booking_doc)
            if not (result.acknowledged and result.inserted_id):
                raise Exception("MongoDB failed to acknowledge insert")
            print(f"[MONGO] Booking created successfully. Inserted ID: {result.inserted_id}")
        except Exception as insert_err:
            print(f"[MONGO ERROR] Failed to create booking document: {insert_err}")
            log = self.log_action(state, "Booking persistence failed", "Failed to write booking to database.")
            return {
                "active_agent": "booking",
                "execution_logs": [log],
                "errors": ["Failed to write final booking document to database."]
            }
            
        # 5. Clean up active request from DB upon successful booking
        try:
            self.db.active_requests.delete_one({"_id": ObjectId(request_id)})
            print(f"[MONGO] Cleaned up active request {request_id} from active_requests collection.")
        except Exception as cleanup_err:
            print(f"[MONGO WARNING] Failed to delete active request from DB: {cleanup_err}")

        # 6. Dispatch Notifications & Sockets
        try:
            from app import socketio
            svc_type = request_doc.get("service_type")
            
            # Notify Provider
            self.db.notifications.insert_one({
                "user_supabase_id": provider_supabase_id,
                "role": "seller",
                "type": "booking_confirmed",
                "title": "Booking Confirmed!",
                "message": f"Awesome! The customer confirmed the {svc_type} booking for {final_date} at {final_time}.",
                "related_id": str(result.inserted_id),
                "status": "unread",
                "created_at": datetime.utcnow()
            })
            socketio.emit('booking_notification', {"user_supabase_id": provider_supabase_id})
            
            # Notify Customer
            self.db.notifications.insert_one({
                "user_supabase_id": customer_id,
                "role": "buyer",
                "type": "booking_confirmed",
                "title": "Booking Confirmed!",
                "message": f"Your {svc_type} booking with the provider is confirmed for {final_date} at {final_time}.",
                "related_id": str(result.inserted_id),
                "status": "unread",
                "created_at": datetime.utcnow()
            })
            socketio.emit('booking_notification', {"user_supabase_id": customer_id})
            
        except Exception as notif_err:
            print(f"[BOOKING NOTIF ERROR] Failed to dispatch notifications: {notif_err}")

        log = self.log_action(state, "Booking successfully confirmed", f"Inserted booking record and synced DB status.")
        trace = self.create_trace("Transaction finalized. Bookings document created and active request marked as booked.")
        
        updated_booking = {
            **booking_details,
            "request_id": request_id,
            "status": "confirmed",
            "timestamp": datetime.utcnow().isoformat(),
            "service": request_doc.get("service_type"),
            "location": request_doc.get("location"),
            "offered_price": final_price,
            "requested_date": final_date,
            "requested_time": final_time
        }
        
        return {
            "booking_details": updated_booking,
            "latest_request_status": "booked",
            "negotiation_stage": "booked",
            "conversation_stage": "completion",
            "active_agent": "booking",
            "execution_logs": [log],
            "reasoning_traces": [trace]
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
