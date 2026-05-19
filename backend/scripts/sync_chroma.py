import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from pymongo import MongoClient
from core.vector_store import vector_manager
from dotenv import load_dotenv

load_dotenv()

def sync():
    mongo_uri = os.getenv("MONGODB_URI")
    client = MongoClient(mongo_uri)
    db = client["flowtica"]
    
    # Check if seeding is needed
    if db.service_providers.count_documents({}) == 0:
        print("MongoDB is empty. Seeding realistic providers first...")
        from scripts.seed_db import seed_database
        seed_database()

    print("Starting manual sync to ChromaDB...")
    vector_manager.sync_from_mongodb(db)
    print("Manual sync complete.")

if __name__ == "__main__":
    sync()
