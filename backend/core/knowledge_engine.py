import re
import json
import logging
from typing import List, Dict, Any
from bson import ObjectId
from langchain_core.messages import HumanMessage, SystemMessage
from rapidfuzz import fuzz

# We use the existing vector manager for ChromaDB
from core.vector_store import vector_manager

logger = logging.getLogger(__name__)

class HybridRetrievalEngine:
    """
    Production-grade Hybrid Retrieval Engine for Flowtica.
    Implements a 9-stage pipeline combining semantic understanding, vector search,
    keyword matching, rapidfuzz, and multi-factor reranking.
    """
    
    # Common Pakistani service synonyms
    SYNONYM_MAP = {
        "ac": ["air conditioner", "hvac", "cooling", "split"],
        "plumber": ["pipe", "water", "leak", "drain", "sanitary"],
        "electrician": ["wiring", "power", "switch", "lights", "fan"],
        "cleaner": ["cleaning", "sweeping", "dusting", "wash", "maid"],
        "mechanic": ["car", "auto", "repair", "engine", "brake", "oil"],
        "car wash": ["cleaning", "detailing", "polish", "service station"],
        "solar": ["panel", "inverter", "battery", "ups", "installation"],
        "painter": ["color", "paint", "wall", "brush", "distemper"],
        "carpenter": ["wood", "furniture", "door", "cabinet", "bed"],
        "human cleaning": ["deep cleaning", "house cleaning", "maid", "cleaner"] # specific edge case fix
    }
    
    def __init__(self, db, llm):
        """
        Args:
            db: MongoDB database instance
            llm: LangChain language model (e.g., ChatOpenAI)
        """
        self.db = db
        self.llm = llm
        
    def _understand_query(self, query: str) -> Dict[str, Any]:
        """Stage 1 & 2 & 3: LLM Intent Extraction, Normalization, Expansion"""
        logger.info(f"[KNOWLEDGE ENGINE] Stage 1: Understanding query '{query}'")
        
        system_prompt = """You are a Query Understanding module for the Flowtica service marketplace.
Your job is to analyze the user's query and extract searchable entities.
Return valid JSON ONLY. No markdown formatting.

Keys to extract:
- intent: "search" | "booking" | "inquiry" | "greeting"
- service_name: Primary service requested (e.g. "cleaning", "plumbing"). Empty string if none.
- location: Specific location mentioned (e.g. "G-13", "Islamabad"). Empty string if none.
- specialization: Specific type/detail (e.g. "deep cleaning", "split AC"). Empty string if none.
- provider_name: If they asked for a specific person. Empty string if none.
- expanded_terms: List of 3-5 synonyms or related terms for the service requested.

Example Output:
{
  "intent": "search",
  "service_name": "cleaning",
  "location": "",
  "specialization": "deep cleaning",
  "provider_name": "",
  "expanded_terms": ["maid", "housekeeper", "dusting", "janitor"]
}"""
        
        try:
            response = self.llm.invoke([
                SystemMessage(content=system_prompt),
                HumanMessage(content=query)
            ])
            
            content = response.content
            # Clean possible markdown
            if content.startswith("```json"):
                content = content[7:-3]
            elif content.startswith("```"):
                content = content[3:-3]
                
            parsed = json.loads(content.strip())
            
            # Combine LLM expansion with hardcoded expansion
            all_terms = [t.lower() for t in parsed.get("expanded_terms", [])]
            if parsed.get("service_name"):
                svc = parsed["service_name"].lower()
                all_terms.append(svc)
                for key, synonyms in self.SYNONYM_MAP.items():
                    if key in svc or svc in key:
                        all_terms.extend(synonyms)
                        
            parsed["expanded_terms"] = list(set(all_terms)) # deduplicate
            return parsed
            
        except Exception as e:
            logger.error(f"[KNOWLEDGE ENGINE] LLM parsing failed: {e}. Falling back to basic parsing.")
            return {
                "intent": "search",
                "service_name": query.lower(),
                "location": "",
                "specialization": "",
                "provider_name": "",
                "expanded_terms": [query.lower()]
            }

    def _keyword_search(self, terms: List[str], location: str) -> List[Dict[str, Any]]:
        """Stage 4: MongoDB Regex Keyword Search"""
        if not terms:
            return []
            
        search_results = []
        for term in terms:
            if len(term) < 3: # Skip tiny words
                continue
                
            regex = re.compile(term, re.IGNORECASE)
            query_filter = {
                "$or": [
                    {"service_name": regex},
                    {"service_type": regex},
                    {"specialization": regex},
                    {"provider_name": regex},
                    {"description": regex}
                ]
            }
            if location:
                query_filter["$and"] = [
                    {"$or": [
                        {"service_location": re.compile(location, re.IGNORECASE)},
                        {"location": re.compile(location, re.IGNORECASE)}
                    ]}
                ]
                
            results = list(self.db.service_providers.find(query_filter))
            for r in results:
                r["_match_source"] = "keyword"
                r["_source_score"] = 0.8
            search_results.extend(results)
            
        return search_results

    def _fuzzy_search(self, query: str, location: str) -> List[Dict[str, Any]]:
        """Stage 5: Rapidfuzz matching across all providers"""
        all_providers = list(self.db.service_providers.find({}))
        fuzzy_results = []
        
        query_lower = query.lower()
        
        for p in all_providers:
            # Check location first if provided
            if location:
                loc1 = p.get("service_location", "").lower()
                loc2 = p.get("location", "").lower()
                if location.lower() not in loc1 and location.lower() not in loc2:
                    continue # Location mismatch
                    
            name_score = fuzz.partial_ratio(query_lower, p.get("service_name", "").lower())
            type_score = fuzz.partial_ratio(query_lower, p.get("service_type", "").lower())
            desc_score = fuzz.token_set_ratio(query_lower, p.get("description", "").lower())
            
            max_score = max(name_score, type_score, desc_score)
            
            if max_score > 70: # Fuzzy threshold
                p["_match_source"] = "fuzzy"
                p["_source_score"] = max_score / 100.0
                fuzzy_results.append(p)
                
        return fuzzy_results

    def _semantic_search(self, query: str, k: int = 5) -> List[Dict[str, Any]]:
        """Stage 6: ChromaDB Semantic Search"""
        try:
            vector_store = vector_manager.get_vector_store()
            vector_results = vector_store.similarity_search_with_score(query, k=k)
            semantic_results = []
            
            for doc, score in vector_results:
                service_id = doc.metadata.get("service_id")
                if not service_id:
                    continue
                    
                # Fetch full doc from mongo
                mongo_doc = self.db.service_providers.find_one({"_id": ObjectId(service_id)})
                if mongo_doc:
                    # Chroma returns distance (lower is better), convert to similarity
                    # L2 distance bounds usually depend on embeddings, roughly 0 to 2
                    similarity = max(0.0, 1.0 - (score / 2.0))
                    
                    if similarity > 0.4: # Only keep reasonable semantic matches
                        mongo_doc["_match_source"] = "semantic"
                        mongo_doc["_source_score"] = similarity
                        semantic_results.append(mongo_doc)
                        
            return semantic_results
        except Exception as e:
            logger.error(f"[KNOWLEDGE ENGINE] Semantic search failed: {e}")
            return []

    def _merge_and_deduplicate(self, all_lists: List[List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
        """Stage 7: Merge results, keeping best score for duplicates"""
        merged = {}
        for res_list in all_lists:
            for doc in res_list:
                doc_id = str(doc["_id"])
                if doc_id not in merged:
                    merged[doc_id] = doc
                else:
                    # Keep the one with the higher source score, but combine match sources
                    old_source = merged[doc_id].get("_match_source", "")
                    new_source = doc.get("_match_source", "")
                    merged[doc_id]["_match_source"] = f"{old_source},{new_source}"
                    
                    if doc.get("_source_score", 0) > merged[doc_id].get("_source_score", 0):
                        merged[doc_id]["_source_score"] = doc["_source_score"]
                        
        return list(merged.values())

    def _rerank_results(self, results: List[Dict[str, Any]], parsed_query: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Stage 8: Intelligent Reranking"""
        target_svc = parsed_query.get("service_name", "").lower()
        target_prov = parsed_query.get("provider_name", "").lower()
        target_loc = parsed_query.get("location", "").lower()
        target_spec = parsed_query.get("specialization", "").lower()
        
        for doc in results:
            score = 0.0
            doc_svc = doc.get("service_name", "").lower()
            doc_type = doc.get("service_type", "").lower()
            doc_prov = doc.get("provider_name", "").lower()
            doc_loc = doc.get("service_location", "") or doc.get("location", "")
            doc_loc = doc_loc.lower()
            doc_spec = doc.get("specialization", "").lower()
            
            # Base score from the best retrieval source (0-15 points)
            score += doc.get("_source_score", 0) * 15
            
            # Name matches (Up to 50 pts)
            if target_svc and (target_svc in doc_svc or target_svc in doc_type):
                score += 50
            elif target_svc:
                # partial match fallback
                if fuzz.partial_ratio(target_svc, doc_svc) > 85:
                    score += 35
                    
            # Provider Name match (Up to 40 pts)
            if target_prov and target_prov in doc_prov:
                score += 40
                
            # Specialization match (Up to 30 pts)
            if target_spec and target_spec in doc_spec:
                score += 30
                
            # Location match (Up to 20 pts)
            if target_loc and target_loc in doc_loc:
                score += 20
                
            # Rating bonus (Up to 5 pts)
            rating = float(doc.get("provider_rating", doc.get("rating", 0)))
            if rating >= 4.5:
                score += 5
            elif rating >= 4.0:
                score += 2
                
            # Verified bonus
            if doc.get("is_verified", False):
                score += 5
                
            doc["_rerank_score"] = score
            
        # Sort descending
        return sorted(results, key=lambda x: x.get("_rerank_score", 0), reverse=True)

    def search(self, raw_query: str) -> Dict[str, Any]:
        """
        Main entry point for the Hybrid Retrieval Engine.
        """
        logger.info(f"\n[KNOWLEDGE ENGINE] ==================================")
        logger.info(f"[KNOWLEDGE ENGINE] Starting search for: '{raw_query}'")
        
        # 1. Understand
        parsed = self._understand_query(raw_query)
        logger.info(f"[KNOWLEDGE ENGINE] Extracted Intent: {parsed}")
        
        expanded_terms = parsed.get("expanded_terms", [])
        target_loc = parsed.get("location", "")
        
        # If no terms extracted, use raw query
        if not expanded_terms:
            expanded_terms = [raw_query.lower()]
            
        # 2. Parallel Retrieval Stages
        logger.info("[KNOWLEDGE ENGINE] Running parallel retrievals...")
        keyword_res = self._keyword_search(expanded_terms, target_loc)
        fuzzy_res = self._fuzzy_search(raw_query, target_loc)
        semantic_res = self._semantic_search(raw_query, k=5)
        
        logger.info(f"[KNOWLEDGE ENGINE] Hits -> Keyword: {len(keyword_res)}, Fuzzy: {len(fuzzy_res)}, Semantic: {len(semantic_res)}")
        
        # 3. Merge
        merged_res = self._merge_and_deduplicate([keyword_res, fuzzy_res, semantic_res])
        logger.info(f"[KNOWLEDGE ENGINE] Unique candidates after merge: {len(merged_res)}")
        
        # 4. Rerank
        ranked_res = self._rerank_results(merged_res, parsed)
        
        # 5. Take Top 5
        top_res = ranked_res[:5]
        
        # 6. Confidence Scoring
        confidence = "NONE"
        best_score = top_res[0]["_rerank_score"] if top_res else 0
        
        if len(top_res) == 0:
            confidence = "NONE"
        elif best_score >= 70:
            confidence = "HIGH"
        elif best_score >= 40:
            confidence = "MEDIUM"
        else:
            confidence = "LOW"
            
        logger.info(f"[KNOWLEDGE ENGINE] Best Score: {best_score} -> Confidence: {confidence}")
        
        # Prepare safe output
        safe_results = []
        for r in top_res:
            safe_doc = {k: v for k, v in r.items() if k not in ["embedding", "coordinates", "certifications", "tools"]}
            safe_doc["_id"] = str(safe_doc["_id"])
            safe_results.append(safe_doc)
            logger.info(f"[KNOWLEDGE ENGINE] Candidate: {safe_doc.get('service_name')} (Score: {safe_doc.get('_rerank_score')} | Source: {safe_doc.get('_match_source')})")
            
        logger.info(f"[KNOWLEDGE ENGINE] ==================================\n")
            
        return {
            "results": safe_results,
            "confidence": confidence,
            "debug": {
                "raw_query": raw_query,
                "parsed_intent": parsed,
                "keyword_hits": len(keyword_res),
                "fuzzy_hits": len(fuzzy_res),
                "semantic_hits": len(semantic_res),
                "unique_candidates": len(merged_res),
                "best_score": best_score
            }
        }
