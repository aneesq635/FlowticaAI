from datetime import datetime, timezone


class UserModel:
    def __init__(self, db):
        self.users = db["users"]
        self.provider_info = db["provider_info"]

    def get_or_create_user(self, supabase_id: str, data: dict) -> dict:
        """
        Fetches an existing user by supabase_id or creates a new one.
        Returns the user document (with _id serialized to string).
        """
        existing = self.users.find_one({"supabase_id": supabase_id})
        if existing:
            existing["_id"] = str(existing["_id"])
            return existing

        # Build the new user document from Supabase payload
        new_user = {
            "supabase_id": supabase_id,
            "email": data.get("email", ""),
            "phone": data.get("phone", ""),
            "location": data.get("location", ""),
            "location_data": data.get("location_data", {}),
            "location_permission_status": data.get("location_permission_status", "not_requested"),
            "name": data.get("name") or data.get("user_metadata", {}).get("full_name", ""),
            "avatar_url": data.get("avatar_url") or data.get("user_metadata", {}).get("avatar_url", ""),
            "user_type": data.get("user_type", "buyer"),
            "provider": data.get("app_metadata", {}).get("provider", "email"),
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }

        result = self.users.insert_one(new_user)
        new_user["_id"] = str(result.inserted_id)
        return new_user
        
    def update_user(self, supabase_id: str, data: dict) -> dict:
        """
        Updates an existing user.
        """
        update_data = {k: v for k, v in data.items() if k not in ["_id", "supabase_id", "created_at"]}
        update_data["updated_at"] = datetime.now(timezone.utc)
        
        updated = self.users.find_one_and_update(
            {"supabase_id": supabase_id},
            {"$set": update_data},
            return_document=True
        )
        if updated:
            updated["_id"] = str(updated["_id"])
            
            # Sync update to provider_info if this user has a provider profile
            provider_exists = self.provider_info.find_one({"supabase_id": supabase_id})
            if provider_exists:
                provider_update = {}
                if "name" in update_data:
                    provider_update["name"] = update_data["name"]
                if "email" in update_data:
                    provider_update["email"] = update_data["email"]
                if "phone" in update_data:
                    provider_update["phone"] = update_data["phone"]
                if "location" in update_data:
                    provider_update["location"] = update_data["location"]
                if "location_data" in update_data:
                    provider_update["location_data"] = update_data["location_data"]
                if "avatar_url" in update_data:
                    provider_update["avatar_url"] = update_data["avatar_url"]
                
                if provider_update:
                    self.provider_info.update_one(
                        {"supabase_id": supabase_id},
                        {"$set": provider_update}
                    )
        return updated
