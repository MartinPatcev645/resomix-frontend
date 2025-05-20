"""
Feedback Module
=============

This module provides functionality for handling user feedback and contact form submissions.
It connects to Google Sheets to store this data.

Functions:
- process_feedback: Processes user feedback submissions and saves to Google Sheets.
- process_contact: Processes contact form submissions and saves to Google Sheets.

Author: AI Assistant
Date: May 2023 (Updated for Google Sheets)
"""

from typing import Dict, Any
import json # Keep for potential local logging if desired
import os
from datetime import datetime
from dotenv import load_dotenv
import gspread_asyncio
from google.oauth2.service_account import Credentials

# Load environment variables
load_dotenv()

SERVICE_ACCOUNT_FILE = os.getenv("SERVICE_ACCOUNT_FILE")
GOOGLE_SHEET_ID = os.getenv("GOOGLE_SHEET_ID")
FEEDBACK_WORKSHEET_NAME = os.getenv("FEEDBACK_WORKSHEET_NAME", "Feedback") # Default to "Feedback"
CONTACT_WORKSHEET_NAME = os.getenv("CONTACT_WORKSHEET_NAME", "ContactSubmissions") # Default to "ContactSubmissions"

def get_google_creds():
    """Load Google credentials from the service account file."""
    if not SERVICE_ACCOUNT_FILE:
        print("ERROR: SERVICE_ACCOUNT_FILE environment variable not set.")
        return None
    try:
        creds = Credentials.from_service_account_file(
            SERVICE_ACCOUNT_FILE,
            scopes=[
                "https://spreadsheets.google.com/feeds",
                "https://www.googleapis.com/auth/drive.file", # Often needed for discovery/permissions
                "https://www.googleapis.com/auth/spreadsheets"
            ],
        )
        return creds
    except FileNotFoundError:
        print(f"ERROR: Service account file not found at {SERVICE_ACCOUNT_FILE}")
        return None
    except Exception as e:
        print(f"ERROR: Could not load credentials from service account file: {e}")
        return None

async def get_gspread_client():
    """Get an authenticated gspread_asyncio client."""
    creds = get_google_creds()
    if not creds:
        return None
    try:
        agc = await gspread_asyncio.AsyncioGspreadClientManager(lambda: creds).authorize()
        return agc
    except Exception as e:
        print(f"ERROR: Could not authorize gspread client: {e}")
        return None

async def append_to_sheet(worksheet_name: str, data_row: list):
    """Appends a row of data to the specified worksheet in the Google Sheet,
    inserting it into the next available row based on the first column."""
    if not GOOGLE_SHEET_ID:
        print("ERROR: GOOGLE_SHEET_ID environment variable not set.")
        return False

    agc = await get_gspread_client()
    if not agc:
        return False

    try:
        spreadsheet = await agc.open_by_key(GOOGLE_SHEET_ID)
        worksheet = await spreadsheet.worksheet(worksheet_name)
        
        # Get all values from the first column to determine the next empty row
        # This assumes your first column (e.g., Timestamp) is always filled for every data row.
        first_column_values = await worksheet.col_values(1) # col_values is 1-indexed
        next_row_index = len(first_column_values) + 1
        
        # Insert the new row at the calculated index.
        # Using value_input_option='USER_ENTERED' can help with formatting and type interpretation.
        await worksheet.insert_row(data_row, index=next_row_index, value_input_option='USER_ENTERED')
        
        print(f"Successfully inserted data into Google Sheet: '{worksheet_name}' at row {next_row_index}")
        return True
    except gspread_asyncio.gspread.exceptions.WorksheetNotFound:
        print(f"ERROR: Worksheet '{worksheet_name}' not found in Google Sheet ID {GOOGLE_SHEET_ID}. Please create it.")
        return False
    except Exception as e:
        print(f"ERROR: Failed to append data to Google Sheet '{worksheet_name}': {e}")
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
        raise Exception("Failed to save feedback to Google Sheet.") 


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
        raise Exception("Failed to save contact data to Google Sheet.")
