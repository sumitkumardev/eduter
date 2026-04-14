from flask import Flask, render_template, jsonify, request, make_response
from pymongo import MongoClient
import os

app = Flask(__name__)

# Get MongoDB URI from environment variable

MONGO_URI = os.getenv("MONGO_URI")

# Connect to MongoDB
client = MongoClient(MONGO_URI)
db = client["newsque"]
collectionN = db["proinput"]
collectionM = db["trending_IN"]

@app.route('/')
def index():
    return render_template('index.html')
# newsfeed endpoint for news articles homepage
# Upcoming endpoints:
# /v1/updates
# /v1/headlines
# /v1/bulletins
# /v1/stories

# /v1/new feeds
# @app.route('/v1/newsfeed')
# def get_articles():
#     try:
#         offset = int(request.args.get('offset', 0))
#         limit = int(request.args.get('limit', 3))
#         resources = list(collectionN.find({}, {"_id": 0}).sort("created_date", -1)[offset:offset+limit])
#         return jsonify(resources)
#     except Exception as e:
#         print(f"Error: {e}")
#         return jsonify({"error": "Internal Server Error"}), 500

# v2 news feed
@app.route('/v1/newsfeed')
def get_articles():
    try:
        offset = int(request.args.get('offset', 0))
        limit = int(request.args.get('limit', 3))
        resources = list(
            collectionN.find({}, {"_id": 0})
            .sort("published_at", -1)
            .skip(offset)
            .limit(limit)
        )
        total = collectionN.count_documents({})
        has_more = (offset + limit) < total
        resp = make_response(jsonify({"articles": resources, "has_more": has_more}))
        resp.headers['Cache-Control'] = 'public, max-age=60'
        return resp
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": "Internal Server Error"}), 500


# /v1/movie feed

# @app.route('/v1/moviesfeed')
# def get_movies():
#     try:
#         offset = int(request.args.get('offset', 0))
#         limit = int(request.args.get('limit', 3))
#         resources = list(collectionM.find({}, {"_id": 0}).sort("created_date", -1)[offset:offset+limit])
#         return jsonify(resources)
#     except Exception as e:
#         print(f"Error: {e}")
#         return jsonify({"error": "Internal Server Error"}), 500

# v2 movies feed

@app.route('/v1/moviesfeed')
def get_movies():
    try:
        offset = int(request.args.get('offset', 0))
        limit = int(request.args.get('limit', 3))
        resources = list(
            collectionM.find({}, {"_id": 0})
            .sort("release_date", -1)
            .skip(offset)
            .limit(limit)
        )
        total = collectionM.count_documents({})
        has_more = (offset + limit) < total
        resp = make_response(jsonify({"movies": resources, "has_more": has_more}))
        resp.headers['Cache-Control'] = 'public, max-age=60'
        return resp
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": "Internal Server Error"}), 500



if __name__ == '__main__':
    app.run(debug=True)
