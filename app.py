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
    resources = list(collection.find({}, {"_id": 0}))  # Don't return _id
    return jsonify(resources)

if __name__ == "__main__":
    app.run()
