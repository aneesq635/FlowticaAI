from datetime import datetime
from typing import Dict, Any

class BookingModel:
    @staticmethod
    def create_booking_doc(user_id: str, provider: Dict[str, Any], service_details: Dict[str, Any]):
        """
        Creates a structured booking document for MongoDB.
        """
        return {
            "customer_id": user_id,
            "provider_id": provider.get("id"),
            "provider_name": provider.get("name"),
            "service_category": provider.get("category"),
            "location": service_details.get("location"), # Original backward compatibility field
            "location_data": service_details.get("location_data") or provider.get("location_data"), # Structured snapshot
            "provider_location_data": provider.get("location_data"), # Provider's snapshot
            "customer_location_data": service_details.get("customer_location_data") or service_details.get("location_data"),
            "status": "confirmed",
            "price": service_details.get("price"),
            "scheduled_time": service_details.get("scheduled_time"),
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "details": service_details
        }
