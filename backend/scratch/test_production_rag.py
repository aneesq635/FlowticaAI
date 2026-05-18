import sys
import os
import time
from dotenv import load_dotenv

# Add backend root to path so 'core' and 'agents' packages are resolvable
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, BACKEND_DIR)

load_dotenv(os.path.join(BACKEND_DIR, ".env"))

from pymongo import MongoClient
from core.vector_store import vector_manager
from agents.service_agents import KnowledgeAgent

mongo_uri = os.environ.get("MONGODB_URI")
client = MongoClient(mongo_uri)
db = client["flowtica"]

print("=== TESTING RAG HYBRID SEARCH PIPELINE ===")

# Force a full sync to populate vector store
print("\n[TEST] 1. Syncing Vector Store from MongoDB...")
vector_manager.sync_from_mongodb(db)

# Run Knowledge Agent on a query
print("\n[TEST] 2. Initializing Knowledge Agent...")
ka = KnowledgeAgent(db)

test_queries = [
    "I need Pipe Fixer service of Anees Qureshi",
    "I want plumbing service Qureshi specialization leakage fix",
    "I need a plumber in Rawalpindi"
]

for query in test_queries:
    print("\n" + "="*80)
    print(f"RUNNING TEST QUERY: '{query}'")
    
    # Mock state
    state = {
        "messages": [type("obj", (object,), {"content": query})()],
        "service_request": {},
        "entities": {},
        "intent": {"value": "service_request"}
    }
    
    start_time = time.time()
    result = ka.run(state)
    end_time = time.time()
    
    candidates = result.get("provider_candidates", [])
    print(f"\n[TEST RESULT] Returned {len(candidates)} candidates in {end_time - start_time:.2f}s.")
    for idx, c in enumerate(candidates[:3]):
        b = c.get("boosting_details", {})
        print(f"  #{idx+1}: {c.get('provider_name')} - {c.get('service_name')} (Score: {c.get('score'):.2f}, Applied: {b.get('applied')})")

print("\n=== TEST COMPLETED ===")
