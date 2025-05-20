"""
Feedback Module
=============

This module provides functionality for handling user feedback and contact form submissions.
It connects to Google Sheets to store this data.

Functions:
- process_feedback: Processes user feedback submissions and saves to Google Sheets.
- process_contact: Processes contact form submissions and saves to Google Sheets.
- initialize_gspread_client_on_startup: Initializes the gspread client.

Author: AI Assistant
Date: May 2023 (Updated for Google Sheets and client optimization)
"""

from typing import Dict, Any, Optional
import json # Keep for potential local logging if desired
import os
from datetime import datetime
from dotenv import load_dotenv
import gspread_asyncio
from google.oauth2.service_account import Credentials
import asyncio # For lock

# Load environment variables
load_dotenv()

SERVICE_ACCOUNT_FILE = os.getenv("SERVICE_ACCOUNT_FILE")
GOOGLE_SHEET_ID = os.getenv("GOOGLE_SHEET_ID")
FEEDBACK_WORKSHEET_NAME = os.getenv("FEEDBACK_WORKSHEET_NAME", "Feedback") # Default to "Feedback"
CONTACT_WORKSHEET_NAME = os.getenv("CONTACT_WORKSHEET_NAME", "ContactSubmissions") # Default to "ContactSubmissions"

# Global variables for the gspread client and credentials
_gspread_creds: Optional[Credentials] = None
_agc_client: Optional[gspread_asyncio.AsyncioGspreadClient] = None
_client_lock = asyncio.Lock() # To prevent race conditions during client initialization

def _load_google_creds() -> Optional[Credentials]:
    """Loads Google credentials from the service account file. Not meant to be called directly often."""
    global _gspread_creds
    if _gspread_creds:
        return _gspread_creds

    if not SERVICE_ACCOUNT_FILE:
        print("ERROR: SERVICE_ACCOUNT_FILE environment variable not set.")
        return None
    try:
        creds = Credentials.from_service_account_file(
            SERVICE_ACCOUNT_FILE,
            scopes=[
                "https://spreadsheets.google.com/feeds",
                "https://www.googleapis.com/auth/drive.file",
                "https://www.googleapis.com/auth/spreadsheets"
            ],
        )
        _gspread_creds = creds
        print("Google credentials loaded successfully.")
        return creds
    except FileNotFoundError:
        print(f"ERROR: Service account file not found at {SERVICE_ACCOUNT_FILE}")
        return None
    except Exception as e:
        print(f"ERROR: Could not load credentials from service account file: {e}")
        return None

async def _get_or_init_gspread_client() -> Optional[gspread_asyncio.AsyncioGspreadClient]:
    """Get the existing gspread client or initialize it if not available or if forced."""
    global _agc_client
    global _gspread_creds

    async with _client_lock: # Ensure only one coroutine tries to initialize at a time
        if _agc_client:
            return _agc_client

        if not _gspread_creds:
            _load_google_creds() # Attempt to load them if not already loaded
        
        if not _gspread_creds:
            print("ERROR: Google credentials not available for gspread client initialization.")
            return None
        
        try:
            print("Attempting to authorize gspread client...")
            # The manager is a factory for clients. We get a client from it.
            manager = gspread_asyncio.AsyncioGspreadClientManager(lambda: _gspread_creds)
            authorized_client = await manager.authorize()
            _agc_client = authorized_client
            print("gspread client authorized successfully.")
            return _agc_client
        except Exception as e:
            print(f"ERROR: Could not authorize gspread client: {e}")
            _agc_client = None # Ensure client is None if authorization fails
            return None

async def initialize_gspread_client_on_startup():
    """To be called at application startup to pre-authorize the client."""
    print("Initializing Google Sheets client on startup...")
    client = await _get_or_init_gspread_client()
    if client:
        print("Google Sheets client pre-initialized successfully.")
    else:
        print("Failed to pre-initialize Google Sheets client on startup.")

async def append_to_sheet(worksheet_name: str, data_row: list) -> bool:
    global _agc_client # To allow setting it to None on failure
    if not GOOGLE_SHEET_ID:
        print("ERROR: GOOGLE_SHEET_ID environment variable not set.")
        return False

    client = await _get_or_init_gspread_client()
    if not client:
        print("ERROR: gspread client not available for append_to_sheet.")
        return False

    try:
        spreadsheet = await client.open_by_key(GOOGLE_SHEET_ID)
        worksheet = await spreadsheet.worksheet(worksheet_name)
        
        first_column_values = await worksheet.col_values(1)
        next_row_index = len(first_column_values) + 1
        
        await worksheet.insert_row(data_row, index=next_row_index, value_input_option='USER_ENTERED')
        
        print(f"Successfully inserted data into Google Sheet: '{worksheet_name}' at row {next_row_index}")
        return True
    except gspread_asyncio.gspread.exceptions.APIError as api_e:
        print(f"ERROR: Google API Error while appending to sheet '{worksheet_name}': {api_e}. Attempting re-auth on next call.")
        async with _client_lock:
            _agc_client = None # Force re-authorization on next call
        return False
    except Exception as e:
        print(f"ERROR: Failed to append data to Google Sheet '{worksheet_name}': {e}. Attempting re-auth on next call if client related.")
        # More broadly, reset client if any exception occurs, as it might be connection related
        async with _client_lock:
            _agc_client = None # Force re-authorization on next call
        return False

async def process_feedback(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Process and store user feedback to Google Sheets.
    """
    # Validate required fields
    required_fields = ["satisfaction", "recommendation"]
    for field in required_fields:
        if field not in data or not isinstance(data[field], (int, float)):
            raise ValueError(f"Missing or invalid required field: {field}")
    
    if not (1 <= data["satisfaction"] <= 10 and 1 <= data["recommendation"] <= 10):
        raise ValueError("Ratings must be between 1 and 10")
    
    print(f"Received feedback - Satisfaction: {data['satisfaction']}, Recommendation: {data['recommendation']}")

    # Prepare data for Google Sheet row
    # Ensure headers in your sheet: Timestamp, Satisfaction, Recommendation, Feedback
    timestamp_str = datetime.now().isoformat()
    feedback_row = [
        timestamp_str,
        data["satisfaction"],
        data["recommendation"],
        data.get("feedback", "") # Use .get for optional feedback text
    ]

    success = await append_to_sheet(FEEDBACK_WORKSHEET_NAME, feedback_row)

    # Optional: local file saving (commented out)
    # feedback_dir = "feedback_data"
    # if not os.path.exists(feedback_dir):
    #     os.makedirs(feedback_dir)
    # timestamp_file_part = datetime.now().strftime("%Y%m%d_%H%M%S")
    # filename = os.path.join(feedback_dir, f"feedback_{timestamp_file_part}.json")
    # data["timestamp"] = timestamp_str
    # data["type"] = "feedback"
    # with open(filename, "w") as f:
    #     json.dump(data, f, indent=2)

    if success:
        return {"message": "Feedback received successfully and saved to Google Sheet."}
    else:
        # If saving to sheet fails, you could optionally save locally as a fallback
        # For now, we raise an error that will be caught by main.py
        raise Exception("Failed to save feedback to Google Sheet after attempting client management.") 


async def process_contact(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Process and store contact form submissions to Google Sheets.
    """
    # Validate required fields
    required_fields = ["name", "email", "message"]
    for field in required_fields:
        if field not in data or not data[field]:
            raise ValueError(f"Missing required field: {field}")
    
    if "@" not in data["email"] or "." not in data["email"]:
        raise ValueError("Invalid email format")
    
    print(f"Received contact form from: {data['name']} ({data['email']})")

    # Prepare data for Google Sheet row
    # Ensure headers in your sheet: Timestamp, Name, Email, Subject, Message
    timestamp_str = datetime.now().isoformat()
    contact_row = [
        timestamp_str,
        data["name"],
        data["email"],
        data.get("subject", ""), # Use .get for optional subject
        data["message"]
    ]

    success = await append_to_sheet(CONTACT_WORKSHEET_NAME, contact_row)

    # Optional: local file saving (commented out)
    # feedback_dir = "feedback_data"
    # if not os.path.exists(feedback_dir):
    #     os.makedirs(feedback_dir)
    # timestamp_file_part = datetime.now().strftime("%Y%m%d_%H%M%S")
    # filename = os.path.join(feedback_dir, f"contact_{timestamp_file_part}.json")
    # data["timestamp"] = timestamp_str
    # data["type"] = "contact"
    # with open(filename, "w") as f:
    #     json.dump(data, f, indent=2)

    if success:
        return {"message": "Contact form submitted successfully and saved to Google Sheet."}
    else:
        raise Exception("Failed to save contact data to Google Sheet after attempting client management.")
