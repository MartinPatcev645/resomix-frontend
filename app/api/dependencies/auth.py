"""
Authentication Dependencies
===========================

This module provides FastAPI dependency functions for API key authentication.
It handles API key validation from query parameters and ensures secure access
to protected endpoints throughout the ResomiX application.

Centralizes authentication logic to provide consistent security validation
across all API endpoints requiring authentication.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

# API key authentication dependencies 
from fastapi import HTTPException, Security
from fastapi.security.api_key import APIKeyQuery
from starlette.status import HTTP_403_FORBIDDEN
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
API_KEY_NAME = "api_key"
API_KEY = "bearer-resomix-api-V2BjX95N3MwxtCNQ83jWQmkqTtwJzJ"  # In production, this should be stored securely

# Set up API key security - using query parameter as specified in frontend
api_key_query = APIKeyQuery(name=API_KEY_NAME, auto_error=False)

async def get_api_key(
    api_key_query: str = Security(api_key_query),
):
    """Validate API key for endpoint security (from query parameter)"""
    if api_key_query == API_KEY:
        return api_key_query
    else:
        raise HTTPException(
            status_code=HTTP_403_FORBIDDEN, detail="Could not validate credentials"
        )
