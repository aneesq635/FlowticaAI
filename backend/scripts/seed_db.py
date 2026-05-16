import os
import json
import datetime
import random
from pymongo import MongoClient
from langchain_openai import OpenAIEmbeddings
from dotenv import load_dotenv

load_dotenv()

def generate_mock_providers():
    services = ["AC Repair", "Plumbing", "Electrical Services", "Beautician", "Mechanic", "Tutor"]
    locations = ["I-14", "G-13", "DHA", "Gulberg", "Johar Town", "Saddar"]
    languages = ["English", "Urdu", "Punjabi", "Pashto"]
    
    specializations = {
        "AC Repair": ["Split AC", "Inverter AC", "Central Cooling", "Gas Charging"],
        "Plumbing": ["Leakage Fixing", "Pipe Installation", "Geyser Repair", "Sanitary Work"],
        "Electrical Services": ["Wiring", "UPS Installation", "Solar Panel Setup", "Short Circuit Fix"],
        "Beautician": ["Bridal Makeup", "Hair Styling", "Skin Care", "Mehndi"],
        "Mechanic": ["Engine Tuning", "Brake Service", "Suspension", "Oil Change"],
        "Tutor": ["Maths", "Science", "Physics", "English Literature", "Urdu Language"]
    }

    providers = []
    
    for i in range(35):
        service = random.choice(services)
        location = random.choice(locations)
        spec = random.choice(specializations[service])
        name = f"Provider {i+1} - {service} Expert"
        
        description = f"Expert {service} provider specialized in {spec}. Serving in {location} and surrounding areas. Over {random.randint(3, 15)} years of experience in {service}."
        
        provider = {
            "provider_id": f"PROV-{1000 + i}",
            "name": name,
            "service_type": service,
            "specialization": spec,
            "description": description,
            "location": location,
            "coordinates": {"lat": random.uniform(33.5, 33.8), "lng": random.uniform(72.9, 73.2)},
            "rating": round(random.uniform(3.5, 5.0), 1),
            "review_count": random.randint(10, 500),
            "reliability_score": round(random.uniform(0.8, 1.0), 2),
            "cancellation_rate": round(random.uniform(0.01, 0.1), 2),
            "price_range": random.choice(["$", "$$", "$$$"]),
            "pricing": {"hourly_rate": random.randint(20, 100), "currency": "USD"},
            "availability": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][:random.randint(4, 7)],
            "experience_years": random.randint(3, 20),
            "completed_jobs": random.randint(50, 1000),
            "languages": random.sample(languages, k=random.randint(1, 3)),
            "certifications": [f"{service} Certified Professional"],
            "tools": ["Professional Tool Kit", "Diagnostic Equipment"],
            "reviews": [
                {"user": "Customer A", "rating": 5, "comment": "Excellent service!"},
                {"user": "Customer B", "rating": 4, "comment": "Very professional."}
            ],
            "profile_image": f"https://images.unsplash.com/photo-{random.randint(1500000000000, 1600000000000)}?auto=format&fit=crop&q=80&w=200",
            "phone": f"+92-300-{random.randint(1000000, 9999999)}",
            "email": f"provider{i}@flowtica.com",
            "is_verified": random.choice([True, False]),
            "created_at": datetime.datetime.now().isoformat()
        }
        providers.append(provider)
        
    return providers

def seed_database():
    mongo_uri = os.getenv("MONGODB_URI")
    client = MongoClient(mongo_uri)
    db = client["flowtica"]
    collection = db["service_providers"]

    print("Clearing old provider data...")
    collection.delete_many({})

    print("Generating mock providers...")
    providers = generate_mock_providers()

    print("Generating embeddings for providers...")
    embeddings_model = OpenAIEmbeddings(openai_api_key=os.getenv("OPENAI_API_KEY"))
    
    for p in providers:
        # Combine relevant fields for semantic search
        text_to_embed = f"{p['name']} {p['service_type']} {p['specialization']} {p['description']} {p['location']} {' '.join(p['languages'])}"
        p["embedding"] = embeddings_model.embed_query(text_to_embed)
        
    print(f"Inserting {len(providers)} providers with embeddings...")
    collection.insert_many(providers)
    
    # Also update the 'providers' collection (legacy) just in case
    db["providers"].delete_many({})
    db["providers"].insert_many(providers)

    print("Seeding complete. Note: Please ensure a Vector Index named 'vector_index' is created in MongoDB Atlas on the 'service_providers' collection.")

if __name__ == "__main__":
    seed_database()
