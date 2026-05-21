import os
from pymongo import MongoClient
from bson import json_util

client = MongoClient(os.getenv("MONGODB_URI", "mongodb://localhost:27017"))
db = client["flowtica"]

collections = ["users", "provider_info", "service_providers", "active_requests", "bookings", "provider_availability"]

for coll_name in collections:
    print(f"\n--- COLLECTION: {coll_name} ---")
    doc = db[coll_name].find_one()
    if doc:
        print(json_util.dumps(doc, indent=2))
    else:
        print("Empty collection.")
