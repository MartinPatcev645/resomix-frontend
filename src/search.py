"""
Search Module
===========

This module provides functionality for searching tracks by name, artist, or other criteria.
It connects to a MongoDB database to perform these searches.

Functions:
- search_tracks: Searches for tracks based on a query string.
- initialize_mongodb_client: Initializes the MongoDB client.
- close_mongodb_client: Closes the MongoDB client connection.
- get_db_collection: Returns the MongoDB collection instance.

Author: AI Assistant
Date: May 2023 (Updated for refined search fields and client lifecycle management)
"""

import os
import re
from typing import Dict, Any, Optional
from dotenv import load_dotenv
import motor.motor_asyncio
import asyncio # For lock

# Load environment variables (especially MONGODB_URI)
# This ensures that if this module is imported before main.py loads dotenv, it still gets the URI.
# However, it's generally good practice to load_dotenv() once at the application entry point (e.g., main.py).
# If main.py already calls load_dotenv(), this call here might be redundant but harmless.
load_dotenv() 

MONGODB_URI = os.getenv("MONGODB_URI")
DB_NAME = "Data" # As per your example
COLLECTION_NAME = "Tracks" # As per your example

# Global variables for MongoDB client and collection
_mongo_client: Optional[motor.motor_asyncio.AsyncIOMotorClient] = None
_db_collection: Optional[motor.motor_asyncio.AsyncIOMotorCollection] = None
_mongo_lock = asyncio.Lock() # To prevent race conditions during client initialization

async def initialize_mongodb_client():
    """Initializes the MongoDB client and database collection.
       Should be called at application startup.
    """
    global _mongo_client
    global _db_collection

    if not MONGODB_URI:
        print("CRITICAL: MONGODB_URI environment variable not set. MongoDB client cannot be initialized.")
        return

    async with _mongo_lock:
        if _mongo_client is None:
            try:
                print(f"Initializing MongoDB client")
                _mongo_client = motor.motor_asyncio.AsyncIOMotorClient(MONGODB_URI)
                # You can add server selection timeout or other client options here if needed
                # Example: _mongo_client = motor.motor_asyncio.AsyncIOMotorClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
                
                # Perform a simple operation to confirm connection (optional but good for startup check)
                await _mongo_client.admin.command('ping') 
                print("MongoDB client ping successful.")
                
                db = _mongo_client[DB_NAME]
                _db_collection = db[COLLECTION_NAME]
                print(f"MongoDB client initialized successfully. Using DB: {DB_NAME}, Collection: {COLLECTION_NAME}")
                await create_search_indexes() # Create indexes after successful connection
            except Exception as e:
                print(f"CRITICAL: Failed to connect/initialize MongoDB at {MONGODB_URI}. Error: {e}")
                _mongo_client = None
                _db_collection = None
        else:
            print("MongoDB client already initialized.")

async def close_mongodb_client():
    """Closes the MongoDB client connection. Should be called at application shutdown."""
    global _mongo_client
    global _db_collection
    async with _mongo_lock:
        if _mongo_client is not None:
            print("Closing MongoDB client connection...")
            _mongo_client.close()
            _mongo_client = None
            _db_collection = None
            print("MongoDB client connection closed.")

async def get_db_collection() -> Optional[motor.motor_asyncio.AsyncIOMotorCollection]:
    """Returns the MongoDB collection, attempting to initialize if not available."""
    global _db_collection
    if _db_collection is None:
        print("MongoDB collection not available, attempting to re-initialize client...")
        await initialize_mongodb_client() # Attempt to re-initialize
    return _db_collection

async def search_tracks(query: str) -> Dict[str, Any]:
    collection = await get_db_collection()
    if collection is None:
        print("Search_tracks: MongoDB collection is not available after attempting init.")
        return {"tracks": []}

    print(f"MongoDB: Searching for tracks with query: {query}")
    escaped_query = re.escape(query)
    mongo_query = {
        "$or": [
            {"file.filename": {"$regex": escaped_query, "$options": "i"}},
            {"info.title": {"$regex": escaped_query, "$options": "i"}},
            {"info.artist": {"$regex": escaped_query, "$options": "i"}} # Added artist to search fields
        ]
    }
    
    results = []
    try:
        cursor = collection.find(mongo_query).limit(20)
        async for doc in cursor:
            duration = 0
            if doc.get("info") and doc["info"].get("length"):
                try:
                    duration = int(float(doc["info"]["length"])) 
                except (ValueError, TypeError):
                    duration = 0
            
            track_path = doc.get("file", {}).get("path") 
            if not track_path:
                 track_path = doc.get("file", {}).get("filename", "N/A")

            track_data = {
                "id": str(doc.get("_id")),
                "artist": doc.get("info", {}).get("artist", "N/A"),
                "duration": duration,
                "path": track_path 
            }
            results.append(track_data)
    except motor.motor_asyncio.core.ServerSelectionTimeoutError as e: # Specific error for connection issues
        print(f"MongoDB Server Selection Timeout during search: {e}. Resetting client for next attempt.")
        global _mongo_client
        async with _mongo_lock:
             if _mongo_client is not None: # Check before closing if it was reset by another coroutine
                 _mongo_client.close() # Explicitly close before resetting
             _mongo_client = None
             _db_collection = None # Also reset collection
        return {"tracks": []}
    except Exception as e:
        print(f"Error during MongoDB search: {e}")
        return {"tracks": []}
        
    return {"tracks": results}

async def create_search_indexes():
    """Creates necessary text indexes on the collection."""
    # This function now uses get_db_collection to ensure client is initialized.
    collection_to_index = await get_db_collection()
    if collection_to_index is None:
        print("Create_search_indexes: MongoDB collection is not available. Cannot create indexes.")
        return
    try:
        # Updated index to include artist
        index_model = [("file.filename", "text"), ("info.title", "text"), ("info.artist", "text")]
        await collection_to_index.create_index(index_model, name="filename_title_artist_text_index")
        print("Successfully created/ensured 'filename_title_artist_text_index' on Tracks collection.")
    except Exception as e:
        print(f"Error creating indexes: {e}")

# Example of how you might call it (e.g., during app startup, but be careful with async context)
# if __name__ == "__main__":
# import asyncio
#     asyncio.run(create_search_indexes())
