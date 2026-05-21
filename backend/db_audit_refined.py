import os
from pymongo import MongoClient
from bson import json_util

client = MongoClient(os.getenv("MONGODB_URI", "mongodb://localhost:27017"))
db = client["flowtica"]

collections = ["users", "provider_info", "service_providers"]

for coll_name in collections:
    print(f"\n--- COLLECTION: {coll_name} ---")
    docs = list(db[coll_name].find().limit(5))
    for doc in docs:
        # Remove large fields for readability
        if "embedding" in doc: doc["embedding"] = "[VECTOR]"
        if "vector" in doc: doc["vector"] = "[VECTOR]"
        print(json_util.dumps(doc, indent=2))
