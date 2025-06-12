# Health and status endpoints 
from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/")
async def root():
    """Root endpoint that returns API information"""
    return {
        "name": "Resomix API",
        "version": "1.0.1",
        "status": "running",
        "docs_url": "/docs"
    }


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "Resomix API"
    } 