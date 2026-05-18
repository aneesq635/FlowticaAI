import sys
import os
from pymongo import MongoClient
from dotenv import load_dotenv
from bson import ObjectId
import datetime

# Set Cwd/sys.path correctly
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

load_dotenv()

from agents.orchestrator import SupervisorAgent, CommunicationAgent
from agents.service_agents import RequestCreationAgent, MemoryAgent
from core.state import AgentState

def run_tests():
    print("==================================================")
    print("[TESTING] Flowtica Orchestration Fix Verification")
    print("==================================================")
    
    mongo_uri = os.getenv("MONGODB_URI")
    client = MongoClient(mongo_uri)
    db = client["flowtica"]
    
    # Clean up test documents in db
    db.active_requests.delete_many({"conversation_id": "test_verification_conv"})
    db.users.delete_many({"supabase_id": "test_user_id"})
    db.provider_info.delete_many({"supabase_id": "test_provider_id"})
    db.service_providers.delete_many({"provider_supabase_id": "test_provider_id"})
    
    # Setup test entities in MongoDB
    db.users.insert_one({
        "supabase_id": "test_user_id",
        "name": "Test Customer",
        "email": "customer@test.com",
        "phone": "+123456",
        "location": "G-13"
    })
    
    db.provider_info.insert_one({
        "supabase_id": "test_provider_id",
        "name": "Test Provider",
        "email": "provider@test.com",
        "phone": "+987654",
        "location": "G-13"
    })
    
    db.service_providers.insert_one({
        "provider_supabase_id": "test_provider_id",
        "service_type": "Plumbing",
        "specialization": "Leakage Fixing",
        "location": "G-13"
    })
    
    # 1. Test RequestCreationAgent duplicate guard and validation
    print("\n--- TEST 1: RequestCreationAgent Execution and Guard ---")
    creation_agent = RequestCreationAgent(db)
    
    state = {
        "conversation_id": "test_verification_conv",
        "user_id": "test_user_id",
        "selected_provider": {
            "provider_supabase_id": "test_provider_id",
            "service_type": "Plumbing"
        },
        "booking_context": {
            "requested_date": "2026-05-20",
            "requested_time": "14:00",
            "offered_price": 50
        },
        "execution_logs": [],
        "reasoning_traces": [],
        "errors": []
    }
    
    # Run creation
    res1 = creation_agent.run(state)
    assert res1["request_creation_success"] is True, "First creation failed"
    req_id = res1["active_request_id"]
    print(f"SUCCESS: Active request created in MongoDB: {req_id}")
    
    # Try duplicate insertion
    res2 = creation_agent.run(state)
    assert res2["request_creation_success"] is True, "Duplicate guard execution failed"
    assert res2["active_request_id"] == req_id, "Duplicate request not suppressed"
    print("SUCCESS: Duplicate request suppressed and rehydrated existing ID correctly!")
    
    # 2. Test SupervisorAgent Real-time Status Syncing & Loop Safety Guard
    print("\n--- TEST 2: SupervisorAgent Sync and Loop Safety ---")
    supervisor = SupervisorAgent(db)
    
    # Prepare state with active_request_id
    state_supervisor = {
        "conversation_id": "test_verification_conv",
        "user_id": "test_user_id",
        "active_request_id": req_id,
        "booking_details": {"request_id": req_id, "status": "pending"},
        "intent": {"value": "check_status"},
        "next_agent": "",
        "iteration_count": 0,
        "turn_routed_agents": [],
        "execution_logs": [],
        "reasoning_traces": []
    }
    
    # Change status in DB to "approved" to simulate external provider action
    db.active_requests.update_one({"_id": ObjectId(req_id)}, {"$set": {"status": "approved"}})
    
    # Run supervisor
    res_sup = supervisor.run(state_supervisor)
    assert res_sup["latest_request_status"] == "approved", "Supervisor failed to sync DB status"
    assert res_sup["booking_details"]["status"] == "approved", "Supervisor failed to update booking_details status namespace"
    print("SUCCESS: Supervisor synced live approved status and populated namespaces!")
    
    # Test Supervisor turn-routed loop guard
    state_sup_loop = {
        **state_supervisor,
        "intent": {"value": "check_status"},
        "next_agent": "intent",
        "turn_routed_agents": ["negotiation"]  # negotiation is already in routed list
    }
    
    # Check supervisor routing decision when check_status intent routes to "negotiation" but it has already run
    res_sup_loop = supervisor.run(state_sup_loop)
    assert res_sup_loop["next_agent"] == "communication", "Supervisor Loop safety guard failed to override route to communication"
    print("SUCCESS: Supervisor Loop safety guard correctly overrode routing to communication!")
    
    # 3. Test CommunicationAgent Live Verification Chain
    print("\n--- TEST 3: CommunicationAgent DB Verification Chain ---")
    communication = CommunicationAgent(db)
    
    # Scenario A: DB matches context
    state_comm_ok = {
        "conversation_id": "test_verification_conv",
        "user_id": "test_user_id",
        "active_request_id": req_id,
        "request_creation_success": True,
        "intent": {"value": "provider_selection"},
        "booking_context": {
            "requested_date": "2026-05-20",
            "requested_time": "14:00",
            "offered_price": 50
        },
        "messages": [],
        "execution_logs": [],
        "reasoning_traces": []
    }
    
    # Let's restore the price and date in DB first to ensure match
    db.active_requests.update_one({"_id": ObjectId(req_id)}, {"$set": {"offered_price": 50, "requested_date": "2026-05-20", "requested_time": "14:00"}})
    
    res_comm_ok = communication.run(state_comm_ok)
    # Verification should succeed, and it shouldn't inject failure
    assert res_comm_ok.get("request_creation_success") is not False, "Communication verified valid request incorrectly as failed"
    print("SUCCESS: Valid request successfully verified by CommunicationAgent!")
    
    # Scenario B: DB mismatch context
    state_comm_mismatch = {
        **state_comm_ok,
        "booking_context": {
            "requested_date": "2026-05-20",
            "requested_time": "14:00",
            "offered_price": 999  # Mismatch offered price
        }
    }
    res_comm_err = communication.run(state_comm_mismatch)
    assert res_comm_err.get("request_creation_success") is False, "Communication failed to catch DB data mismatch"
    assert "Verification chain failed" in res_comm_err.get("request_creation_error", ""), "Missing expected verification error details"
    print("SUCCESS: CommunicationAgent detected DB data mismatch and safely overrode status to failure!")
    
    # 4. Test MemoryAgent Resume Rehydration
    print("\n--- TEST 4: MemoryAgent Resume Rehydration ---")
    memory_agent = MemoryAgent(db)
    
    state_resume = {
        "conversation_id": "test_verification_conv",
        "user_id": "test_user_id",
        "active_request_id": req_id,
        "messages": [],
        "active_agent": "supervisor",
        "metadata": {"is_resumed": True},
        "execution_logs": [],
        "reasoning_traces": []
    }
    
    res_resume = memory_agent.run(state_resume)
    assert res_resume.get("active_request_id") == req_id, "MemoryAgent failed to rehydrate request ID"
    assert res_resume.get("latest_request_status") == "approved", "MemoryAgent failed to rehydrate request status"
    assert res_resume.get("booking_details")["status"] == "approved", "MemoryAgent failed to populate booking_details status namespace"
    print("SUCCESS: MemoryAgent successfully rehydrated live active request context from DB!")
    
    # Clean up test documents in db
    db.active_requests.delete_many({"conversation_id": "test_verification_conv"})
    db.users.delete_many({"supabase_id": "test_user_id"})
    db.provider_info.delete_many({"supabase_id": "test_provider_id"})
    db.service_providers.delete_many({"provider_supabase_id": "test_provider_id"})
    
    print("\n==================================================")
    print("ALL TESTS COMPLETED SUCCESSFULLY!")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
