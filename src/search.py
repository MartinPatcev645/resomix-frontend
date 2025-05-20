"""
Search Module
===========

This module provides functionality for searching tracks by name, artist, or other criteria.
It connects to a MongoDB database to perform these searches.

Functions:
- search_tracks: Searches for tracks based on a query string (filename).

Author: AI Assistant
Date: May 2023
"""

import os
import re
from typing import Dict, List, Any
from dotenv import load_dotenv
import motor.motor_asyncio

# Load environment variables (especially MONGODB_URI)
# This ensures that if this module is imported before main.py loads dotenv, it still gets the URI.
# However, it's generally good practice to load_dotenv() once at the application entry point (e.g., main.py).
# If main.py already calls load_dotenv(), this call here might be redundant but harmless.
load_dotenv() 

MONGODB_URI = os.getenv("MONGODB_URI")
DB_NAME = "Data" # As per your example
COLLECTION_NAME = "Tracks" # As per your example

if not MONGODB_URI:
    print("CRITICAL: MONGODB_URI environment variable not set. Search functionality will not work.")
    # You might want to raise an exception here or handle it more gracefully
    # depending on whether the app can run without DB access.
    client = None
    db = None
    collection = None
else:
    try:
        client = motor.motor_asyncio.AsyncIOMotorClient(MONGODB_URI)
        db = client[DB_NAME]
        collection = db[COLLECTION_NAME]
        print(f"Successfully connected to MongoDB: {DB_NAME}.{COLLECTION_NAME}")
    except Exception as e:
        print(f"CRITICAL: Failed to connect to MongoDB at {MONGODB_URI}. Error: {e}")
        client = None
        db = None
        collection = None

async def search_tracks(query: str) -> Dict[str, Any]:
    """
    Search for tracks in MongoDB based on the filename query string.
    
    Args:
        query: The search term/query string to match against filenames.
        
    Returns:
        Dict containing a list of tracks matching the search criteria.
        Returns an empty list if the database connection failed or no tracks are found.
    """
    if collection is None:
        print("Search_tracks: MongoDB collection is not available.")
        return {"tracks": []} # Return empty if DB connection failed

    print(f"MongoDB: Searching for tracks with filename containing: {query}")
    
    # Using a case-insensitive regex search for the filename
    # The 'i' option makes it case-insensitive
    # We escape the query to ensure any special regex characters in the query string are treated literally
    escaped_query = re.escape(query)
    mongo_query = {
        "file.filename": {"$regex": escaped_query, "$options": "i"}
    }
    
    results = []
    try:
        # Limit results to, for example, 20 tracks
        cursor = collection.find(mongo_query).limit(20)
        async for doc in cursor:
            # Transform document to the expected frontend structure
            # Ensure info.length is converted to an integer
            duration = 0
            if doc.get("info") and doc["info"].get("length"):
                try:
                    duration = int(doc["info"]["length"])
                except ValueError:
                    print(f"Warning: Could not convert length to int for track {doc.get('_id')}")
                    duration = 0 # Default or skip
            
            # Fields like artist, bpm, imageUrl are missing from the provided document structure
            # and will be omitted from the response.
            # If you have them, you would map them here.
            track_data = {
                "id": str(doc.get("_id")), # Convert ObjectId to string
                "title": doc.get("info", {}).get("title", "N/A"),
                "artist": doc.get("info", {}).get("artist", "N/A"), # Assuming artist might be in info
                "duration": duration,
                "genre": doc.get("info", {}).get("genre", "N/A"),
                "bpm": doc.get("info", {}).get("bpm", 0), # Assuming bpm might be in info
                "imageUrl": doc.get("info", {}).get("imageUrl", "") # Assuming imageUrl might be in info
            }
            results.append(track_data)
            
        print(f"MongoDB: Found {len(results)} tracks for query: '{query}'")
        
    except Exception as e:
        print(f"Error during MongoDB search: {e}")
        # Depending on the error, you might want to return a specific error message
        # For now, returning empty list on error after initial connection check.
        return {"tracks": []}
        
    return {"tracks": results}


# Optional: You might want to add a function to create indexes if they don't exist.
# This is usually done once, either manually or programmatically.
async def create_search_indexes():
    if collection is None:
        print("Create_search_indexes: MongoDB collection is not available.")
        return
    try:
        # Index for filename searches (ascending text index recommended for regex on string fields)
        await collection.create_index([("file.filename", "text")], name="filename_text_index")
        print("Successfully created/ensured 'filename_text_index' on Tracks collection.")
        
        # Alternatively, for prefix regex searches or exact matches, a standard index can be useful:
        # await collection.create_index([("file.filename", 1)], name="filename_ascending_index")
        # print("Successfully created/ensured 'filename_ascending_index' on Tracks collection.")

    except Exception as e:
        print(f"Error creating indexes: {e}")

# Example of how you might call it (e.g., during app startup, but be careful with async context)
# if __name__ == "__main__":
# import asyncio
#     asyncio.run(create_search_indexes())
