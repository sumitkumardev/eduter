from flask import Flask, render_template, jsonify, request  # Added render_template
from pymongo import MongoClient
import os

app = Flask(__name__)

# Get MongoDB URI from environment variable
MONGO_URI = os.getenv("MONGO_URI")

# Connect to MongoDB
client = MongoClient(MONGO_URI)
db = client["newsque"]
collection = db["newsque_resource"]

@app.route('/')
def index():
    return render_template('index.html')
# newsfeed endpoint for news articles homepage
# Upcoming endpoints:
# /v1/updates
# /v1/headlines
# /v1/bulletins
# /v1/stories
@app.route('/v1/newsfeed')
def get_articles():
    try:
        offset = int(request.args.get('offset', 0))
        limit = int(request.args.get('limit', 3))
        resources = list(collection.find({}, {"_id": 0}).sort("created_date", -1)[offset:offset+limit])
        return jsonify(resources)
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": "Internal Server Error"}), 500

if __name__ == '__main__':
    app.run(debug=True)
