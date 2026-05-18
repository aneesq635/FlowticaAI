import os
from langchain_chroma import Chroma
from langchain_openai import OpenAIEmbeddings
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

class VectorStoreManager:
    def __init__(self, persist_directory="./chroma_db"):
        self.persist_directory = persist_directory
        self.embeddings = OpenAIEmbeddings(openai_api_key=os.getenv("OPENAI_API_KEY"))
        self.collection_name = "service_providers"
        self.vector_store = None
        
    def get_vector_store(self):
        if self.vector_store is None:
            self.vector_store = Chroma(
                collection_name=self.collection_name,
                embedding_function=self.embeddings,
                persist_directory=self.persist_directory
            )
        return self.vector_store

    # def generate_searchable_text(self, p):
    #     """
    #     Generates a rich, highly semantic, context-rich searchable string for RAG embedding.
    #     """
    #     provider_name = p.get("provider_name") or p.get("name") or "Unknown"
    #     service_name = p.get("service_name") or p.get("name") or ""
    #     service_type = p.get("service_type") or "General"
    #     specialization = p.get("specialization") or "Specialist"
        
    #     service_location = p.get("service_location") or p.get("location") or ""
    #     provider_location = p.get("provider_location") or ""
        
    #     # Merge locations cleanly without duplicates
    #     locations = []
    #     if service_location:
    #         locations.append(service_location)
    #     if provider_location and provider_location.lower() not in service_location.lower():
    #         locations.append(provider_location)
    #     locations_str = " ".join(locations).strip() or "Unknown"
        
    #     # Get hourly rate & currency
    #     hourly_rate = p.get("hourly_rate")
    #     if hourly_rate is None:
    #         hourly_rate = p.get("pricing", {}).get("hourly_rate") or 0
    #     currency = p.get("currency") or p.get("pricing", {}).get("currency") or "USD"
        
    #     # Parse languages
    #     languages_list = p.get("languages", [])
    #     if isinstance(languages_list, list):
    #         languages_str = " ".join(languages_list)
    #     else:
    #         languages_str = str(languages_list)
            
    #     description = p.get("description") or ""
        
    #     # Conforms strictly to the requested semantic text style
    #     text = (
    #         f"Provider {provider_name} offers {service_name} {service_type} services specializing in {specialization} "
    #         f"in {locations_str}. Hourly rate {hourly_rate} {currency}. "
    #         f"Languages {languages_str}. Experienced {service_type} for {specialization} and {description}."
    #     )
    #     return text
    def generate_searchable_text(self, p):
      provider_name = p.get("provider_name") or p.get("name") or "Unknown"
      service_name = p.get("service_name") or p.get("name") or ""
      service_type = p.get("service_type") or "General"
      specialization = p.get("specialization") or "Specialist"
      service_location = p.get("service_location") or p.get("location") or ""
      provider_location = p.get("provider_location") or ""
      description = p.get("description") or ""
  
      hourly_rate = p.get("hourly_rate") or p.get("pricing", {}).get("hourly_rate") or 0
      currency = p.get("currency") or p.get("pricing", {}).get("currency") or "PKR"
  
      languages_list = p.get("languages", [])
      languages_str = " ".join(languages_list) if isinstance(languages_list, list) else str(languages_list)
  
      # ✅ Rich repeated text for better semantic matching
      text = (
          f"{provider_name} {provider_name} "  # repeat name for weight
          f"offers {service_name} {service_name} "  # repeat service name
          f"{service_type} {service_type} services "  # repeat service type
          f"specializing in {specialization} {specialization}. "
          f"Located in {service_location} {provider_location}. "
          f"Hourly rate {hourly_rate} {currency}. "
          f"Languages: {languages_str}. "
          f"Description: {description}. "
          # Extra keyword aliases for common search patterns
          f"Provider name: {provider_name}. "
          f"Service: {service_name}. "
          f"Type: {service_type}. "
          f"Specialization: {specialization}."
      )
      return text

    def upsert_service(self, db, service_id):
        """
        Inserts or updates a single service listing in ChromaDB in real-time.
        """
        from bson import ObjectId
        try:
            p = db.service_providers.find_one({"_id": ObjectId(service_id)})
            if not p:
                print(f"[VECTOR STORE] Service {service_id} not found in MongoDB. Skipping upsert.")
                return False
                
            vector_store = self.get_vector_store()
            
            # Generate searchable_text
            text = self.generate_searchable_text(p)
            
            # Clean up metadata (Chroma metadata must be str, int, float, or bool)
            metadata = {
                "mongodb_id": str(p["_id"]),
                "provider_supabase_id": p.get("provider_supabase_id") or p.get("provider_id") or "",
                "provider_name": p.get("provider_name") or p.get("name") or "",
                "provider_phone": p.get("provider_phone") or p.get("phone") or "",
                "provider_email": p.get("provider_email") or p.get("email") or "",
                "provider_location": p.get("provider_location") or p.get("location") or "",
                "provider_rating": float(p.get("provider_rating") or p.get("rating") or 5.0),
                "service_name": p.get("service_name") or p.get("name") or "",
                "service_type": p.get("service_type") or "",
                "specialization": p.get("specialization") or "",
                "description": p.get("description") or "",
                "service_location": p.get("service_location") or p.get("location") or "",
                "hourly_rate": float(p.get("hourly_rate") or p.get("pricing", {}).get("hourly_rate") or 0),
                "currency": p.get("currency") or p.get("pricing", {}).get("currency") or "USD",
                "experience_years": int(p.get("experience_years") or 0)
            }
            
            # Best-effort delete first to prevent duplicate entries
            try:
                vector_store.delete(ids=[str(p["_id"])])
            except Exception:
                pass
                
            vector_store.add_texts(texts=[text], metadatas=[metadata], ids=[str(p["_id"])])
            print(f"[VECTOR STORE] [UPSERT] Successfully indexed service ID: {service_id}")
            print(f"  Searchable text: {text}")
            return True
        except Exception as e:
            print(f"[VECTOR STORE ERROR] Upsert failed for service {service_id}: {e}")
            return False

    def delete_service(self, service_id):
        """
        Deletes a single service listing from ChromaDB in real-time.
        """
        try:
            vector_store = self.get_vector_store()
            vector_store.delete(ids=[str(service_id)])
            print(f"[VECTOR STORE] [DELETE] Successfully deleted service ID: {service_id} from ChromaDB.")
            return True
        except Exception as e:
            print(f"[VECTOR STORE ERROR] Delete failed for service {service_id}: {e}")
            return False

    def sync_from_mongodb(self, db):
        """
        Loads all providers from MongoDB and completely synchronizes the ChromaDB vector store.
        """
        print("[VECTOR STORE] [SYNC] Starting wholesale synchronization from MongoDB...")
        providers = list(db.service_providers.find({}))
        
        if not providers:
            print("[VECTOR STORE] [SYNC] No providers found in MongoDB to sync.")
            return

        vector_store = self.get_vector_store()
        
        documents = []
        metadatas = []
        ids = []
        
        for p in providers:
            text = self.generate_searchable_text(p)
            
            metadata = {
                "mongodb_id": str(p["_id"]),
                "provider_supabase_id": p.get("provider_supabase_id") or p.get("provider_id") or "",
                "provider_name": p.get("provider_name") or p.get("name") or "",
                "provider_phone": p.get("provider_phone") or p.get("phone") or "",
                "provider_email": p.get("provider_email") or p.get("email") or "",
                "provider_location": p.get("provider_location") or p.get("location") or "",
                "provider_rating": float(p.get("provider_rating") or p.get("rating") or 5.0),
                "service_name": p.get("service_name") or p.get("name") or "",
                "service_type": p.get("service_type") or "",
                "specialization": p.get("specialization") or "",
                "description": p.get("description") or "",
                "service_location": p.get("service_location") or p.get("location") or "",
                "hourly_rate": float(p.get("hourly_rate") or p.get("pricing", {}).get("hourly_rate") or 0),
                "currency": p.get("currency") or p.get("pricing", {}).get("currency") or "USD",
                "experience_years": int(p.get("experience_years") or 0)
            }
            
            documents.append(text)
            metadatas.append(metadata)
            ids.append(str(p["_id"]))

        # Clear existing Chroma DB documents and reload completely to eliminate stale records
        try:
            # Delete in chunks or best effort
            vector_store.delete(ids=ids)
        except Exception as delete_err:
            print(f"[VECTOR STORE WARNING] wholesale delete failed: {delete_err}")
            
        vector_store.add_texts(texts=documents, metadatas=metadatas, ids=ids)
        print(f"[VECTOR STORE] [SYNC] Successfully synchronized {len(documents)} providers to ChromaDB.")

vector_manager = VectorStoreManager()
