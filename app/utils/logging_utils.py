"""
Logging Utilities
================

This module provides utilities for logging and monitoring.

Functions:
- log_request: Logs request details for debugging and monitoring.

Author: AI Assistant
Date: May 2023
"""

from typing import Dict, Any
from datetime import datetime


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