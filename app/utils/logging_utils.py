"""
Logging Utilities
=================

This module provides utilities for request logging and system monitoring
throughout the ResomiX application. It handles request tracking, parameter logging,
and debugging information for API endpoints.

Centralizes logging functionality to provide consistent monitoring capabilities
and debugging support across all application components.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
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