"""
core/vector_store.py

KEY CHANGES:
- generate_searchable_text() now produces a rich, multi-phrase document
  that embeds provider name, service name, aliases, and natural language
  phrasings so semantic search finds exact-named providers reliably.
- upsert_service() is unchanged in signature — drop-in replacement.
"""

import os
from pymongo import MongoClient
from langchain_chroma import Chroma
from langchain_google_vertexai import VertexAIEmbeddings
from dotenv import load_dotenv

load_dotenv()


class VectorStoreManager:
    def __init__(self):
        self.embeddings = VertexAIEmbeddings(
            model_name="text-embedding-005",
            project=os.getenv("GOOGLE_CLOUD_PROJECT"),
            location=os.getenv("VERTEX_AI_LOCATION", "us-central1")
        )
        self._vector_store = None

    def get_vector_store(self) -> Chroma:
        if self._vector_store is None:
            self._vector_store = Chroma(
                collection_name="flowtica_services",
                embedding_function=self.embeddings,
                persist_directory="./chroma_db",
            )
        return self._vector_store

    # ------------------------------------------------------------------
    # CORE FIX: Rich searchable text that embeds ALL identifiable fields
    # so that queries like "NESU Qureshi tutoring" or "find the plumber
    # in G-13" hit the right document even under semantic search.
    # ------------------------------------------------------------------
    def generate_searchable_text(self, doc: dict) -> str:
        """
        Builds a rich, embedding-friendly document from a service record.

        Design principles:
        1. Repeat the most important identifiers (provider name, service name)
           multiple times in natural sentence forms so the embedding model
           assigns them high weight.
        2. Include common user phrasings / aliases so partial and fuzzy
           queries land on correct documents.
        3. Never output repetitive junk — every sentence adds new signal.
        4. Generalised: works for any provider/service, not hardcoded.
        """
        provider_name   = (doc.get("provider_name") or doc.get("name") or "").strip()
        service_name    = (doc.get("service_name") or "").strip()
        service_type    = (doc.get("service_type") or "").strip()
        specialization  = (doc.get("specialization") or "").strip()
        description     = (doc.get("description") or "").strip()
        location        = (doc.get("service_location") or "").strip()
        experience      = doc.get("experience_years", 0)
        rating          = doc.get("provider_rating") or doc.get("rating") or 0
        languages       = doc.get("languages") or []
        hourly_rate     = doc.get("hourly_rate") or doc.get("pricing", {}).get("hourly_rate") or 0
        currency        = doc.get("currency") or doc.get("pricing", {}).get("currency") or "PKR"

        # ── Build sentence blocks ──────────────────────────────────────

        # Block 1: Identity sentences (repeated for embedding weight)
        identity_lines = []
        if provider_name:
            identity_lines.append(f"{provider_name} is a service provider on Flowtica.")
            identity_lines.append(f"Provider name: {provider_name}.")
        if service_name:
            identity_lines.append(f"Service offered: {service_name}.")
            identity_lines.append(f"Service name is {service_name}.")
        if provider_name and service_name:
            identity_lines.append(
                f"{provider_name} offers {service_name}."
            )
        if service_type:
            identity_lines.append(f"Service type: {service_type}.")
        if specialization and specialization.lower() != service_type.lower():
            identity_lines.append(f"Specialization: {specialization}.")

        # Block 2: Natural language description
        desc_lines = []
        if description:
            desc_lines.append(description)
        if specialization:
            desc_lines.append(
                f"This provider specializes in {specialization}."
            )
        if experience:
            desc_lines.append(
                f"{provider_name or 'The provider'} has {experience} years of experience."
            )

        # Block 3: Searchability aliases
        # These are generic phrases a user might type for ANY service.
        # They are built from the actual field values — no hardcoding.
        alias_lines = []
        if service_type:
            alias_lines.append(
                f"Looking for {service_type}? {provider_name or 'This provider'} can help."
            )
        if specialization:
            alias_lines.append(
                f"Need {specialization}? Contact {provider_name or 'this provider'}."
            )
        if service_name:
            # Produce a "find X" phrasing so conversational queries match
            alias_lines.append(f"Find {service_name} on Flowtica.")
            alias_lines.append(f"Book {service_name}.")
        if provider_name:
            alias_lines.append(f"Find {provider_name}.")
            alias_lines.append(f"Contact {provider_name}.")

        # Block 4: Location + logistics
        logistics_lines = []
        if location:
            logistics_lines.append(f"Located in {location}.")
            if provider_name:
                logistics_lines.append(
                    f"{provider_name} provides services in {location}."
                )
        if hourly_rate:
            logistics_lines.append(
                f"Hourly rate: {hourly_rate} {currency}."
            )
        if rating:
            logistics_lines.append(f"Provider rating: {rating} stars.")
        if languages:
            lang_str = ", ".join(languages)
            logistics_lines.append(f"Languages: {lang_str}.")

        # ── Combine all blocks ─────────────────────────────────────────
        all_lines = identity_lines + desc_lines + alias_lines + logistics_lines
        # Deduplicate while preserving order
        seen = set()
        unique_lines = []
        for line in all_lines:
            key = line.strip().lower()
            if key and key not in seen:
                seen.add(key)
                unique_lines.append(line.strip())

        return " ".join(unique_lines)

    # ------------------------------------------------------------------
    # upsert_service — unchanged interface, uses new searchable_text
    # ------------------------------------------------------------------
    def upsert_service(self, db, service_id: str):
        """
        Upserts a single service document into ChromaDB.
        Called immediately after insert/update in the Flask API so the
        vector index is never stale.
        """
        from bson import ObjectId

        doc = db.service_providers.find_one({"_id": ObjectId(service_id)})
        if not doc:
            print(f"[VECTOR STORE] upsert_service: doc {service_id} not found in MongoDB.")
            return

        searchable_text = self.generate_searchable_text(doc)

        # Persist updated searchable_text back to Mongo for keyword search
        db.service_providers.update_one(
            {"_id": ObjectId(service_id)},
            {"$set": {"searchable_text": searchable_text}},
        )

        vs = self.get_vector_store()
        try:
            vs.delete(ids=[service_id])  # remove stale doc if exists
        except Exception:
            pass

        updated_at_str = ""
        if doc.get("updated_at"):
            if hasattr(doc["updated_at"], "isoformat"):
                updated_at_str = doc["updated_at"].isoformat()
            else:
                updated_at_str = str(doc["updated_at"])

        vs.add_texts(
            texts=[searchable_text],
            metadatas=[{
                "service_id": service_id,
                "provider_name": doc.get("provider_name") or doc.get("name") or "",
                "service_name": doc.get("service_name") or "",
                "service_type": doc.get("service_type") or "",
                "specialization": doc.get("specialization") or "",
                "location": doc.get("service_location") or "",
                "provider_supabase_id": doc.get("provider_supabase_id") or "",
                "rating": doc.get("provider_rating") or doc.get("rating") or 0,
                "hourly_rate": doc.get("hourly_rate") or 0,
                "updated_at": updated_at_str,
            }],
            ids=[service_id],
        )
        print(f"[VECTOR STORE] Upserted service {service_id} | {doc.get('service_name')} by {doc.get('provider_name')}")

    def delete_service(self, service_id: str):
        vs = self.get_vector_store()
        vs.delete(ids=[service_id])
        print(f"[VECTOR STORE] Deleted service {service_id} from ChromaDB.")

    def sync_from_mongodb(self, db):
        """
        Full re-sync: rebuilds all ChromaDB documents from MongoDB.
        Run this once on startup or via the sync script.
        """
        services = list(db.service_providers.find({}))
        print(f"[VECTOR STORE] Starting full sync — {len(services)} services.")
        for svc in services:
            try:
                self.upsert_service(db, str(svc["_id"]))
            except Exception as e:
                print(f"[VECTOR STORE SYNC ERROR] {svc.get('_id')}: {e}")
        print("[VECTOR STORE] Full sync complete.")




vector_manager = VectorStoreManager()