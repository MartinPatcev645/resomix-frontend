"""
Feedback Module
=============

This module provides functionality for handling user feedback and contact form submissions.

Functions:
- process_feedback: Processes user feedback submissions.
- process_contact: Processes contact form submissions.

Author: AI Assistant
Date: May 2023
"""

from typing import Dict, Any
import json
import os
from datetime import datetime


async def process_feedback(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Process and store user feedback.
    
    In a production environment, this would:
    1. Validate the feedback data
    2. Store in a database
    3. Potentially send notifications to administrators
    
    Args:
        data: Dictionary containing feedback data (satisfaction, recommendation, feedback text)
        
    Returns:
        Dict with success message
    """
    # Validate required fields
    required_fields = ["satisfaction", "recommendation"]
    for field in required_fields:
        if field not in data or not isinstance(data[field], (int, float)):
            raise ValueError(f"Missing or invalid required field: {field}")
    
    # Ensure ratings are within expected range (1-10)
    if not (1 <= data["satisfaction"] <= 10 and 1 <= data["recommendation"] <= 10):
        raise ValueError("Ratings must be between 1 and 10")
    
    # In a production environment, you would store this in a database
    # For demo purposes, we'll log it to the console and store in a simple file
    print(f"Received feedback - Satisfaction: {data['satisfaction']}, Recommendation: {data['recommendation']}")
    
    # Optional: store feedback in a file
    feedback_dir = "feedback_data"
    if not os.path.exists(feedback_dir):
        os.makedirs(feedback_dir)
        
    # Generate a timestamp-based filename
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = os.path.join(feedback_dir, f"feedback_{timestamp}.json")
    
    # Add timestamp to the data
    data["timestamp"] = datetime.now().isoformat()
    data["type"] = "feedback"
    
    # Write to file
    with open(filename, "w") as f:
        json.dump(data, f, indent=2)
    
    return {
        "message": "Feedback received successfully"
    }


async def process_contact(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Process and store contact form submissions.
    
    In a production environment, this would:
    1. Validate the contact form data
    2. Store in a database
    3. Potentially send email notifications
    
    Args:
        data: Dictionary containing contact form data (name, email, subject, message)
        
    Returns:
        Dict with success message
    """
    # Validate required fields
    required_fields = ["name", "email", "message"]
    for field in required_fields:
        if field not in data or not data[field]:
            raise ValueError(f"Missing required field: {field}")
    
    # Basic email validation
    if "@" not in data["email"] or "." not in data["email"]:
        raise ValueError("Invalid email format")
    
    # In a production environment, you would store this in a database and/or send an email
    # For demo purposes, we'll log it to the console and store in a simple file
    print(f"Received contact form from: {data['name']} ({data['email']})")
    
    # Optional: store contact form in a file
    feedback_dir = "feedback_data"
    if not os.path.exists(feedback_dir):
        os.makedirs(feedback_dir)
        
    # Generate a timestamp-based filename
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = os.path.join(feedback_dir, f"contact_{timestamp}.json")
    
    # Add timestamp to the data
    data["timestamp"] = datetime.now().isoformat()
    data["type"] = "contact"
    
    # Write to file
    with open(filename, "w") as f:
        json.dump(data, f, indent=2)
    
    return {
        "message": "Contact form submitted successfully"
    } 