# CORS configuration middleware 
from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from app.core.config import settings


def setup_cors(app: FastAPI) -> None:
    """
    Configure CORS middleware for the FastAPI application.
    Uses settings from core.config to determine appropriate CORS policy.
    """
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=settings.current_origin_regex,
        allow_credentials=True,
        allow_methods=["*"],  # Allows all methods (GET, POST, etc.)
        allow_headers=["*"],  # Allows all headers
    )
