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
