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

    def sync_from_mongodb(self, db):
        """
        Loads providers from MongoDB and syncs them to ChromaDB.
        """
        print("Syncing ChromaDB with MongoDB...")
        providers = list(db.service_providers.find({}))
        
        if not providers:
            print("No providers found in MongoDB to sync.")
            return

        vector_store = self.get_vector_store()
        
        # Prepare documents for Chroma
        documents = []
        metadatas = []
        ids = []
        
        for p in providers:
            # Create a rich text representation for semantic search
            text = f"{p['name']} {p['service_type']} {p['specialization']} {p['description']} {p['location']} {' '.join(p.get('languages', []))}"
            
            # Clean up metadata (Chroma metadata must be str, int, float, or bool)
            metadata = {
                "mongodb_id": str(p["_id"]),
                "name": p.get("name", ""),
                "service_type": p.get("service_type", ""),
                "location": p.get("location", ""),
                "rating": float(p.get("rating", 0)),
                "specialization": p.get("specialization", "")
            }
            
            documents.append(text)
            metadatas.append(metadata)
            ids.append(str(p["_id"]))

        # Clear existing and re-add (for simplicity in this refactor)
        # In a real system, you'd check for changes
        vector_store.delete(ids=ids) # Best effort delete
        vector_store.add_texts(texts=documents, metadatas=metadatas, ids=ids)
        print(f"Synced {len(documents)} providers to ChromaDB.")

vector_manager = VectorStoreManager()
