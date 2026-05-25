import os
import pymongo
from bson import ObjectId
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGODB_URI")
client = pymongo.MongoClient(MONGO_URI)
db = client["flowtica"]

def migrate_users():
    print("Migrating 'users' collection...")
    # Remove top-level 'location' field
    result = db.users.update_many(
        {"location": {"$exists": True}},
        {"$unset": {"location": ""}}
    )
    print(f"Updated {result.modified_count} users.")

def migrate_provider_info():
    print("Migrating 'provider_info' collection...")
    # Remove top-level 'location' field
    result = db.provider_info.update_many(
        {"location": {"$exists": True}},
        {"$unset": {"location": ""}}
    )
    print(f"Updated {result.modified_count} providers.")

def migrate_service_providers():
    print("Migrating 'service_providers' collection...")
    # 1. Rename location_data to provider_location_data
    # 2. Set service_location from location
    # 3. Remove location, provider_location
    
    docs = list(db.service_providers.find({}))
    for doc in docs:
        update = {}
        
        # Sourcing canonical provider info
        p_sid = doc.get("provider_supabase_id")
        provider = db.provider_info.find_one({"supabase_id": p_sid})
        if provider:
            update["provider_location_data"] = provider.get("location_data", {})
        
        # Map area string
        current_loc = doc.get("location") or doc.get("service_location")
        if current_loc:
            update["service_location"] = current_loc
            
        # Unset old fields
        unset = {"location": "", "provider_location": "", "location_data": ""}
        
        db.service_providers.update_one(
            {"_id": doc["_id"]},
            {"$set": update, "$unset": unset}
        )
    print(f"Processed {len(docs)} service providers.")

def migrate_active_requests():
    print("Migrating 'active_requests' collection...")
    docs = list(db.active_requests.find({}))
    for doc in docs:
        update = {}
        
        # Source provider location data from provider record
        p_sid = doc.get("provider_supabase_id")
        provider = db.provider_info.find_one({"supabase_id": p_sid})
        if provider:
            update["provider_location_data"] = provider.get("location_data", {})
            
        # Map area string
        current_loc = doc.get("location") or doc.get("service_location")
        if current_loc:
            update["service_location"] = current_loc
            
        # Unset old fields
        unset = {"location": "", "provider_location": "", "customer_location": ""}
        
        db.active_requests.update_one(
            {"_id": doc["_id"]},
            {"$set": update, "$unset": unset}
        )
    print(f"Processed {len(docs)} active requests.")

def migrate_bookings():
    print("Migrating 'bookings' collection...")
    docs = list(db.bookings.find({}))
    for doc in docs:
        update = {}
        
        # Source provider real home address
        p_sid = doc.get("provider_supabase_id")
        provider = db.provider_info.find_one({"supabase_id": p_sid})
        if provider:
            update["provider_location_data"] = provider.get("location_data", {})
            
        # Map area string
        current_loc = doc.get("location") or doc.get("service_location")
        if current_loc:
            update["service_location"] = current_loc
            
        # Unset old fields
        unset = {"location": "", "provider_location": "", "customer_location": ""}
        
        db.bookings.update_one(
            {"_id": doc["_id"]},
            {"$set": update, "$unset": unset}
        )
    print(f"Processed {len(docs)} bookings.")

if __name__ == "__main__":
    migrate_users()
    migrate_provider_info()
    migrate_service_providers()
    migrate_active_requests()
    migrate_bookings()
    print("Migration complete!")
