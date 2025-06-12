# Feedback and contact endpoints 
from typing import Dict, Any
from fastapi import APIRouter, Body, Security, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.controllers.feedback_controller import FeedbackController
from app.api.dependencies.auth import get_api_key
from app.api.dependencies.database import get_database_session

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
    
    For contact form, include:
    - **name**: User's name
    - **email**: User's email
    - **subject**: Subject of the message
    - **message**: Message text
    - **formType**: Set to "contact"
    """
    return await feedback_controller.submit_feedback(db, data) 