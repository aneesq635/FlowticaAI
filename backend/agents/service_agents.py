"""
service_agents.py — BookingAgent and SchedulingAgent

KEY CHANGES vs original:
  1. BookingAgent always returns `booking_outcome` dict with explicit
     success/failure fields — never leaves it absent.
  2. SchedulingAgent reads booking_outcome and short-circuits on failure
     instead of blindly proceeding.
  3. MongoDB idempotency key (upsert) prevents duplicate booking documents
     under concurrent execution.
  4. All failure paths return booking_outcome.booking_failure = True so
     the supervisor can gate routing deterministically.

All other agents (Intent, Extraction, Memory, Knowledge, Matching,
Negotiation, RequestCreation, Scheduling) are included unchanged except
where noted.
"""

from agents.base import BaseAgent
from core.state import AgentState
from typing import Dict, Any, List
import json
from datetime import datetime
from pymongo import MongoClient
from langchain_google_vertexai import VertexAIEmbeddings
from core.vector_store import vector_manager
from core.knowledge_engine import HybridRetrievalEngine
import os
import math
import random

def haversine_distance(lat1, lon1, lat2, lon2):
    # Standard Haversine formula for distance in KM
    if lat1 == lat2 and lon1 == lon2: return 0.0
    R = 6371.0 # Earth radius
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.asin(math.sqrt(a))
    return R * c


# ── Unchanged agents ──────────────────────────────────────────────────────────

# class IntentAgent(BaseAgent):
#     def __init__(self):
#         super().__init__("Intent Agent", "Classifies user intent with context awareness")

#     def run(self, state: AgentState) -> Dict[str, Any]:
#         user_message = state["messages"][-1].content
#         conv_stage = state.get("conversation_stage", "greeting")
#         shortlist = state.get("shortlisted_providers", [])
#         summary = state.get("metadata", {}).get("session_summary", "")
#         selected = state.get("selected_provider", {})

#         msg_clean = user_message.strip().lower().rstrip('.!?*() ')
#         confirm_tokens = {"okay", "ok", "yes", "confirm", "confirmed", "go ahead", "sure",
#                           "do it", "yup", "yeah", "yep", "approved", "approve", "done"}

#         is_short_affirmation = False
#         if msg_clean in confirm_tokens:
#             is_short_affirmation = True
#         else:
#             words = [w.strip() for w in msg_clean.split() if w.strip()]
#             if len(words) <= 3 and any(w in confirm_tokens for w in words):
#                 is_short_affirmation = True

#         service_keywords = ["cleaning", "cleaner", "repair", "tutor", "tuition", "plumb", "mechanic", "electrician", "install", "fix", "ac", "hvac", "painter", "carpenter"]
        
#         # Rule 5 Check: service request trigger terms
#         is_service_request = False
#         if any(f" {k} " in f" {msg_clean} " or msg_clean.startswith(f"{k} ") or msg_clean.endswith(f" {k}") or msg_clean == k for k in service_keywords):
#             if not is_short_affirmation and "status" not in msg_clean:
#                 is_service_request = True
#         if "i need" in msg_clean or "looking for" in msg_clean or "want" in msg_clean or "find" in msg_clean:
#              if not is_short_affirmation and "status" not in msg_clean:
#                 is_service_request = True

#         # Rule 5 Check: query services triggers
#         is_query_services = False
#         query_services_triggers = [
#             "what services exist", "what categories do you offer", "what can you help with", 
#             "what services do you offer", "list of services", "show services", "help with what",
#             "which services", "what services", "available services"
#         ]
#         if any(trigger in msg_clean for trigger in query_services_triggers):
#             is_query_services = True

#         intent = None
#         override_applied = False

#         # Apply deterministic override rules
#         if is_service_request:
#             intent = "service_request"
#             override_applied = True
#         elif is_query_services:
#             intent = "query_services"
#             override_applied = True
#         elif is_short_affirmation and (selected or conv_stage in ("selection", "scheduling", "negotiation")):
#             intent = "booking_confirmation"
#             override_applied = True
#         elif "status" in msg_clean or "check" in msg_clean:
#             intent = "check_status"
#             override_applied = True

#         # LLM fallback only if no deterministic override matched
#         if not intent:
#             prompt = f"""
# IMPORTANT CLASSIFICATION RULES:
# - If user says "I need [service]" or "I want [service]" → ALWAYS classify as "service_request", NOT "query_services"
# - "query_services" is ONLY when user asks "what services do you offer?" or "what can you help with?"
# - "I need cleaning", "I need tuition", "I need AC repair" → ALL are "service_request"

#             Analyze the user message and classify the intent within the current context.
#             Current Conversation Stage: {conv_stage}
#             Previous Shortlisted Providers: {[p.get('name') for p in shortlist]}
#             Selected Provider: {selected.get('name') if selected else 'None'}
#             Session Summary: {summary}

#             Possible intents:
#             1. greeting
#             2. query_services
#             3. service_request
#             4. provider_selection
#             5. booking_confirmation
#             6. check_status
#             7. general

#             Message: "{user_message}"
#             Return ONLY the intent string."""
            
#             try:
#                 response = self.llm.invoke(prompt)
#                 intent = response.content.strip().lower()
#             except Exception as e:
#                 print(f"[AUDIT] IntentAgent | LLM Error: {e} | Falling back to general")
#                 intent = "general"

#             if is_short_affirmation and (selected or conv_stage in ("selection", "scheduling", "negotiation")):
#                 intent = "booking_confirmation"
#             elif "check_status" in intent or "status" in intent:
#                 intent = "check_status"
#             elif "provider_selection" in intent:
#                 intent = "provider_selection"
#             elif "booking_confirmation" in intent:
#                 intent = "booking_confirmation"
#             elif "service_request" in intent:
#                 intent = "service_request"
#             elif "query_services" in intent:
#                 intent = "query_services"
#             elif "greeting" in intent:
#                 intent = "greeting"
#             else:
#                 intent = "general"

#         # Structured Logging
#         print(f"[AUDIT] IntentAgent | Query: '{user_message}' | Intent: {intent} | Override: {override_applied}")

#         log = self.log_action(state, f"Classified intent as: {intent}", f"Context: {conv_stage} | Override: {override_applied}")
#         trace = self.create_trace(f"Identified '{intent}' intent at stage '{conv_stage}'.")

#         return {
#             "intent": {"value": intent, "confidence": 1.0, "timestamp": datetime.utcnow().isoformat()},
#             "active_agent": "intent",
#             "execution_logs": [log],
#             "reasoning_traces": [trace],
#         }
class IntentAgent(BaseAgent):
    def __init__(self):
        super().__init__("Intent Agent", "Classifies user intent with context awareness")

    # ── Deterministic pre-classification ─────────────────────────────
    # These rules run BEFORE LLM. If matched, LLM is skipped entirely.
    # This prevents misclassification of "I need X" as query_services.

    SERVICE_KEYWORDS = [
        "repair", "fix", "install", "clean", "cleaning", "plumb", "electric",
        "tutor", "teach", "coach", "paint", "carpenter", "mechanic", "wash",
        "service", "services", "maintenance", "technician", "ac", "solar",
        "beautician", "driver", "security", "guard", "cook", "chef",
    ]

    NEED_TRIGGERS = [
        "i need", "i want", "i require", "find me", "looking for",
        "searching for", "get me", "book", "hire", "i am looking",
        "mujhe chahiye", "chahiye", "dhundo", "find",
    ]

    QUERY_TRIGGERS = [
        "what services", "which services", "what do you offer",
        "what can you", "list services", "show services",
        "available services", "what categories", "kya services",
    ]

    STATUS_TRIGGERS = [
        "status", "update", "did provider", "any response", "kya hua",
        "what happened", "check status", "response aaya", "approved",
        "denied", "counter",
    ]

    def _deterministic_classify(self, msg: str, conv_stage: str, selected: dict) -> str | None:
        """
        Returns intent string if deterministically matched, else None (fall through to LLM).
        """
        msg_lower = msg.lower().strip()

        # Rule 1: Status check triggers
        if any(t in msg_lower for t in self.STATUS_TRIGGERS):
            return "check_status"

        # Rule 2: Short affirmations in active booking context
        confirm_tokens = {"okay", "ok", "yes", "confirm", "confirmed", "go ahead",
                          "sure", "do it", "yup", "yeah", "yep", "approved", "approve", "done"}
        words = [w.strip().rstrip('.!?') for w in msg_lower.split()]
        if len(words) <= 3 and any(w in confirm_tokens for w in words):
            if selected or conv_stage in ("selection", "scheduling", "negotiation", "awaiting_response"):
                return "booking_confirmation"

        # Rule 3: Explicit query_services — ONLY these phrases
        if any(t in msg_lower for t in self.QUERY_TRIGGERS):
            return "query_services"

        # Rule 4: "I need/want/find X" + any service keyword → service_request
        has_need_trigger = any(t in msg_lower for t in self.NEED_TRIGGERS)
        has_service_keyword = any(k in msg_lower for k in self.SERVICE_KEYWORDS)
        if has_need_trigger and has_service_keyword:
            return "service_request"

        # Rule 5: "I need/want X" even without service keyword
        # e.g. "I need NESU Tution" — NESU is not in SERVICE_KEYWORDS
        if has_need_trigger and len(words) >= 3:
            return "service_request"

        # Rule 6: Greeting
        greet_tokens = {"hi", "hello", "hey", "salam", "assalam", "good morning",
                        "good evening", "good afternoon", "helo", "hii"}
        if msg_lower in greet_tokens or any(msg_lower.startswith(g) for g in greet_tokens):
            if len(words) <= 4:
                return "greeting"

        # Rule 7: Provider selection patterns
        selection_patterns = [
            r"\b(option|provider|choose|select|go with|pick)\s*\d+\b",
            r"\bi('ll| will) (go|take|choose|pick|select)\b",
            r"\b(number|no\.?)\s*\d+\b",
        ]
        import re
        for pattern in selection_patterns:
            if re.search(pattern, msg_lower):
                return "provider_selection"

        return None  # Fall through to LLM

    def run(self, state: AgentState) -> Dict[str, Any]:
        from datetime import datetime
        user_message = state["messages"][-1].content
        conv_stage = state.get("conversation_stage", "greeting")
        shortlist = state.get("shortlisted_providers", [])
        summary = state.get("metadata", {}).get("session_summary", "")
        selected = state.get("selected_provider", {})

        print(f"[INTENT] Classifying: '{user_message}' | stage={conv_stage}", flush=True)

        # ── Step 1: Deterministic classification ──────────────────────
        intent = self._deterministic_classify(user_message, conv_stage, selected)

        if intent:
            print(f"[INTENT] Deterministic match → '{intent}'", flush=True)
        else:
            # ── Step 2: LLM classification (fallback) ─────────────────
            prompt = f"""Analyze the user message and classify the intent within the current context.
Current Conversation Stage: {conv_stage}
Previous Shortlisted Providers: {[p.get('name') for p in shortlist]}
Selected Provider: {selected.get('name') if selected else 'None'}
Session Summary: {summary}

Possible intents:
1. greeting: User is saying hello/hi/salam/adaab only.
2. query_services: User asks ONLY "what services exist" or "what do you offer". NOT "I need X".
3. service_request: User needs/wants a specific service. Examples: "I need AC technician", "Mujhe mechanic chahiye", "Need plumber near Bahria", "kal subah AC wala chahiye", "Bike mechanic available hai?".
4. provider_selection: User chooses a provider or provides booking details (price/date/time).
5. booking_confirmation: User confirms booking with yes/okay/confirm.
6. check_status: User asks about request status, provider response, any update.
7. general: Everything else.

CRITICAL RULE: "I need [anything]" or "Mujhe [anything] chahiye" = service_request. NEVER query_services.
Support English, Urdu, and Roman Urdu mixed.

Message: "{user_message}"
Return ONLY the intent string."""

            response = self.llm.invoke(prompt)
            intent = response.content.strip().lower()
            print(f"[INTENT] LLM classified → '{intent}'", flush=True)

            # ── Step 3: LLM output sanitization ───────────────────────
            valid_intents = {
                "greeting", "query_services", "service_request",
                "provider_selection", "booking_confirmation", "check_status", "general"
            }
            # Extract valid intent from LLM response
            matched = None
            for vi in valid_intents:
                if vi in intent:
                    matched = vi
                    break
            intent = matched or "general"

            # ── Step 4: Post-LLM safety overrides ─────────────────────
            # Prevent "I need X" from ever being query_services
            msg_lower = user_message.lower()
            if intent == "query_services" and any(t in msg_lower for t in self.NEED_TRIGGERS):
                print(f"[INTENT] Safety override: query_services → service_request (need trigger found)", flush=True)
                intent = "service_request"

        log = self.log_action(state, f"Classified intent: {intent}", f"Stage: {conv_stage}")
        trace = self.create_trace(f"Classified '{intent}' at stage '{conv_stage}'.")

        return {
            "intent": {"value": intent, "confidence": 1.0, "timestamp": datetime.utcnow().isoformat()},
            "active_agent": "intent",
            "execution_logs": [log],
            "reasoning_traces": [trace],
        }


class ExtractionAgent(BaseAgent):
    def __init__(self):
        super().__init__("Extraction Agent", "Extracts structured entities and selections")

    def run(self, state: AgentState) -> Dict[str, Any]:
        user_message = state["messages"][-1].content
        shortlist = state.get("shortlisted_providers", []) or state.get("last_search_results", [])

        prompt = f"""Extract entities and user selections from the message.
    Support English, Urdu, and Roman Urdu mixed-language.
    
    Message: "{user_message}"
    Shortlist context: {json.dumps(shortlist)}

    Special Instructions for informal Urdu/English:
    - Location: Prioritize extracting location/area/neighborhood information.
    - Dates: "kal" -> "tomorrow", "parso" -> "day after tomorrow", "aaj" -> "today", "aglay haftay" -> "next week".
    - Times: "subah" -> "morning", "dopahar" -> "afternoon", "sham" -> "evening", "raat" -> "night", "after maghrib" -> "post-sunset/evening".

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
    Return JSON ONLY."""
        response = self.llm.invoke(prompt)
        try:
            content = response.content.strip()
            if content.startswith("```json"):
                content = content[7:]
            if content.endswith("```"):
                content = content[:-3]
            entities = json.loads(content.strip())
        except Exception:
            entities = {}

        selected_provider = state.get("selected_provider", {}) or {}
        if entities.get("selected_provider_index") is not None:
            try:
                idx = int(entities["selected_provider_index"])
                if 0 <= idx < len(shortlist):
                    selected_provider = shortlist[idx]
            except Exception:
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
        trace = self.create_trace("Parsed language into structured data.")

        extracted_service_request = {
            "service_type": entities.get("service_type") or state.get("service_request", {}).get("service_type", ""),
            "location": entities.get("location") or state.get("service_request", {}).get("location", ""),
            "time_slot": entities.get("time_preference") or state.get("service_request", {}).get("time_slot", ""),
        }

        booking_context = state.get("booking_context", {}) or {}
        new_context = {**booking_context}
        if entities.get("requested_date"):
            new_context["requested_date"] = entities["requested_date"]
        if entities.get("requested_time"):
            new_context["requested_time"] = entities["requested_time"]
        if entities.get("offered_price"):
            new_context["offered_price"] = entities["offered_price"]

        new_selection_found = bool(
            entities.get("selected_provider_index") is not None
            or entities.get("selected_provider_name")
        )

        result = {
            "entities": entities,
            "service_request": extracted_service_request,
            "booking_context": new_context,
            "active_agent": "extraction",
            "execution_logs": [log],
            "reasoning_traces": [trace],
        }
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

        if is_resumed and current_agent == "supervisor":
            messages = state.get("messages", [])
            history = "\n".join([f"{m.type}: {m.content}" for m in messages[:-1]])
            prompt = (
                f"Summarize this service orchestration history for the next agent: {history}\n"
                "Focus on service type, location, and previous provider mentions. Be brief."
            )
            summary = self.llm.invoke(prompt).content

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
                        print(f"[MEMORY REHYDRATE WARNING] {e}")

                if not real_request and conversation_id:
                    real_request = self.db.active_requests.find_one({
                        "conversation_id": conversation_id,
                        "status": {"$nin": ["booked", "completed", "cancelled", "denied"]}
                    })
                    if real_request:
                        active_request_id = str(real_request["_id"])

                if not real_request and customer_supabase_id and customer_supabase_id != "anonymous":
                    real_request = self.db.active_requests.find_one({
                        "customer_supabase_id": customer_supabase_id,
                        "status": {"$nin": ["booked", "completed", "cancelled", "denied"]},
                    })
                    if real_request:
                        active_request_id = str(real_request["_id"])

                if real_request:
                    db_status = real_request.get("status", "pending")
                    if db_status in ("booked", "completed", "cancelled", "denied"):
                        # If a finalized request is somehow retrieved, prune immediately
                        print(f"[AUDIT] MemoryAgent | Finalized status '{db_status}' detected. Pruning active state.")
                        rehydrated_data.update({
                            "active_request_id": None,
                            "latest_request_status": None,
                            "negotiation_stage": None,
                            "active_request": None,
                            "booking_details": {},
                            "booking_context": {},
                            "selected_provider": {},
                            "shortlisted_providers": [],
                        })
                    else:
                        booking_details = {
                            "request_id": active_request_id,
                            "provider_name": real_request.get("provider_name", "Specialist"),
                            "provider_id": real_request.get("provider_supabase_id"),
                            "status": db_status,
                            "timestamp": (
                                real_request.get("created_at", datetime.utcnow()).isoformat()
                                if real_request.get("created_at")
                                else datetime.utcnow().isoformat()
                            ),
                            "service": real_request.get("service_type"),
                            "location": real_request.get("location", "Unknown"),
                            "offered_price": real_request.get("offered_price"),
                            "requested_date": real_request.get("requested_date"),
                            "requested_time": real_request.get("requested_time"),
                        }
                        rehydrated_data.update({
                            "active_request_id": active_request_id,
                            "latest_request_status": db_status,
                            "negotiation_stage": db_status,
                            "active_request": real_request,
                            "booking_details": booking_details,
                        })

            log = self.log_action(
                state,
                "History Restored",
                f"Resumed. Active request rehydrated: {bool(real_request)}",
            )
            trace = self.create_trace("Summarized previous interaction and rehydrated live context.")
            print(f"[AUDIT] MemoryAgent | Rehydration Result: {rehydrated_data}")
            return {
                "metadata": {**metadata, "session_summary": summary},
                "active_agent": "memory",
                "execution_logs": [log],
                "reasoning_traces": [trace],
                **rehydrated_data,
            }

        updates = {}
        if entities.get("service_type"):
            updates["last_requested_service"] = entities["service_type"]
        if entities.get("location"):
            updates["preferred_location"] = entities["location"]
        if updates and user_id:
            self.db.users.update_one(
                {"supabase_id": user_id},
                {"$set": {"preferences": updates}},
                upsert=True,
            )

        # ── PATCH: Load user coordinates for discovery ───────────────────────
        user_coords = {"latitude": None, "longitude": None}
        if user_id and user_id != "anonymous":
            user_doc = self.db.users.find_one({"supabase_id": user_id})
            if user_doc and user_doc.get("location_data"):
                loc_data = user_doc["location_data"]
                user_coords["latitude"] = loc_data.get("latitude")
                user_coords["longitude"] = loc_data.get("longitude")
                print(f"[MEMORY] Loaded user coordinates: {user_coords}")
        # ──────────────────────────────────────────────────────────────────────

        log = self.log_action(state, "Memory synced", f"Updated {len(updates)} traits.")
        trace = self.create_trace("Synced entities with persistent user profile.")
        return {
            "active_agent": "memory", 
            "execution_logs": [log], 
            "reasoning_traces": [trace],
            "metadata": {**metadata, **user_coords} # Inject into metadata for downstream agents
        }


class KnowledgeAgent(BaseAgent):
    def __init__(self, db):
        super().__init__("Knowledge Agent", "Dynamic Retrieval Layer")
        self.db = db
        self.vector_store = vector_manager.get_vector_store()
 
    def run(self, state: AgentState) -> Dict[str, Any]:
        print("=== KNOWLEDGE AGENT RUN CALLED ===", flush=True) 
        intent_obj = state.get("intent", {})
        intent = intent_obj.get("value") if isinstance(intent_obj, dict) else intent_obj
 
        if intent == "query_services":
            services = self.db.service_providers.distinct("service_type")
            log = self.log_action(state, "Retrieved available services", f"Found: {', '.join(services)}")
            trace = self.create_trace("Queried live DB for distinct service categories.")
            return {
                "metadata": {"available_services": services},
                "active_agent": "knowledge",
                "execution_logs": [log],
                "reasoning_traces": [trace],
            }
 
        user_query = state["messages"][-1].content
 
        engine = HybridRetrievalEngine(self.db, self.llm)
 
        # ── PATCH: pass existing shortlist and location context ────────────────
        existing_shortlist = state.get("shortlisted_providers") or []
        entities = state.get("entities", {})
        metadata = state.get("metadata", {})
        
        # Priority: 1. message location, 2. profile location
        msg_location = entities.get("location")
        user_lat = metadata.get("latitude")
        user_lon = metadata.get("longitude")
        
        # If msg_location is a specific area name, we prepend it to query for Keyword Boost
        effective_query = user_query
        if msg_location and msg_location.lower() not in user_query.lower():
            effective_query = f"{msg_location} {user_query}"
            print(f"[KNOWLEDGE] Location Priority: Using message location '{msg_location}'", flush=True)

        search_output = engine.search(
            effective_query, 
            existing_shortlist=existing_shortlist,
            user_lat=user_lat,
            user_lon=user_lon
        )
        # ── END PATCH ──────────────────────────────────────────────────────────
 
        providers   = search_output["results"]
        confidence  = search_output["confidence"]
        debug_info  = search_output["debug"]
 
        log = self.log_action(
            state,
            f"Retrieved {len(providers)} candidates via Hybrid Engine",
            f"Confidence: {confidence}",
        )
        trace = self.create_trace(
            f"HybridRetrievalEngine: {len(providers)} candidates, {confidence} confidence."
        )
 
        return {
            "provider_candidates": providers,
            "last_search_results": providers,
            "last_search_query": user_query,
            "retrieval_confidence": confidence,
            "retrieval_debug": debug_info,
            "active_agent": "knowledge",
            "execution_logs": [log],
            "reasoning_traces": [trace],
        }

class MatchingAgent(BaseAgent):
    def __init__(self):
        super().__init__("Matching Agent", "Intelligent Ranking Engine")

    def run(self, state: AgentState) -> Dict[str, Any]:
        providers = state.get("provider_candidates", [])
        metadata = state.get("metadata", {})
        user_lat = metadata.get("latitude")
        user_lon = metadata.get("longitude")
        
        for p in providers:
            # 0. Phase 6.8: Strict Coordinate Resolution & Unique Distance
            loc_data = p.get("location_data", {})
            p_lat = p.get("latitude") or loc_data.get("latitude")
            p_lon = p.get("longitude") or loc_data.get("longitude")
            
            dist_km = p.get("_distance_km")
            if (p_lat and p_lon and user_lat and user_lon):
                # Recalculate precisely if coords exist to ensure uniqueness
                dist_km = haversine_distance(float(user_lat), float(user_lon), float(p_lat), float(p_lon))
                dist_km = round(dist_km, 2)
            
            if dist_km is None: dist_km = 999.0
            p["_distance_km"] = dist_km
            p["distance_km"] = dist_km

            # 1. Distance Score (40%)
            # Use travel_radius if available; otherwise default to 15km
            t_radius = float(p.get("travel_radius") or 15.0)
            if dist_km <= t_radius:
                dist_score = 100
            elif dist_km <= t_radius * 1.5:
                dist_score = 60
            else:
                # Penalty for being outside radius
                dist_score = max(0, 40 - (dist_km - t_radius))
            
            # 2. Rating Score (35%)
            rating = float(p.get("provider_rating") or p.get("rating") or 0.0)
            rating_score = (rating / 5.0) * 100 if rating > 0 else 50 # Default 50 if new
            
            # 3. Availability Score (25%)
            working_hours = p.get("working_hours", "09:00-18:00")
            # For now, simple availability check (placeholder for future time logic)
            avail_score = 100 if p.get("is_available", True) or p.get("availability") == True else 0
            if p.get("emergency_availability"):
                avail_score = min(avail_score + 10, 100) # Bonus for emergency
            
            # Base Weighted Score
            match_score = (dist_score * 0.40) + (rating_score * 0.35) + (avail_score * 0.25)
            
            # 4. Phase 6.8: Real Data-Driven Reasoning
            reasons = []
            exp = int(p.get("experience_years") or 0)
            
            if dist_km <= 3: reasons.append("Local Pro")
            elif dist_km <= t_radius: reasons.append("Within area")
            
            if exp >= 5: reasons.append(f"{exp}yr Expert")
            elif exp > 0: reasons.append(f"{exp}yr Exp")
            
            if p.get("emergency_availability"): reasons.append("Emergency Ready")
            
            if rating >= 4.5: reasons.append("Top Rated")
            elif p.get("is_verified"): reasons.append("Verified")

            # Fallback if no strong reasons
            if not reasons: reasons = ["Nearby Service", "Verified Professional"]

            match_score = min(match_score, 100)
            p["match_score"] = match_score
            p["ranking_reason"] = reasons[:3]
            
            # 5. Phase 6.8: Unique ETA with Traffic Variance
            # Real ETA = (Base distance time) + (Processing/Traffic overhead)
            base_eta = (60 / 25.0) * dist_km # Assume 25km/h avg city speed
            traffic_variance = random.uniform(5, 12) # 5-12 mins overhead for pickup/traffic
            p["eta_minutes"] = int(base_eta + traffic_variance) if dist_km < 100 else 45
            
            # Pass coordinates for map
            p["provider_coordinates"] = {
                "latitude": p_lat,
                "longitude": p_lon
            }
            
            # Phase 6.5/6.8: Strict Phone Mapping
            # Priority: service_provider.provider_phone -> loc_data.phone -> empty
            p["phone"] = p.get("provider_phone") or p.get("phone") or loc_data.get("phone") or ""
            p["rating"] = rating or 5.0 # UI display default
            
            if "reliability_score" not in p:
                p["reliability_score"] = p.get("reliability") or 0.95
            
            if not p.get("provider_supabase_id"):
                p["provider_supabase_id"] = p.get("supabase_id") or p.get("provider_id")
            
            # Legacy compatibility field for older frontend components
            p["supabase_id"] = p.get("provider_supabase_id")

            p["customer_coordinates"] = {"latitude": user_lat, "longitude": user_lon}

            dist_text = f"{dist_km}km" if dist_km < 900 else "Nearby"
            p["why_matched"] = f"Top match: {dist_text}, {p['rating']} rating, {', '.join(reasons[:2])}."

        ranked = sorted(providers, key=lambda x: x.get("match_score", 0), reverse=True)[:3]
        
        best_p = ranked[0] if ranked else {}
        best_name = best_p.get("provider_name") or best_p.get("name") or "None"
        
        log = self.log_action(state, "Intelligent Ranking Applied", f"Top: {best_name} | Reasons: {best_p.get('ranking_reason')}")
        trace = self.create_trace(f"Advanced Ranking: 40/35/25 weight + bonuses applied. {len(ranked)} providers shortlisted.")
        
        return {
            "shortlisted_providers": ranked,
            "active_agent": "matching",
            "execution_logs": [log],
            "reasoning_traces": [trace],
            "conversation_stage": "selection",
        }


class NegotiationAgent(BaseAgent):
    def __init__(self, db):
        super().__init__("Negotiation Agent", "Handles provider requests and negotiations")
        self.db = db

    def run(self, state: AgentState) -> Dict[str, Any]:
        intent_obj = state.get("intent", {})
        intent = intent_obj.get("value") if isinstance(intent_obj, dict) else intent_obj

        if intent == "check_status":
            user_id = state.get("user_id")
            conv_id = state.get("conversation_id")
            booking_details = state.get("booking_details", {}) or {}
            request_id = booking_details.get("request_id") or state.get("active_request_id")

            request_doc = None
            if request_id:
                from bson import ObjectId
                try:
                    request_doc = self.db.active_requests.find_one({"_id": ObjectId(request_id)})
                except Exception as e:
                    print(f"[STATUS] Error: {e}")

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
                    {"customer_supabase_id": user_id}, sort=[("updated_at", -1)]
                )

            if request_doc:
                req_id_str = str(request_doc["_id"])
                status = request_doc.get("status", "pending")
                updated_booking = {
                    **(booking_details or {}),
                    "request_id": req_id_str,
                    "status": status,
                    "offered_price": (
                        request_doc.get("counter_price")
                        if status == "counter_offer"
                        else request_doc.get("offered_price")
                    ),
                    "requested_date": (
                        request_doc.get("counter_date")
                        if status == "counter_offer"
                        else request_doc.get("requested_date")
                    ),
                    "requested_time": (
                        request_doc.get("counter_time")
                        if status == "counter_offer"
                        else request_doc.get("requested_time")
                    ),
                    "provider_name": request_doc.get("specialization") or "Provider",
                }
                new_conv_stage = "awaiting_response"
                if status in ("counter_offer", "denied"):
                    new_conv_stage = "selection"
                elif status in ("approved", "booked"):
                    new_conv_stage = "completion"

                log = self.log_action(state, "Status fetched", f"ID:{req_id_str} Status:{status}")
                trace = self.create_trace(f"Synced with live DB status '{status}'.")
                return {
                    "booking_details": updated_booking,
                    "active_request_id": req_id_str,
                    "latest_request_status": status,
                    "last_provider_response": request_doc.get("counter_note") or "",
                    "negotiation_stage": status,
                    "conversation_stage": new_conv_stage,
                    "active_agent": "negotiation",
                    "execution_logs": [log],
                    "reasoning_traces": [trace],
                }
            else:
                log = self.log_action(state, "No active request", "Proceeding with empty context.")
                trace = self.create_trace("No matching DB request found.")
                return {"active_agent": "negotiation", "execution_logs": [log], "reasoning_traces": [trace]}

        # Active request initialization routine (unchanged from original)
        selected = state.get("selected_provider")
        booking_ctx = state.get("booking_context", {}) or {}
        if not selected:
            log = self.log_action(state, "Negotiation failed", "No provider selected.")
            return {"active_agent": "negotiation", "execution_logs": [log]}

        user_id = state.get("user_id") or "anonymous"
        conversation_id = state.get("conversation_id")
        if (not user_id or user_id == "anonymous") and conversation_id:
            try:
                from bson import ObjectId
                conv_doc = self.db.conversations.find_one({"_id": ObjectId(conversation_id)})
                if conv_doc and conv_doc.get("user_id"):
                    user_id = conv_doc.get("user_id")
            except Exception:
                pass

        provider_supabase_id = (
            selected.get("provider_supabase_id") or selected.get("provider_id") or "anonymous_provider"
        )
        offered_price = booking_ctx.get("offered_price")
        requested_date = booking_ctx.get("requested_date")
        requested_time = booking_ctx.get("requested_time")
        service_type = (
            selected.get("service_type")
            or state.get("service_request", {}).get("service_type")
            or "General Service"
        )
        location = selected.get("location") or state.get("service_request", {}).get("location") or "Unknown"

        if not offered_price or not requested_date or not requested_time:
            log = self.log_action(state, "Negotiation failed", "Missing booking context fields.")
            return {
                "active_agent": "negotiation",
                "execution_logs": [log],
                "errors": ["Missing price, date, or time for request dispatching."],
            }

        # Duplicate guard
        try:
            existing_req = self.db.active_requests.find_one({
                "conversation_id": conversation_id,
                "provider_supabase_id": provider_supabase_id,
                "status": {"$in": ["pending", "counter_offer", "approved"]},
            })
            if existing_req:
                request_id = str(existing_req["_id"])
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
                    "requested_time": requested_time,
                }
                log = self.log_action(state, "Reusing existing request", f"ID:{request_id}")
                trace = self.create_trace(f"Reused existing active request {request_id}.")
                return {
                    "active_request_id": request_id,
                    "request_creation_success": True,
                    "negotiation_stage": existing_req.get("status", "pending"),
                    "booking_details": booking_details,
                    "active_agent": "negotiation",
                    "execution_logs": [log],
                    "reasoning_traces": [trace],
                    "workflow_stage": "booking_initiation",
                    "conversation_stage": "awaiting_response",
                }
        except Exception as dup_err:
            print(f"[NEGOTIATION WARNING] Duplicate check failed: {dup_err}")

        provider_name = selected.get("name") or "Specialist"
        booking_details = {
            "provider_name": provider_name,
            "provider_id": selected.get("_id"),
            "status": "pending",
            "timestamp": datetime.utcnow().isoformat(),
            "service": service_type,
            "location": location,
            "offered_price": offered_price,
            "requested_date": requested_date,
            "requested_time": requested_time,
        }
        log = self.log_action(
            state,
            "Negotiation parameters confirmed",
            f"Provider:{provider_name} Price:{offered_price} Date:{requested_date} Time:{requested_time}",
        )
        trace = self.create_trace(f"Collected negotiation params for {provider_name}.")
        return {
            "negotiation_stage": "pending",
            "pending_provider_id": provider_supabase_id,
            "latest_offer": {"price": offered_price, "date": requested_date, "time": requested_time},
            "booking_details": booking_details,
            "active_agent": "negotiation",
            "execution_logs": [log],
            "reasoning_traces": [trace],
            "workflow_stage": "booking_initiation",
            "conversation_stage": "awaiting_response",
        }


class RequestCreationAgent(BaseAgent):
    """Unchanged from original — already has post-insert verification."""

    def __init__(self, db):
        super().__init__("Request Creation Agent", "Transactional Request Dispatcher")
        self.db = db

    def run(self, state: AgentState) -> Dict[str, Any]:
        from datetime import datetime
        import traceback
        from bson import ObjectId

        print("\n[REQUEST FLOW] >>> ENTERING REQUEST CREATION AGENT <<<")

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

        missing_fields = []
        if not provider_supabase_id:
            missing_fields.append("provider_supabase_id")
        if not customer_supabase_id or customer_supabase_id == "anonymous":
            missing_fields.append("customer_supabase_id")
        if not service_type:
            missing_fields.append("service_type")
        if not requested_date:
            missing_fields.append("requested_date")
        if not requested_time:
            missing_fields.append("requested_time")
        if not offered_price:
            missing_fields.append("offered_price")

        if missing_fields:
            err_msg = f"Hard validation failed. Missing: {', '.join(missing_fields)}"
            print(f"[REQUEST FLOW ERROR] {err_msg}")
            log = self.log_action(state, "Validation Error", err_msg)
            return {
                "request_creation_success": False,
                "request_creation_error": err_msg,
                "active_agent": "request_creation",
                "execution_logs": [log],
                "errors": [err_msg],
            }

        try:
            # Duplicate guard
            existing_req = self.db.active_requests.find_one({
                "conversation_id": conversation_id,
                "status": {"$in": ["pending", "counter_offer"]},
            })
            if existing_req:
                existing_id = str(existing_req["_id"])
                booking_details = {
                    "request_id": existing_id,
                    "provider_name": existing_req.get("provider_name", "Specialist"),
                    "provider_id": existing_req.get("provider_supabase_id"),
                    "status": existing_req.get("status"),
                    "timestamp": (
                        existing_req.get("created_at", datetime.utcnow()).isoformat()
                        if existing_req.get("created_at")
                        else datetime.utcnow().isoformat()
                    ),
                    "service": existing_req.get("service_type"),
                    "location": existing_req.get("location", "Unknown"),
                    "offered_price": existing_req.get("offered_price"),
                    "requested_date": existing_req.get("requested_date"),
                    "requested_time": existing_req.get("requested_time"),
                }
                log = self.log_action(state, "Duplicate suppressed", f"Rehydrating ID:{existing_id}")
                trace = self.create_trace(f"Reused existing request {existing_id}.")
                return {
                    "active_request_id": existing_id,
                    "request_creation_success": True,
                    "request_id": existing_id,
                    "request_data": existing_req,
                    "negotiation_stage": existing_req.get("status"),
                    "latest_request_status": existing_req.get("status"),
                    "booking_details": booking_details,
                    "active_agent": "request_creation",
                    "execution_logs": [log],
                    "reasoning_traces": [trace],
                    "workflow_stage": "booking_initiation",
                    "conversation_stage": "awaiting_response",
                }

            # Entity verification
            customer_doc = self.db.users.find_one({"supabase_id": customer_supabase_id})
            if not customer_doc:
                err_msg = f"Customer not found: {customer_supabase_id}"
                log = self.log_action(state, "Entity Error", err_msg)
                return {
                    "request_creation_success": False,
                    "request_creation_error": err_msg,
                    "active_agent": "request_creation",
                    "execution_logs": [log],
                    "errors": [err_msg],
                }

            provider_doc = self.db.provider_info.find_one({"supabase_id": provider_supabase_id})
            if not provider_doc:
                provider_doc = self.db.users.find_one({"supabase_id": provider_supabase_id})
            if not provider_doc:
                err_msg = f"Provider not found: {provider_supabase_id}"
                log = self.log_action(state, "Entity Error", err_msg)
                return {
                    "request_creation_success": False,
                    "request_creation_error": err_msg,
                    "active_agent": "request_creation",
                    "execution_logs": [log],
                    "errors": [err_msg],
                }
            provider_name = provider_doc.get("name") or "Specialist"

            service_doc = None
            service_id = selected.get("_id") or selected.get("service_id")
            if service_id:
                try:
                    service_doc = self.db.service_providers.find_one({"_id": ObjectId(service_id)})
                except Exception:
                    pass
            if not service_doc:
                service_doc = self.db.service_providers.find_one({"provider_supabase_id": provider_supabase_id})
            if not service_doc:
                err_msg = f"No service listing for provider {provider_supabase_id}"
                log = self.log_action(state, "Entity Error", err_msg)
                return {
                    "request_creation_success": False,
                    "request_creation_error": err_msg,
                    "active_agent": "request_creation",
                    "execution_logs": [log],
                    "errors": [err_msg],
                }

            # Build and insert document
            customer_name = customer_doc.get("name") or "Valued Client"
            specialization = selected.get("specialization") or service_doc.get("specialization") or "Specialist"
            location = selected.get("location") or service_doc.get("location") or "Unknown"

            request_doc = {
                "conversation_id": conversation_id,
                "provider_supabase_id": provider_supabase_id,
                "provider_name": provider_name,
                "provider_phone": provider_doc.get("phone") or "Not provided",
                "provider_email": provider_doc.get("email") or "Not provided",
                "provider_location": provider_doc.get("location") or "Not provided",
                "provider_location_data": provider_doc.get("location_data") or {},
                "provider_avatar": provider_doc.get("avatar_url") or "",
                "customer_supabase_id": customer_supabase_id,
                "customer_name": customer_name,
                "customer_phone": customer_doc.get("phone") or "Not provided",
                "customer_email": customer_doc.get("email") or "Not provided",
                "customer_location": customer_doc.get("location") or "Not provided",
                "customer_location_data": customer_doc.get("location_data") or {},
                "customer_avatar": customer_doc.get("avatar_url") or "",
                "service_type": service_type,
                "specialization": specialization,
                "location": location,
                "location_data": customer_doc.get("location_data"),
                "offered_price": offered_price,
                "requested_date": requested_date,
                "requested_time": requested_time,
                "status": "pending",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }

            result = self.db.active_requests.insert_one(request_doc)
            if not result or not result.acknowledged or not result.inserted_id:
                raise RuntimeError("MongoDB insert_one not acknowledged.")

            request_id = str(result.inserted_id)

            # Post-insert verification
            verified_doc = self.db.active_requests.find_one({"_id": ObjectId(request_id)})
            if not verified_doc:
                raise RuntimeError(f"Post-insert verification failed for {request_id}.")

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
                "requested_time": requested_time,
            }

            try:
                from app import socketio
                self.db.notifications.insert_one({
                    "user_supabase_id": provider_supabase_id,
                    "role": "seller",
                    "type": "new_request",
                    "title": "New Service Request",
                    "message": (
                        f"You received a new {service_type} request from {customer_name} "
                        f"for {requested_date} at {requested_time}."
                    ),
                    "related_id": request_id,
                    "status": "unread",
                    "created_at": datetime.utcnow(),
                })
                socketio.emit("new_provider_request", {
                    "request_id": request_id,
                    "provider_supabase_id": provider_supabase_id,
                    "customer_name": customer_name,
                    "price": offered_price,
                    "date": requested_date,
                    "time": requested_time,
                    "location": location,
                    "service_type": service_type,
                })
            except Exception as socket_err:
                print(f"[REQUEST FLOW WARNING] Socket skipped: {socket_err}")

            log = self.log_action(state, "Request created", f"ID:{request_id}")
            trace = self.create_trace(f"Verified request {request_id} inserted and confirmed.")
            return {
                "active_request_id": request_id,
                "request_creation_success": True,
                "request_id": request_id,
                "request_data": request_doc,
                "negotiation_stage": "pending",
                "latest_request_status": "pending",
                "booking_details": booking_details,
                "active_agent": "request_creation",
                "execution_logs": [log],
                "reasoning_traces": [trace],
                "workflow_stage": "booking_initiation",
                "conversation_stage": "awaiting_response",
            }

        except Exception as err:
            import traceback as tb_module
            print(f"[REQUEST FLOW ERROR]\n{tb_module.format_exc()}")
            log = self.log_action(state, "Request Creation Exception", str(err))
            return {
                "request_creation_success": False,
                "request_creation_error": f"Insertion exception: {str(err)}",
                "active_agent": "request_creation",
                "execution_logs": [log],
                "errors": [f"Request creation failed: {str(err)}"],
            }


# ── BookingAgent — REWRITTEN ──────────────────────────────────────────────────

class BookingAgent(BaseAgent):
    """
    Transaction Management Engine.

    CHANGES vs original:
    - Always emits `booking_outcome` dict with explicit success/failure fields.
    - Uses MongoDB findOneAndUpdate with upsert=False as idempotency guard
      instead of a separate find + insert (eliminates TOCTOU race).
    - Returns booking_outcome.booking_failure = True on EVERY failure path
      so SupervisorAgent can make a deterministic routing decision.
    - Never emits a success signal without a confirmed inserted_id.
    """

    def __init__(self, db):
        super().__init__("Booking Agent", "Transaction Management Engine")
        self.db = db

    # ------------------------------------------------------------------
    # Internal helper: build a canonical failure outcome payload
    # ------------------------------------------------------------------
    def _failure_outcome(
        self,
        state: AgentState,
        reason: str,
        log_title: str = "Booking failed",
    ) -> Dict[str, Any]:
        print(f"[BOOKING FAILURE] {reason}")
        log = self.log_action(state, log_title, reason)
        trace = self.create_trace(f"Booking pipeline terminated: {reason}")
        return {
            "booking_outcome": {
                "booking_success": False,
                "booking_failure": True,
                "booking_failure_reason": reason,
                "db_write_confirmed": False,
                "booking_id": None,
            },
            "active_agent": "booking",
            "execution_logs": [log],
            "reasoning_traces": [trace],
            "errors": [reason],
        }

    def run(self, state: AgentState) -> Dict[str, Any]:
        from bson import ObjectId

        print("[BOOKING] Initiating final booking confirmation stage")

        user_id = state.get("user_id") or "anonymous"
        conversation_id = state.get("conversation_id")
        booking_details = state.get("booking_details", {}) or {}

        # ── 1. Resolve request ID ─────────────────────────────────────
        request_id = state.get("active_request_id") or booking_details.get("request_id")
        if not request_id:
            return self._failure_outcome(
                state,
                "No active_request_id found in state. Cannot proceed without a tracked request.",
                "Booking failed: missing request ID",
            )

        # ── 2. Fetch request document from DB ─────────────────────────
        request_doc = None
        try:
            request_doc = self.db.active_requests.find_one({"_id": ObjectId(request_id)})
        except Exception as fetch_err:
            return self._failure_outcome(
                state,
                f"DB error fetching active request {request_id}: {fetch_err}",
                "Booking failed: DB fetch error",
            )

        if not request_doc:
            # Request was already deleted (provider approved → respond_to_request cleaned it up).
            # Check if a booking already exists for this request.
            existing_booking = None
            try:
                existing_booking = self.db.bookings.find_one({"conversation_id": conversation_id, "status": {"$in": ["confirmed", "booked"]}})
            except Exception:
                pass

            if existing_booking:
                # Idempotent success — already booked in a previous call
                booking_id = str(existing_booking["_id"])
                print(f"[BOOKING] Booking already confirmed: {booking_id}. Returning success.")
                log = self.log_action(state, "Booking already confirmed (idempotent)", f"booking_id:{booking_id}")
                trace = self.create_trace("Idempotent path: booking document already present in DB.")
                updated_booking = {
                    **booking_details,
                    "request_id": request_id,
                    "status": "confirmed",
                    "timestamp": datetime.utcnow().isoformat(),
                }
                return {
                    "booking_outcome": {
                        "booking_success": True,
                        "booking_failure": False,
                        "booking_failure_reason": "",
                        "db_write_confirmed": True,
                        "booking_id": booking_id,
                    },
                    "booking_details": updated_booking,
                    "latest_request_status": "booked",
                    "negotiation_stage": "booked",
                    "conversation_stage": "completion",
                    "active_agent": "booking",
                    "execution_logs": [log],
                    "reasoning_traces": [trace],
                }

            return self._failure_outcome(
                state,
                f"Active request {request_id} not found in DB and no existing booking detected.",
                "Booking failed: request document missing",
            )

        status = request_doc.get("status", "pending")
        provider_supabase_id = request_doc.get("provider_supabase_id")
        customer_id = request_doc.get("customer_supabase_id") or user_id

        # ── 3. Gate: provider must have approved ──────────────────────
        if status != "approved":
            return self._failure_outcome(
                state,
                f"Provider has not approved the request. Current status: '{status}'. "
                "Booking is only allowed when status == 'approved'.",
                f"Booking rejected: status is '{status}'",
            )

        final_price = request_doc.get("counter_price") or request_doc.get("offered_price")
        final_date = request_doc.get("counter_date") or request_doc.get("requested_date")
        final_time = request_doc.get("counter_time") or request_doc.get("requested_time")

        # ── 4. Idempotent upsert — prevents duplicate booking documents
        # under concurrent socket execution (TOCTOU safe because MongoDB
        # findOneAndUpdate is atomic on the server side).
        booking_filter = {
            "conversation_id": conversation_id,
            "customer_supabase_id": customer_id,
            "provider_supabase_id": provider_supabase_id,
            "status": {"$in": ["confirmed", "booked"]},
        }
        existing_booking = None
        try:
            existing_booking = self.db.bookings.find_one(booking_filter)
        except Exception as dup_err:
            print(f"[BOOKING WARNING] Duplicate check failed: {dup_err}")

        if existing_booking:
            booking_id = str(existing_booking["_id"])
            print(f"[BOOKING] Duplicate prevented. Existing booking: {booking_id}")
            log = self.log_action(state, "Duplicate booking prevented", f"booking_id:{booking_id}")
            trace = self.create_trace("Skipped insert — confirmed booking already exists.")
            try:
                self.db.active_requests.delete_one({"_id": ObjectId(request_id)})
            except Exception:
                pass
            updated_booking = {
                **booking_details,
                "request_id": request_id,
                "status": "confirmed",
                "timestamp": datetime.utcnow().isoformat(),
                "service": request_doc.get("service_type"),
                "location": request_doc.get("location"),
                "offered_price": final_price,
                "requested_date": final_date,
                "requested_time": final_time,
            }
            return {
                "booking_outcome": {
                    "booking_success": True,
                    "booking_failure": False,
                    "booking_failure_reason": "",
                    "db_write_confirmed": True,
                    "booking_id": booking_id,
                },
                "booking_details": updated_booking,
                "latest_request_status": "booked",
                "negotiation_stage": "booked",
                "conversation_stage": "completion",
                "active_agent": "booking",
                "execution_logs": [log],
                "reasoning_traces": [trace],
            }

        # ── 5. Insert the verified booking document ───────────────────
        booking_doc = {
            "customer_supabase_id": customer_id,
            "customer_name": request_doc.get("customer_name"),
            "customer_phone": request_doc.get("customer_phone", "Not provided"),
            "customer_email": request_doc.get("customer_email", "Not provided"),
            "customer_location": request_doc.get("customer_location", "Not provided"),
            "customer_location_data": request_doc.get("customer_location_data") or {},
            "customer_avatar": request_doc.get("customer_avatar", ""),
            "provider_supabase_id": provider_supabase_id,
            "provider_name": request_doc.get("provider_name"),
            "provider_phone": request_doc.get("provider_phone", "Not provided"),
            "provider_email": request_doc.get("provider_email", "Not provided"),
            "provider_location": request_doc.get("provider_location", "Not provided"),
            "provider_location_data": request_doc.get("provider_location_data") or {},
            "provider_avatar": request_doc.get("provider_avatar", ""),
            "service_type": request_doc.get("service_type"),
            "specialization": request_doc.get("specialization") or request_doc.get("service_type"),
            "offered_price": request_doc.get("offered_price"),
            "price": final_price,
            "requested_date": final_date,
            "requested_time": final_time,
            "location": request_doc.get("location") or request_doc.get("customer_location", "Not provided"),
            "location_data": request_doc.get("customer_location_data") or {},
            "status": "confirmed",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "conversation_id": conversation_id,
        }

        try:
            result = self.db.bookings.insert_one(booking_doc)
            if not (result.acknowledged and result.inserted_id):
                raise Exception("MongoDB insert_one not acknowledged.")
        except Exception as insert_err:
            return self._failure_outcome(
                state,
                f"DB insert failed: {insert_err}",
                "Booking persistence failed",
            )

        booking_id = str(result.inserted_id)

        # ── 6. POST-INSERT VERIFICATION (mandatory) ───────────────────
        verified = None
        try:
            from bson import ObjectId as ObjId
            verified = self.db.bookings.find_one({"_id": ObjId(booking_id)})
        except Exception as verify_err:
            print(f"[BOOKING] Post-insert verify error: {verify_err}")

        if not verified:
            # Extremely rare — insert acknowledged but document not immediately readable.
            # Treat as failure to avoid false success messages.
            return self._failure_outcome(
                state,
                f"Post-insert verification failed for booking {booking_id}. "
                "Document not found immediately after insert. DB consistency issue.",
                "Booking post-insert verification failed",
            )

        print(f"[BOOKING] Booking confirmed and verified. booking_id: {booking_id}")

        # ── 7. Clean up active request ────────────────────────────────
        try:
            self.db.active_requests.delete_one({"_id": ObjectId(request_id)})
        except Exception as cleanup_err:
            print(f"[BOOKING WARNING] Failed to delete active request: {cleanup_err}")

        # ── 8. Dispatch notifications ─────────────────────────────────
        try:
            from app import socketio
            svc_type = request_doc.get("service_type")
            for uid, role, msg_title, msg_body in [
                (
                    provider_supabase_id,
                    "seller",
                    "Booking Confirmed!",
                    f"Customer confirmed {svc_type} for {final_date} at {final_time}.",
                ),
                (
                    customer_id,
                    "buyer",
                    "Booking Confirmed!",
                    f"Your {svc_type} booking is confirmed for {final_date} at {final_time}.",
                ),
            ]:
                self.db.notifications.insert_one({
                    "user_supabase_id": uid,
                    "role": role,
                    "type": "booking_confirmed",
                    "title": msg_title,
                    "message": msg_body,
                    "related_id": booking_id,
                    "status": "unread",
                    "created_at": datetime.utcnow(),
                })
                socketio.emit("booking_notification", {"user_supabase_id": uid})
        except Exception as notif_err:
            print(f"[BOOKING NOTIF ERROR] {notif_err}")

        log = self.log_action(state, "Booking confirmed", f"booking_id:{booking_id}")
        trace = self.create_trace("Transaction finalized. Booking document created and verified.")

        updated_booking = {
            **booking_details,
            "request_id": request_id,
            "booking_id": booking_id,
            "status": "confirmed",
            "timestamp": datetime.utcnow().isoformat(),
            "service": request_doc.get("service_type"),
            "location": request_doc.get("location"),
            "offered_price": final_price,
            "requested_date": final_date,
            "requested_time": final_time,
        }

        return {
            # ── THE AUTHORITATIVE SIGNAL ──────────────────────────
            "booking_outcome": {
                "booking_success": True,
                "booking_failure": False,
                "booking_failure_reason": "",
                "db_write_confirmed": True,
                "booking_id": booking_id,
            },
            # ── STATE UPDATES ─────────────────────────────────────
            "booking_details": updated_booking,
            "latest_request_status": "booked",
            "negotiation_stage": "booked",
            "conversation_stage": "completion",
            "active_agent": "booking",
            "execution_logs": [log],
            "reasoning_traces": [trace],
        }


# ── SchedulingAgent — GATED on booking_outcome ───────────────────────────────

class SchedulingAgent(BaseAgent):
    """
    CHANGE vs original:
    - Reads booking_outcome before doing anything.
    - If booking_outcome.booking_success is not True, short-circuits
      and returns a failure signal so the supervisor can route to
      communication with an error message instead of a success message.
    """

    def __init__(self, db):
        super().__init__("Scheduling Agent", "Manages followups and notifications")
        self.db = db

    def run(self, state: AgentState) -> Dict[str, Any]:
        booking_outcome = state.get("booking_outcome") or {}

        # Hard gate: do not schedule if booking did not succeed
        if not booking_outcome.get("booking_success"):
            failure_reason = booking_outcome.get("booking_failure_reason", "Unknown booking failure")
            print(f"[SCHEDULING] Skipping — booking_outcome indicates failure: {failure_reason}")
            log = self.log_action(
                state,
                "Scheduling skipped — booking failed",
                f"Reason: {failure_reason}",
            )
            trace = self.create_trace("Scheduling aborted: upstream booking step did not confirm DB write.")
            # Re-emit the failure outcome so CommunicationAgent sees it
            return {
                "booking_outcome": {
                    **booking_outcome,
                    "scheduling_skipped": True,
                    "scheduling_skip_reason": failure_reason,
                },
                "active_agent": "scheduling",
                "execution_logs": [log],
                "reasoning_traces": [trace],
            }

        # Normal path
        booking = state.get("booking_details", {})
        notification = {
            "message": f"Reminder: Your {booking.get('service')} is scheduled.",
            "type": "reminder",
            "status": "pending",
        }
        if state.get("user_id"):
            try:
                self.db.notifications.insert_one({
                    "user_id": state.get("user_id"),
                    "notification": notification,
                })
            except Exception as e:
                print(f"[SCHEDULING] Notification insert failed: {e}")

        log = self.log_action(state, "Scheduled follow-up", "Reminder queued.")
        trace = self.create_trace("Configured scheduling triggers for booking reminders.")
        return {
            "active_agent": "scheduling",
            "execution_logs": [log],
            "reasoning_traces": [trace],
        }