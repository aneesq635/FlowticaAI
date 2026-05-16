from datetime import datetime, timezone


class UserModel:
    def __init__(self, db):
        self.users = db["users"]

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
            "name": data.get("name") or data.get("user_metadata", {}).get("full_name", ""),
            "avatar_url": data.get("avatar_url") or data.get("user_metadata", {}).get("avatar_url", ""),
            "user_type": data.get("user_type", "client"),
            "provider": data.get("app_metadata", {}).get("provider", "email"),
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }

        result = self.users.insert_one(new_user)
        new_user["_id"] = str(result.inserted_id)
        return new_user
