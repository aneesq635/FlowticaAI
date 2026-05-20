import os
import sys
import googlemaps
from pymongo import MongoClient
from dotenv import load_dotenv

# Add the parent directory to sys.path to import from backend
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = "flowtica"
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")

if not GOOGLE_MAPS_API_KEY:
    print("Error: GOOGLE_MAPS_API_KEY not found in .env")
    sys.exit(1)

gmaps = googlemaps.Client(key=GOOGLE_MAPS_API_KEY)
client = MongoClient(MONGO_URI)
db = client[DB_NAME]

def geocode_address(address):
    if not address or address == "Not provided" or address == "Unknown":
        return None
    try:
        results = gmaps.geocode(address)
        if results:
            loc = results[0]['geometry']['location']
            # Simple parsing of address components
            components = results[0].get('address_components', [])
            city = next((c['long_name'] for c in components if 'locality' in c['types']), "")
            country = next((c['long_name'] for c in components if 'country' in c['types']), "")
            
            return {
                "address": results[0]['formatted_address'],
                "city": city,
                "country": country,
                "lat": loc['lat'],
                "lng": loc['lng']
            }
    except Exception as e:
        print(f"Error geocoding {address}: {e}")
    return None

def backfill_collection(collection_name, query):
    collection = db[collection_name]
    count = collection.count_documents(query)
    print(f"Processing {count} documents in {collection_name}...")
    
    cursor = collection.find(query)
    updated_count = 0
    
    for doc in cursor:
        address = doc.get("location")
        if not address:
            continue
            
        location_data = geocode_address(address)
        if location_data:
            collection.update_one(
                {"_id": doc["_id"]},
                {"$set": {"location_data": location_data}}
            )
            updated_count += 1
            if updated_count % 10 == 0:
                print(f"Updated {updated_count}/{count} in {collection_name}")
                
    print(f"Backfill complete for {collection_name}. Total updated: {updated_count}")

if __name__ == "__main__":
    # Update users
    backfill_collection("users", {"location_data": {"$exists": False}, "location": {"$exists": True, "$ne": ""}})
    
    # Update providers (if stored separately)
    backfill_collection("provider_info", {"location_data": {"$exists": False}, "location": {"$exists": True, "$ne": ""}})
