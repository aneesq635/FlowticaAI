class ProviderModel:
    def __init__(self, db):
        self.db = db
        self.collection = db["provider_info"]

    def create_or_update_provider(self, supabase_id, name, main_service, status="active"):
        """Creates or updates a provider's main info in the provider_info collection."""
        profile_data = {
            "supabase_id": supabase_id,
            "name": name,
            "main_service": main_service,
            "status": status,
            "rating": 5.0,
            "availability": True,
        }
        self.collection.update_one(
            {"supabase_id": supabase_id},
            {"$set": profile_data},
            upsert=True
        )
        return profile_data

    def get_provider_by_supabase_id(self, supabase_id):
        """Fetches provider main profile by supabase ID."""
        profile = self.collection.find_one({"supabase_id": supabase_id})
        if profile:
            profile["_id"] = str(profile["_id"])
        return profile
        
    def update_availability(self, supabase_id, availability):
        """Updates a provider's availability status."""
        self.collection.update_one(
            {"supabase_id": supabase_id},
            {"$set": {"availability": availability}}
        )
        return True
