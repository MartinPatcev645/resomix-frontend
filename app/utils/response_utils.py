"""
Response Utilities
==================

This module provides utilities for formatting API responses consistently across
the ResomiX application. It ensures standardized response structures for both
successful and error responses throughout all API endpoints.

Centralizes response formatting logic to maintain consistency and enable
easy modifications to response structure across the entire application.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
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