"""
Utilities Module
==============

This module provides general utility functions that can be used across different parts of the application.

Functions:
- format_response: Formats API responses in a consistent structure.
- sanitize_filename: Sanitizes filenames to prevent security issues.
- log_request: Logs request details for debugging and monitoring.

Author: AI Assistant
Date: May 2023
"""

from typing import Dict, Any, Optional
import os
import re
from datetime import datetime


def format_response(success: bool, data: Optional[Any] = None, error: Optional[str] = None, details: Optional[Any] = None) -> Dict[str, Any]:
    """
    Format API responses in a consistent structure.
    
    Args:
        success: Whether the operation was successful
        data: The data to include in the response (for successful operations)
        error: Error message (for failed operations)
        details: Additional error details (for validation errors)
        
    Returns:
        Formatted response dictionary
    """
    response = {"success": success}
    
    if success and data is not None:
        response["data"] = data
    elif not success:
        if error is not None:
            response["error"] = error
        if details is not None:
            response["details"] = details
    
    return response


def sanitize_filename(filename: str) -> str:
    """
    Sanitize a filename to prevent directory traversal and other security issues.
    
    Args:
        filename: The original filename
        
    Returns:
        Sanitized filename
    """
    # Remove path components (keeps only the basename)
    sanitized = os.path.basename(filename)
    
    # Replace problematic characters
    sanitized = re.sub(r'[^\w\s.-]', '_', sanitized)
    
    # Ensure it's not empty
    if not sanitized or sanitized.startswith('.'):
        sanitized = f"file_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    return sanitized


def log_request(endpoint: str, method: str, params: Dict[str, Any] = None) -> None:
    """
    Log request details for debugging and monitoring.
    
    Args:
        endpoint: The API endpoint
        method: The HTTP method (GET, POST, etc.)
        params: Request parameters (excluding sensitive data)
    """
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    params_str = str(params) if params else "None"
    
    # In a production environment, you might use a proper logging library
    print(f"[{timestamp}] {method} {endpoint} - Params: {params_str}")
