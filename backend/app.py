from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from dotenv import load_dotenv
import os

load_dotenv()

app = Flask(__name__)

CORS(app)

mongo_uri = os.getenv("MONGODB_URI")

client = MongoClient(mongo_uri)

db = client["flowtica"]

users_collection = db["users"]


@app.route("/create-user", methods=["POST"])
def create_user():
    try:
        data = request.json

        supabase_id = data.get("supabase_id")
        email = data.get("email")
        user_type = data.get("user_type")
        name = data.get("name")
        picture = data.get("picture")

        if not supabase_id:
            return jsonify({
                "error": "supabase_id required"
            }), 400

        existing_user = users_collection.find_one({
            "supabase_id": supabase_id
        })

        if existing_user:
            return jsonify({
                "success": True,
                "message": "User already exists"
            })

        result = users_collection.insert_one({
    "supabase_id":
    supabase_id,

    "email":
    email,

    "name":
    name,

    "picture":
    picture,

    "user_type":
    user_type,
})

        return jsonify({
            "success": True,
            "inserted_id": str(result.inserted_id)
        })

    except Exception as e:
        return jsonify({
            "error": str(e)
        }), 500

@app.route(
    "/user/<supabase_id>",
    methods=["GET"]
)
def get_user(supabase_id):
    try:
        user = users_collection.find_one({
            "supabase_id":
            supabase_id
        })

        if not user:
            return jsonify({
                "user": None
            })

        user["_id"] = str(
            user["_id"]
        )

        return jsonify({
            "user": user
        })

    except Exception as e:
        return jsonify({
            "error": str(e)
        }), 500

@app.route("/update-user", methods=["PUT"])
def update_user():
    try:
        data = request.json
        supabase_id = data.get("supabase_id")
        user_type = data.get("user_type")

        if not supabase_id or not user_type:
            return jsonify({"error": "supabase_id and user_type required"}), 400

        result = users_collection.update_one(
            {"supabase_id": supabase_id},
            {"$set": {"user_type": user_type}}
        )

        if result.modified_count == 0:
            return jsonify({"success": False, "message": "User not found or no changes made"})

        return jsonify({"success": True})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True
    )