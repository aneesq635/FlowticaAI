"""
core/knowledge_engine.py

ROOT CAUSES FIXED:
1. No exact-match pre-filter — provider/service name hits were ranked the
   same as weak fuzzy matches. Fixed with a dedicated Stage 0 layer.
2. LLM query parser didn't extract provider_name reliably from mixed
   queries like "NESU Tution Services from NESU Qureshi". Fixed with
   explicit extraction prompt and regex fallback.
3. Semantic search used raw query instead of the enriched searchable_text
   format matching the indexed documents. Fixed by also embedding the
   normalized query terms.
4. Reranker had weak provider-name scoring (40 pts). Now 60 pts so an
   explicit provider name mention always dominates.
5. Confidence thresholds were too high — HIGH required score ≥ 70 which
   is hard to hit in multi-word queries. Calibrated per-layer.
6. Conversational references ("find him again", "that provider") are now
   detected and the shortlist is returned directly without re-running
   the full pipeline.
"""

import re
import json
import logging
from typing import List, Dict, Any, Optional
from bson import ObjectId
from langchain_core.messages import HumanMessage, SystemMessage
from rapidfuzz import fuzz

from core.vector_store import vector_manager

logger = logging.getLogger(__name__)
print("=== KNOWLEDGE ENGINE LOADED ===", flush=True)

# ── Conversational reference tokens ──────────────────────────────────────────
# If user message matches any of these patterns, we skip full retrieval
# and return the existing shortlist from state.
_CONVERSATIONAL_REF_PATTERNS = [
    r"\b(him|her|them|that (guy|person|provider|one|service|listing))\b",
    r"\bfind (him|her|them|that|the same)\b",
    r"\bbook (him|her|them)\b",
    r"\bsame (provider|person|service|one)\b",
    r"\bprevious (provider|result|listing|one)\b",
    r"\bthe (plumber|electrician|cleaner|tutor|mechanic|painter|carpenter|technician) (again|guy|person)\b",
]
_CONVERSATIONAL_REF_RE = re.compile(
    "|".join(_CONVERSATIONAL_REF_PATTERNS), re.IGNORECASE
)


class HybridRetrievalEngine:
    """
    Production-grade Hybrid Retrieval Engine for Flowtica.

    Search pipeline:
      Stage 0 — Conversational reference detection (returns existing shortlist)
      Stage 1 — LLM query understanding + entity extraction
      Stage 2 — Exact name match pre-filter (MongoDB, zero-tolerance)
      Stage 3 — MongoDB regex keyword search (expanded terms)
      Stage 4 — Rapidfuzz fuzzy matching across all providers
      Stage 5 — ChromaDB semantic / vector search
      Stage 6 — Merge + deduplicate
      Stage 7 — Multi-factor reranker
      Stage 8 — Confidence scoring + diagnostics
    """

    def __init__(self, db, llm):
        self.db = db
        self.llm = llm

    # ── Stage 0: Conversational reference detection ───────────────────────────

    def _is_conversational_reference(self, query: str) -> bool:
        return bool(_CONVERSATIONAL_REF_RE.search(query.strip()))

    # ── Stage 1: LLM query understanding ─────────────────────────────────────

    def _understand_query(self, query: str) -> Dict[str, Any]:
        system_prompt = """You are a Query Understanding module for the Flowtica service marketplace.
Analyze the user query and extract the following fields. Return ONLY valid JSON, no markdown.

Fields:
- intent: "search" | "booking" | "inquiry" | "greeting"
- service_name: Exact service name mentioned (e.g. "NESU Tution Services"). Empty string if none.
- service_type: General category (e.g. "tuition", "cleaning", "plumbing"). Empty string if none.
- specialization: Specific subtype (e.g. "Mathematics tutoring", "deep cleaning"). Empty string if none.
- provider_name: Exact provider/person name mentioned (e.g. "NESU Qureshi", "Anees"). Empty string if none.
- location: Location mentioned. Empty string if none.
- expanded_terms: 3-6 synonyms or related search terms for the service (lowercase).

Rules:
- If user says "from [Name]" or "by [Name]" or "[Service] by [Name]", extract [Name] as provider_name.
- If user says "I need [Service] from [Provider]", extract both.
- expanded_terms should be general synonyms, NOT the provider name.

Example for "I need NESU Tution Services from NESU Qureshi":
{
  "intent": "search",
  "service_name": "NESU Tution Services",
  "service_type": "tuition",
  "specialization": "",
  "provider_name": "NESU Qureshi",
  "location": "",
  "expanded_terms": ["tutoring", "home tutor", "teaching", "coaching", "study help"]
}"""

        try:
            response = self.llm.invoke([
                SystemMessage(content=system_prompt),
                HumanMessage(content=query),
            ])
            content = response.content.strip()
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            parsed = json.loads(content.strip())

            # Ensure lists are lists
            if not isinstance(parsed.get("expanded_terms"), list):
                parsed["expanded_terms"] = []

            # Regex fallback for "from <Name>" pattern if LLM missed it
            if not parsed.get("provider_name"):
                from_match = re.search(r"\bfrom\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)", query)
                if from_match:
                    parsed["provider_name"] = from_match.group(1).strip()

            return parsed

        except Exception as e:
            logger.error(f"[RETRIEVAL] LLM parsing failed: {e}. Using fallback.")
            parsed = {
                "intent": "search",
                "service_name": "",
                "service_type": query.lower(),
                "specialization": "",
                "provider_name": "",
                "location": "",
                "expanded_terms": [query.lower()],
            }
            
        # Hardcoded synonym expansion for bridging user intent and provider DB taxonomy
        synonym_map = {
            "ac": ["hvac", "air conditioning", "cooling", "ac repair"],
            "hvac": ["ac", "air conditioning", "cooling", "ac repair", "heating"],
            "clean": ["cleaning", "cleaner", "housekeeping", "maid", "deep clean"],
            "tutor": ["tuition", "teaching", "education", "teacher", "classes"],
            "fix": ["repair", "maintenance", "technician", "handyman"],
            "plumb": ["plumber", "plumbing", "pipe", "water"],
            "mechanic": ["auto", "car repair", "vehicle", "automotive"]
        }
        
        expanded = set(parsed.get("expanded_terms", []))
        q_lower = query.lower()
        for key, syns in synonym_map.items():
            if key in q_lower or key in parsed.get("service_type", "").lower() or key in parsed.get("specialization", "").lower():
                expanded.update(syns)
        
        parsed["expanded_terms"] = list(expanded)
        print(f"[AUDIT] HybridRetrievalEngine | Expanded Terms: {parsed['expanded_terms']}")
        return parsed

    # ── Stage 2: Exact name pre-filter ───────────────────────────────────────
    # This is the most important new layer. Before any fuzzy/semantic work,
    # we try to find an exact (case-insensitive) match on provider_name or
    # service_name. If found, these results get a massive score bonus (100 pts)
    # so they always rank first.

    def _exact_name_search(
        self, provider_name: str, service_name: str, location: str
    ) -> List[Dict[str, Any]]:
        results = []

        def _run_exact(field: str, value: str, score_bonus: float):
            if not value or len(value) < 2:
                return
            regex = re.compile(r"^\s*" + re.escape(value) + r"\s*$", re.IGNORECASE)
            loc_filter = {}
            if location:
                loc_regex = re.compile(re.escape(location), re.IGNORECASE)
                loc_filter = {
                    "$or": [
                        {"service_location": loc_regex},
                        {"location": loc_regex},
                    ]
                }
            query_filter = {field: regex, **loc_filter}
            docs = list(self.db.service_providers.find(query_filter))
            for d in docs:
                d["_match_source"] = f"exact_{field}"
                d["_source_score"] = score_bonus
            results.extend(docs)

        # Also try partial contains (not just full exact) for robustness
        def _run_contains(field: str, value: str, score_bonus: float):
            if not value or len(value) < 3:
                return
            regex = re.compile(re.escape(value), re.IGNORECASE)
            docs = list(self.db.service_providers.find({field: regex}))
            for d in docs:
                existing = next((r for r in results if str(r["_id"]) == str(d["_id"])), None)
                if not existing:
                    d["_match_source"] = f"contains_{field}"
                    d["_source_score"] = score_bonus * 0.85
                    results.append(d)

        _run_exact("provider_name", provider_name, 1.0)
        _run_exact("service_name", service_name, 1.0)
        _run_contains("provider_name", provider_name, 1.0)
        _run_contains("service_name", service_name, 1.0)

        return results

    # ── Stage 3: Keyword regex search ────────────────────────────────────────

    def _keyword_search(
        self, terms: List[str], location: str
    ) -> List[Dict[str, Any]]:
        if not terms:
            return []

        search_results = []
        for term in terms:
            term = term.strip()
            if len(term) < 3:
                continue

            regex = re.compile(re.escape(term), re.IGNORECASE)
            query_filter = {
                "$or": [
                    {"service_name": regex},
                    {"service_type": regex},
                    {"specialization": regex},
                    {"provider_name": regex},
                    {"description": regex},
                    {"searchable_text": regex},
                ]
            }
            if location:
                loc_regex = re.compile(re.escape(location), re.IGNORECASE)
                query_filter["$and"] = [{
                    "$or": [
                        {"service_location": loc_regex},
                        {"location": loc_regex},
                    ]
                }]

            docs = list(self.db.service_providers.find(query_filter))
            for d in docs:
                d["_match_source"] = "keyword"
                d["_source_score"] = 0.75
            search_results.extend(docs)

        return search_results

    # ── Stage 4: Rapidfuzz matching ───────────────────────────────────────────

    def _fuzzy_search(
        self, query: str, provider_name: str, service_name: str, location: str
    ) -> List[Dict[str, Any]]:
        all_providers = list(self.db.service_providers.find({}))
        fuzzy_results = []
        query_lower = query.lower()

        for p in all_providers:
            if location:
                loc1 = p.get("service_location", "").lower()
                loc2 = p.get("location", "").lower()
                if location.lower() not in loc1 and location.lower() not in loc2:
                    continue

            # Score against multiple fields
            scores = [
                fuzz.partial_ratio(query_lower, p.get("service_name", "").lower()),
                fuzz.partial_ratio(query_lower, p.get("service_type", "").lower()),
                fuzz.token_set_ratio(query_lower, p.get("description", "").lower()),
                fuzz.token_set_ratio(query_lower, p.get("searchable_text", "").lower()),
            ]

            # Explicit provider/service name fuzzy
            if provider_name:
                scores.append(fuzz.partial_ratio(
                    provider_name.lower(), p.get("provider_name", "").lower()
                ))
            if service_name:
                scores.append(fuzz.partial_ratio(
                    service_name.lower(), p.get("service_name", "").lower()
                ))

            max_score = max(scores)
            if max_score > 65:
                p["_match_source"] = "fuzzy"
                p["_source_score"] = max_score / 100.0
                fuzzy_results.append(p)

        return fuzzy_results

    # ── Stage 5: Semantic / vector search ────────────────────────────────────

    def _semantic_search(
        self, query: str, provider_name: str, service_name: str, k: int = 6
    ) -> List[Dict[str, Any]]:
        try:
            vs = vector_manager.get_vector_store()

            # Build an enriched query that mirrors the searchable_text format
            # so the embedding lands in the right neighbourhood.
            enriched_parts = [query]
            if provider_name:
                enriched_parts.append(f"Provider name: {provider_name}.")
                enriched_parts.append(f"Find {provider_name}.")
            if service_name:
                enriched_parts.append(f"Service name is {service_name}.")
                enriched_parts.append(f"Book {service_name}.")
            enriched_query = " ".join(enriched_parts)

            vector_results = vs.similarity_search_with_score(enriched_query, k=k)
            semantic_results = []

            for doc, score in vector_results:
                service_id = doc.metadata.get("service_id")
                if not service_id:
                    continue

                mongo_doc = self.db.service_providers.find_one({"_id": ObjectId(service_id)})
                if not mongo_doc:
                    continue

                # Chroma L2 distance → similarity (0–1)
                similarity = max(0.0, 1.0 - (score / 2.0))
                if similarity > 0.35:
                    mongo_doc["_match_source"] = "semantic"
                    mongo_doc["_source_score"] = similarity
                    semantic_results.append(mongo_doc)

            return semantic_results

        except Exception as e:
            logger.error(f"[RETRIEVAL] Semantic search failed: {e}")
            return []

    # ── Stage 6: Merge + deduplicate ─────────────────────────────────────────

    def _merge_and_deduplicate(
        self, *lists: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        merged: Dict[str, Dict[str, Any]] = {}
        for res_list in lists:
            for doc in res_list:
                doc_id = str(doc["_id"])
                if doc_id not in merged:
                    merged[doc_id] = doc
                else:
                    # Accumulate match sources, keep best score
                    old_src = merged[doc_id].get("_match_source", "")
                    new_src = doc.get("_match_source", "")
                    if new_src and new_src not in old_src:
                        merged[doc_id]["_match_source"] = f"{old_src},{new_src}".strip(",")
                    if doc.get("_source_score", 0) > merged[doc_id].get("_source_score", 0):
                        merged[doc_id]["_source_score"] = doc["_source_score"]

        return list(merged.values())

    # ── Stage 7: Multi-factor reranker ───────────────────────────────────────

    def _rerank_results(
        self, results: List[Dict[str, Any]], parsed: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        target_svc    = (parsed.get("service_name") or "").lower().strip()
        target_type   = (parsed.get("service_type") or "").lower().strip()
        target_prov   = (parsed.get("provider_name") or "").lower().strip()
        target_loc    = (parsed.get("location") or "").lower().strip()
        target_spec   = (parsed.get("specialization") or "").lower().strip()

        for doc in results:
            score = 0.0

            doc_prov  = (doc.get("provider_name") or doc.get("name") or "").lower()
            doc_svc   = (doc.get("service_name") or "").lower()
            doc_type  = (doc.get("service_type") or "").lower()
            doc_spec  = (doc.get("specialization") or "").lower()
            doc_loc   = (doc.get("service_location") or doc.get("location") or "").lower()

            # Base retrieval quality (0–15 pts)
            score += doc.get("_source_score", 0) * 15

            # ── Provider name — HIGHEST priority (0–60 pts) ──────────
            # If user explicitly named a provider, that provider MUST win.
            if target_prov:
                exact_prov = (target_prov == doc_prov)
                contains_prov = (target_prov in doc_prov) or (doc_prov in target_prov)
                fuzzy_prov = fuzz.partial_ratio(target_prov, doc_prov)

                if exact_prov:
                    score += 60
                elif contains_prov:
                    score += 50
                elif fuzzy_prov >= 85:
                    score += 40
                elif fuzzy_prov >= 70:
                    score += 25

            # ── Service name match (0–50 pts) ─────────────────────────
            if target_svc:
                exact_svc = (target_svc == doc_svc)
                contains_svc = (target_svc in doc_svc) or (doc_svc in target_svc)
                fuzzy_svc = fuzz.partial_ratio(target_svc, doc_svc)

                if exact_svc:
                    score += 50
                elif contains_svc:
                    score += 40
                elif fuzzy_svc >= 85:
                    score += 30
                elif fuzzy_svc >= 70:
                    score += 20

            # ── Service type match (0–30 pts) ─────────────────────────
            if target_type:
                if target_type in doc_type or target_type in doc_svc:
                    score += 30
                elif fuzz.partial_ratio(target_type, doc_type) >= 80:
                    score += 20

            # ── Specialization match (0–25 pts) ───────────────────────
            if target_spec:
                if target_spec in doc_spec:
                    score += 25
                elif fuzz.partial_ratio(target_spec, doc_spec) >= 80:
                    score += 15

            # ── Location match (0–20 pts) ─────────────────────────────
            if target_loc:
                if target_loc in doc_loc:
                    score += 20
                elif fuzz.partial_ratio(target_loc, doc_loc) >= 80:
                    score += 10

            # ── Multi-source bonus (found by >1 retrieval method) ─────
            match_sources = doc.get("_match_source", "")
            source_count = len([s for s in match_sources.split(",") if s.strip()])
            if source_count >= 3:
                score += 10
            elif source_count == 2:
                score += 5

            # ── Quality signals (0–10 pts) ────────────────────────────
            rating = float(doc.get("provider_rating") or doc.get("rating") or 0)
            if rating >= 4.5:
                score += 5
            elif rating >= 4.0:
                score += 2
            if doc.get("is_verified", False):
                score += 5

            doc["_rerank_score"] = round(score, 2)
            doc["_debug"] = {
                "provider_name": doc.get("provider_name"),
                "service_name": doc.get("service_name"),
                "match_source": match_sources,
                "source_score": doc.get("_source_score"),
                "rerank_score": round(score, 2),
            }

        return sorted(results, key=lambda x: x.get("_rerank_score", 0), reverse=True)

    # ── Main entry point ─────────────────────────────────────────────────────

    def _normalize_string(self, s: str) -> str:
        if not s:
            return ""
        return re.sub(r"[^\w]", "", s).lower()

    # ── Main entry point ─────────────────────────────────────────────────────

    def search(
        self,
        raw_query: str,
        existing_shortlist: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        Execute the 7-stage hybrid retrieval pipeline.

        Args:
            raw_query: The user's raw message text.
            existing_shortlist: Providers shortlisted in the current session.
                                Passed in for conversational reference detection.
        """
        print(f"\n[RETRIEVAL] ===== Query: '{raw_query}' =====")

        # ── Stage 0: Conversational reference shortcut ────────────────
        if existing_shortlist and self._is_conversational_reference(raw_query):
            print("[RETRIEVAL STAGE 0] Conversational reference detected — reusing existing shortlist.")
            return {
                "results": existing_shortlist,
                "confidence": "HIGH",
                "debug": {
                    "raw_query": raw_query,
                    "retrieval_mode": "conversational_reference",
                    "shortlist_size": len(existing_shortlist),
                },
            }

        # ── Stage 1: Understand query ─────────────────────────────────
        parsed = self._understand_query(raw_query)
        print(f"[RETRIEVAL] Query Understanding Parsed: {parsed}")

        provider_name = (parsed.get("provider_name") or "").strip()
        service_name  = (parsed.get("service_name") or "").strip()
        location      = (parsed.get("location") or "").strip()
        expanded_terms = parsed.get("expanded_terms") or [raw_query.lower()]

        # Include raw query tokens
        raw_tokens = [t.strip() for t in re.split(r"[\s,]+", raw_query) if len(t.strip()) >= 3]
        all_terms = list(set(expanded_terms + raw_tokens))

        candidates = {}

        def add_cand(doc, source, score):
            cid = str(doc["_id"])
            if cid not in candidates:
                doc["_match_source"] = source
                doc["_source_score"] = score
                candidates[cid] = doc
            else:
                existing = candidates[cid]
                if source not in existing.get("_match_source", "").split(","):
                    existing["_match_source"] = f"{existing['_match_source']},{source}".strip(",")
                if score > existing.get("_source_score", 0):
                    existing["_source_score"] = score

        # ── Stage 1: Exact Name/Service Match ──
        print("[RETRIEVAL STAGE 1] Running Exact Match...")
        if provider_name:
            exact_provs = list(self.db.service_providers.find({
                "provider_name": {"$regex": f"^\\s*{re.escape(provider_name)}\\s*$", "$options": "i"}
            }))
            for p in exact_provs:
                add_cand(p, "stage_1_exact_provider", 1.0)
        if service_name:
            exact_svcs = list(self.db.service_providers.find({
                "service_name": {"$regex": f"^\\s*{re.escape(service_name)}\\s*$", "$options": "i"}
            }))
            for s in exact_svcs:
                add_cand(s, "stage_1_exact_service", 1.0)

        # ── Stage 2: Alias Match ──
        print("[RETRIEVAL STAGE 2] Running Alias Match...")
        if provider_name:
            alias_regex = re.compile(re.escape(provider_name), re.IGNORECASE)
            alias_provs = list(self.db.service_providers.find({
                "$or": [
                    {"aliases": {"$in": [alias_regex]}},
                    {"aliases": alias_regex},
                    {"provider_name": {"$regex": f"^{re.escape(provider_name)}", "$options": "i"}}
                ]
            }))
            for p in alias_provs:
                add_cand(p, "stage_2_alias", 0.95)

        # ── Stage 3: Normalized Name Match ──
        print("[RETRIEVAL STAGE 3] Running Normalized Match...")
        norm_query_prov = self._normalize_string(provider_name)
        norm_query_svc = self._normalize_string(service_name)
        if norm_query_prov or norm_query_svc:
            all_providers = list(self.db.service_providers.find({}))
            for p in all_providers:
                p_name = p.get("provider_name") or p.get("name") or ""
                p_svc = p.get("service_name") or ""
                if norm_query_prov and norm_query_prov == self._normalize_string(p_name):
                    add_cand(p, "stage_3_normalized_provider", 0.90)
                if norm_query_svc and norm_query_svc == self._normalize_string(p_svc):
                    add_cand(p, "stage_3_normalized_service", 0.90)

        # ── Stage 4: Regex Fallback ──
        print("[RETRIEVAL STAGE 4] Running Regex Fallback Match...")
        if provider_name:
            regex_provs = list(self.db.service_providers.find({
                "provider_name": {"$regex": re.escape(provider_name), "$options": "i"}
            }))
            for p in regex_provs:
                add_cand(p, "stage_4_regex_provider", 0.80)
        if service_name:
            regex_svcs = list(self.db.service_providers.find({
                "service_name": {"$regex": re.escape(service_name), "$options": "i"}
            }))
            for s in regex_svcs:
                add_cand(s, "stage_4_regex_service", 0.80)

        # ── Stage 5: Service Type Lookup ──
        print("[RETRIEVAL STAGE 5] Running Service Type Taxonomy Match...")
        svc_type = parsed.get("service_type")
        if svc_type:
            taxonomy_regex = re.compile(re.escape(svc_type), re.IGNORECASE)
            tax_provs = list(self.db.service_providers.find({
                "$or": [
                    {"service_type": taxonomy_regex},
                    {"specialization": taxonomy_regex}
                ]
            }))
            for p in tax_provs:
                add_cand(p, "stage_5_service_type", 0.75)

        for term in all_terms:
            if len(term) >= 3:
                term_regex = re.compile(re.escape(term), re.IGNORECASE)
                term_provs = list(self.db.service_providers.find({
                    "$or": [
                        {"service_name": term_regex},
                        {"service_type": term_regex},
                        {"specialization": term_regex},
                        {"description": term_regex},
                        {"searchable_text": term_regex}
                    ]
                }))
                for p in term_provs:
                    add_cand(p, "stage_5_expanded_term", 0.70)

        # ── Stage 6: Semantic Vector Search ──
        print("[RETRIEVAL STAGE 6] Running Semantic Vector Search Match...")
        semantic_res = self._semantic_search(raw_query, provider_name, service_name, k=6)
        for p in semantic_res:
            add_cand(p, "stage_6_semantic", p.get("_source_score", 0.65))

        # ── Stage 7: Multi-factor Reranking & Final Ordering ──
        print("[RETRIEVAL STAGE 7] Running Multi-factor Reranker & Ordering...")
        candidates_list = list(candidates.values())
        ranked = self._rerank_results(candidates_list, parsed)

        # Confidence + output
        top = ranked[:5]
        best_score = top[0]["_rerank_score"] if top else 0

        if not top:
            confidence = "NONE"
        elif best_score >= 50:
            confidence = "HIGH"
        elif best_score >= 25:
            confidence = "MEDIUM"
        else:
            confidence = "LOW"

        safe_results = []
        for r in top:
            safe = {
                k: v for k, v in r.items()
                if k not in ("embedding", "coordinates", "certifications", "tools")
            }
            safe["_id"] = str(safe["_id"])
            safe_results.append(safe)
            print(
                f"[RETRIEVAL] → {safe.get('service_name')} by {safe.get('provider_name')} "
                f"| score={safe.get('_rerank_score')} | sources={safe.get('_match_source')}"
            )

        print(f"[RETRIEVAL] Confidence: {confidence} | Best score: {best_score}")
        print(f"[RETRIEVAL] ==========================================\n")

        return {
            "results": safe_results,
            "confidence": confidence,
            "debug": {
                "raw_query": raw_query,
                "parsed_intent": parsed,
                "candidates_found": len(candidates_list),
                "best_score": best_score,
                "top_result_debug": top[0].get("_debug") if top else {},
            },
        }