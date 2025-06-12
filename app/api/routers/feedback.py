# Feedback and contact endpoints 
from typing import Dict, Any
from fastapi import APIRouter, Body, Security, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers.feedback_controller import FeedbackController
from app.api.dependencies.auth import get_api_key
from app.api.dependencies.database import get_database_session
from app.schemas.feedback import ContactRequest, FeedbackRequest

router = APIRouter(tags=["feedback"])

# Initialize controller
feedback_controller = FeedbackController()


@router.post("/feedback")
async def feedback_endpoint(
    data: Dict[str, Any] = Body(...),
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key)
) -> JSONResponse:
    """
    Submit feedback or contact form data.
    
    For feedback form, include:
    - **satisfaction**: Rating from 1-10
    - **recommendation**: Rating from 1-10
    - **feedback**: Feedback text
    """
    return await feedback_controller.submit_feedback(db, data)


@router.post("/contact")
async def contact_endpoint(
    data: ContactRequest,
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key)
) -> JSONResponse:
    """
    Submit contact form data.
    
    Required fields:
    - **name**: Contact person's name
    - **email**: Contact person's email address
    - **message**: Contact message
    
    Optional fields:
    - **subject**: Subject line
    - **phone**: Phone number
    - **user_id**: User ID for authenticated users
    """
    # Convert Pydantic model to dict for processing
    contact_data = data.dict()
    
    return await feedback_controller.submit_contact(db, contact_data)
