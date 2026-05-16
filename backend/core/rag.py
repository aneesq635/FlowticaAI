import os
from pymongo import MongoClient
from langchain_openai import OpenAIEmbeddings
from langchain_mongodb import MongoDBAtlasVectorSearch
from dotenv import load_dotenv

load_dotenv()

class RAGManager:
    def __init__(self):
        self.mongo_uri = os.getenv("MONGODB_URI")
        self.db_name = "flowtica"
        self.collection_name = "providers"
        self.client = MongoClient(self.mongo_uri)
        self.db = self.client[self.db_name]
        self.collection = self.db[self.collection_name]
        
        self.embeddings = OpenAIEmbeddings(openai_api_key=os.getenv("OPENAI_API_KEY"))
        
        self.vector_search = MongoDBAtlasVectorSearch(
            collection=self.collection,
            embedding=self.embeddings,
            index_name="vector_index", # This must be created in MongoDB Atlas
            text_key="description",
            embedding_key="embedding"
        )

    def retrieve_providers(self, query: str, limit: int = 4):
        """
        Performs semantic search for providers based on user query.
        """
        try:
            results = self.vector_search.similarity_search(query, k=limit)
            return [
                {
                    "id": str(doc.metadata.get("_id", "")),
                    "name": doc.metadata.get("name"),
                    "category": doc.metadata.get("category"),
                    "price_range": doc.metadata.get("price_range"),
                    "rating": doc.metadata.get("rating"),
                    "description": doc.page_content,
                    "location": doc.metadata.get("location")
                }
                for doc in results
            ]
        except Exception as e:
            print(f"RAG Retrieval Error: {e}")
            # Fallback to simple keyword search if vector index isn't ready
            cursor = self.collection.find({
                "$text": {"$search": query}
            }).limit(limit)
            return [
                {
                    "id": str(p["_id"]),
                    "name": p.get("name"),
                    "category": p.get("category"),
                    "price_range": p.get("price_range"),
                    "rating": p.get("rating"),
                    "description": p.get("description"),
                    "location": p.get("location")
                }
                for p in cursor
            ]

    def seed_mock_data(self, providers):
        """
        Seeds the database with mock provider data and generates embeddings.
        """
        if self.collection.count_documents({}) > 0:
            print("Providers collection already has data. Skipping seed.")
            return

        print(f"Seeding {len(providers)} providers...")
        for p in providers:
            embedding = self.embeddings.embed_query(p["description"])
            p["embedding"] = embedding
            self.collection.insert_one(p)
        print("Seeding complete.")

rag_manager = RAGManager()
