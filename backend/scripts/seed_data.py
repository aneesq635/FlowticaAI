from core.rag import rag_manager
import os
import sys

# Add the parent directory to sys.path to allow imports from core
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

MOCK_PROVIDERS = [
    {
        "name": "Sparky Pro Solutions",
        "category": "Electrician",
        "description": "Expert residential and commercial electrical repairs. 24/7 emergency services available. Licensed and insured.",
        "location": "New York, NY",
        "price_range": "$$$",
        "rating": 4.8,
        "base_rate": 120,
        "availability": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    },
    {
        "name": "Flow Master Plumbing",
        "category": "Plumber",
        "description": "Specializing in pipe repairs, drain cleaning, and water heater installations. Fast and reliable service.",
        "location": "Brooklyn, NY",
        "price_range": "$$",
        "rating": 4.9,
        "base_rate": 95,
        "availability": ["Monday", "Wednesday", "Friday", "Saturday"]
    },
    {
        "name": "Pure Green Cleaning",
        "category": "Cleaning",
        "description": "Eco-friendly home and office cleaning services. We use non-toxic, biodegradable products for a safe environment.",
        "location": "Manhattan, NY",
        "price_range": "$",
        "rating": 4.7,
        "base_rate": 60,
        "availability": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    },
    {
        "name": "Elite AI Consulting",
        "category": "AI Services",
        "description": "Strategic AI implementation and workflow automation for businesses. Specialized in LangChain and LangGraph orchestration.",
        "location": "Remote",
        "price_range": "$$$$",
        "rating": 5.0,
        "base_rate": 350,
        "availability": ["Monday", "Tuesday", "Wednesday", "Thursday"]
    },
    {
        "name": "Fix-It Handyman",
        "category": "Handyman",
        "description": "Small home repairs, furniture assembly, and general maintenance. No job is too small for our experienced team.",
        "location": "Queens, NY",
        "price_range": "$$",
        "rating": 4.6,
        "base_rate": 80,
        "availability": ["Saturday", "Sunday"]
    }
]

def run_seed():
    print("Starting data seed...")
    try:
        rag_manager.seed_mock_data(MOCK_PROVIDERS)
        print("Seed process finished successfully.")
    except Exception as e:
        print(f"Error during seeding: {e}")

if __name__ == "__main__":
    run_seed()
