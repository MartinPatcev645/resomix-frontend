# Feedback controller 
from typing import Dict, Any
from fastapi import status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.feedback_service import FeedbackService
from app.utils.response_utils import format_response
from app.utils.logging_utils import log_request


class FeedbackController:
    def __init__(self):
        self.feedback_service = FeedbackService()

    async def submit_feedback(self, db: AsyncSession, data: Dict[str, Any]) -> JSONResponse:
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
        log_request("feedback", "POST", {"formType": data.get("formType", "feedback")})
        
        try:
            # Determine if this is a contact form or feedback form
            if data.get("formType") == "contact":
                result = await self.feedback_service.process_contact(data, db)
            else:
                result = await self.feedback_service.process_feedback(data, db)
                
            # Return success response
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=format_response(success=True, data=result)
            )
            
        except ValueError as ve:
            # Validation errors
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                content=format_response(success=False, error=str(ve))
            )
            
        except Exception as e:
            # Log the exception for debugging
            print(f"An error occurred in feedback: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error="An internal server error occurred.")
            ) 