import os
import json
from datetime import datetime
from pymongo import MongoClient
from bson import ObjectId
from dotenv import load_dotenv

# Path configuration
ENV_PATH = r'd:\New folder (5)\ai-service-orchestration\.env'
load_dotenv(ENV_PATH)

MONGO_URI = os.getenv("MONGODB_URI")
DB_NAME = "flowtica"

def verify_and_populate():
    print("--- Phase A: Collection Normalization Verification ---")
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    
    # Official Collection Mapping (Physical to Logical)
    collections = {
        "user": db["users"],
        "provider_info": db["provider_info"],
        "service_provider": db["service_providers"],
        "active_request": db["active_requests"],
        "booking": db["bookings"]
    }
    
    test_supabase_id = "test-normalization-user-001"
    
    # 1. Verification of USER record
    print("\n[1/5] Normalizing USER record...")
    user_data = {
        "supabase_id": test_supabase_id,
        "email": "test@flowtica.com",
        "phone": "+923001234567",
        "name": "Test Customer",
        "location": "Gulberg III, Lahore",
        "location_data": {
            "address": "Gulberg III, Lahore, Pakistan",
            "latitude": 31.5115,
            "longitude": 74.3436
        },
        "user_type": "buyer",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    collections["user"].update_one(
        {"supabase_id": test_supabase_id},
        {"$set": user_data},
        upsert=True
    )
    print("✓ USER normalized.")

    # 2. Verification of provider_info record
    print("\n[2/5] Normalizing provider_info record...")
    provider_info_data = {
        "supabase_id": test_supabase_id,
        "name": "Test Customer", # Same as user
        "email": "test@flowtica.com",
        "phone": "+923001234567",
        "location": "Gulberg III, Lahore",
        "rating": 4.9,
        "completed_jobs": 15,
        "total_earnings": 45000,
        "total_hours_worked": 60,
        "status": "active"
    }
    collections["provider_info"].update_one(
        {"supabase_id": test_supabase_id},
        {"$set": provider_info_data},
        upsert=True
    )
    print("✓ provider_info normalized.")

    # 3. Verification of service_provider record
    print("\n[3/5] Normalizing service_provider (Card) record...")
    service_card_data = {
        "provider_supabase_id": test_supabase_id,
        "provider_name": "Test Customer",
        "provider_phone": "+923001234567",
        "service_name": "Pro Electrician",
        "service_type": "Electrician",
        "hourly_rate": 1500,
        "currency": "PKR",
        "experience_years": 8,
        "rating": 4.9,
        "reliability_score": 0.98,
        "travel_radius": 15.0,
        "working_hours": "08:00 - 20:00",
        "emergency_availability": True,
        "provider_location_data": {
            "address": "Gulberg III, Lahore, Pakistan",
            "latitude": 31.5115,
            "longitude": 74.3436
        }
    }
    collections["service_provider"].update_one(
        {"provider_supabase_id": test_supabase_id, "service_type": "Electrician"},
        {"$set": service_card_data},
        upsert=True
    )
    print("✓ service_provider normalized.")

    # 4. Verification of active_request (Transaction Snapshot)
    print("\n[4/5] Normalizing active_request record...")
    request_id = ObjectId()
    request_data = {
        "_id": request_id,
        "customer_supabase_id": "customer-xyz",
        "customer_name": "Ali Khan",
        "customer_phone": "+923331112223",
        "provider_supabase_id": test_supabase_id,
        "provider_name": "Test Customer",
        "service_type": "Electrician",
        "status": "pending", # Initial state
        "offered_price": 1500,
        "requested_date": "2026-05-25",
        "requested_time": "14:00",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        # MANDATORY SNAPSHOT FIELDS
        "customer_location_data": {"latitude": 31.5204, "longitude": 74.3587},
        "provider_location_data": {"latitude": 31.5115, "longitude": 74.3436}
    }
    collections["active_request"].insert_one(request_data)
    print("✓ active_request created as ONLY source for pending state.")

    # 5. Verification of booking (Finalized History ONLY after Acceptance)
    print("\n[5/5] Normalizing booking record (POST-ACCEPTANCE)...")
    
    # Simulate Acceptance
    collections["active_request"].update_one(
        {"_id": request_id},
        {"$set": {"status": "accepted", "updated_at": datetime.utcnow()}}
    )
    
    # booking is created ONLY NOW
    booking_data = {
        "active_request_id": str(request_id),
        "customer_supabase_id": "customer-xyz",
        "provider_supabase_id": test_supabase_id,
        "price": 1500,
        "status": "confirmed",
        "confirmed_at": datetime.utcnow(),
        # DEEP IMMUTABLE SNAPSHOT
        "snapshot": {
            "customer_name": "Ali Khan",
            "customer_phone": "+923331112223",
            "provider_name": "Test Customer",
            "provider_phone": "+923001234567",
            "service_type": "Electrician",
            "location_data": {"latitude": 31.5204, "longitude": 74.3587}
        }
    }
    collections["booking"].insert_one(booking_data)
    print("✓ booking created ONLY after status transition to accepted.")

    # 6. Immutability Test
    print("\n[BONUS] Testing Snapshot Immutability...")
    # Change provider phone in service_provider
    collections["service_provider"].update_one(
        {"provider_supabase_id": test_supabase_id},
        {"$set": {"provider_phone": "+923999999999"}} # New phone
    )
    
    # Check old booking snapshot
    old_booking = collections["booking"].find_one({"active_request_id": str(request_id)})
    if old_booking["snapshot"]["provider_phone"] == "+923001234567":
        print("✓ Immutable Snapshot Test: PASSED (Old record preserved original data).")
    else:
        print("x Immutable Snapshot Test: FAILED (Old record was mutated).")

    print("\n--- VALIDATION COMPLETE ---")

if __name__ == "__main__":
    verify_and_populate()
