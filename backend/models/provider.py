class ProviderModel:
    def __init__(self, db):
        self.db = db
        self.collection = db["provider_info"]

    def create_or_update_provider(self, supabase_id, name, main_service, email="", phone="", location="", avatar_url="", status="active"):
        """Creates or updates a provider's main info in the provider_info collection."""
        # Query users collection to sync missing details automatically
        user_doc = self.db["users"].find_one({"supabase_id": supabase_id})
        if user_doc:
            if not email:
                email = user_doc.get("email", "")
            if not phone:
                phone = user_doc.get("phone", "")
            if not location:
                location = user_doc.get("location", "")
            if not avatar_url:
                avatar_url = user_doc.get("avatar_url", "")

        profile_data = {
            "supabase_id": supabase_id,
            "name": name,
            "email": email,
            "phone": phone,
            "location_data": user_doc.get("location_data", {}) if user_doc else {},
            "avatar_url": avatar_url,
            "main_service": main_service,
            "status": status,
            "availability": True,
        }
        
        # Check if provider exists to not overwrite stats
        existing = self.collection.find_one({"supabase_id": supabase_id})
        if not existing:
            profile_data["rating"] = 5.0
            profile_data["completed_jobs"] = 0
            profile_data["total_hours_worked"] = 0
            profile_data["total_earnings"] = 0
        else:
            # Preserve existing ratings/jobs stats if updating
            profile_data["rating"] = existing.get("rating", 5.0)
            profile_data["completed_jobs"] = existing.get("completed_jobs", 0)
            profile_data["total_hours_worked"] = existing.get("total_hours_worked", 0)
            profile_data["total_earnings"] = existing.get("total_earnings", 0)
            
        self.collection.update_one(
            {"supabase_id": supabase_id},
            {"$set": profile_data},
            upsert=True
        )
        return profile_data

    def complete_job(self, supabase_id, new_rating, hours=0, earnings=0):
        """Updates provider stats after a completed job."""
        provider = self.collection.find_one({"supabase_id": supabase_id})
        if not provider: return False
        
        current_rating = provider.get("rating", 5.0)
        completed = provider.get("completed_jobs", 0)
        
        # Simple moving average approximation
        new_avg = ((current_rating * completed) + new_rating) / (completed + 1)
        
        self.collection.update_one(
            {"supabase_id": supabase_id},
            {
                "$set": {"rating": round(new_avg, 1)},
                "$inc": {
                    "completed_jobs": 1,
                    "total_hours_worked": float(hours),
                    "total_earnings": float(earnings)
                }
            }
        )
        return True

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
