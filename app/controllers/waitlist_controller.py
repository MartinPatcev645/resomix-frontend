"""
Waitlist Controller
===================

This controller handles HTTP requests for waitlist functionality.
It processes waitlist email submissions, validates inputs, and coordinates
with services to manage waitlist entries with proper error handling.

Manages waitlist operations including email submission, status checking,
and response formatting for the ResomiX audio similarity system.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Dict, Any
from fastapi import status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.waitlist_service import WaitlistService
from app.utils.response_utils import format_response
from app.utils.logging_utils import log_request


class WaitlistController:
    """Controller for waitlist operations."""
    
    def __init__(self):
        self.waitlist_service = WaitlistService()
    
    async def add_to_waitlist(self, db: AsyncSession, waitlist_data: Dict[str, Any]) -> JSONResponse:
        """
        Add an email to the waitlist.
        
        Args:
            db: Database session
            waitlist_data: Waitlist request data
            
        Returns:
            JSON response with submission result
        """
        email = waitlist_data.get('email')
        
        log_request("waitlist submission", "POST", {
            "email": email
        })
        
        try:
            # Process waitlist submission
            result = await self.waitlist_service.add_to_waitlist(db, email)
            
            if result.get("success"):
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content=format_response(
                        success=True,
                        data=result.get("data")
                    )
                )
            else:
                return JSONResponse(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    content=format_response(
                        success=False,
                        error=result.get("error")
                    )
                )
                
        except Exception as e:
            print(f"Error in waitlist controller: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(
                    success=False,
                    error="An internal server error occurred while processing your waitlist submission"
                )
            )
    
    async def get_waitlist_entry(self, db: AsyncSession, email: str) -> JSONResponse:
        """
        Get waitlist entry by email.
        
        Args:
            db: Database session
            email: Email address to search for
            
        Returns:
            JSON response with waitlist entry data
        """
        log_request("get waitlist entry", "GET", {"email": email})
        
        try:
            result = await self.waitlist_service.get_waitlist_entry(db, email)
            
            if result.get("success"):
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content=format_response(
                        success=True,
                        data=result.get("data")
                    )
                )
            else:
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content=format_response(
                        success=False,
                        error=result.get("error")
                    )
                )
                
        except Exception as e:
            print(f"Error in waitlist controller: {e}")
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(
                    success=False,
                    error="An internal server error occurred while retrieving waitlist entry"
                )
            )
