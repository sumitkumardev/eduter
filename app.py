from flask import Flask, jsonify
from pymongo import MongoClient
import os

app = Flask(__name__)

# Get MongoDB URI from environment variable
MONGO_URI = os.getenv("MONGO_URI")

# Connect to MongoDB
client = MongoClient(MONGO_URI)
db = client["newsque"]
collection = db["newsque_resource"]

@app.route("/api/resources")
def get_resources():
    try:
        resources = list(collection.find({}, {"_id": 0}))
        return jsonify(resources)
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": "Internal Server Error"}), 500

if __name__ == "__main__":
    app.run()
