"""
Response Utilities
================

This module provides utilities for formatting API responses consistently.

Functions:
- format_response: Formats API responses in a consistent structure.

Author: AI Assistant
Date: May 2023
"""

from typing import Dict, Any, Optional


def format_response(success: bool, data: Optional[Any] = None, error: Optional[str] = None) -> Dict[str, Any]:
    """
    Format API responses in a consistent structure.
    
    Args:
        success: Whether the operation was successful
        data: The data to include in the response (for successful operations)
        error: Error message (for failed operations)
        
    Returns:
        Formatted response dictionary
    """
    response = {"success": success}
    
    if success and data is not None:
        response["data"] = data
    elif not success and error is not None:
        response["error"] = error
    
    return response 