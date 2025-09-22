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
from fastapi import status, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
import time
from app.services.waitlist_service import WaitlistService
from app.utils.response_utils import format_response
from app.services.logging_service import LoggingService


class WaitlistController:
    """Controller for waitlist operations."""
    
    def __init__(self):
        self.waitlist_service = WaitlistService()
        self.logging_service = LoggingService()
    
    async def add_to_waitlist(self, db: AsyncSession, request: Request, waitlist_data: Dict[str, Any]) -> JSONResponse:
        """
        Add an email to the waitlist.
        
        Args:
            db: Database session
            waitlist_data: Waitlist request data
            
        Returns:
            JSON response with submission result
        """
        start_time = time.time()
        email = waitlist_data.get('email')
        
        correlation_id = self.logging_service.generate_correlation_id()
        
        try:
            # Process waitlist submission
            result = await self.waitlist_service.add_to_waitlist(db, email)
            
            if result.get("success"):
                duration_ms = (time.time() - start_time) * 1000
                response_content = format_response(
                    success=True,
                    data=result.get("data")
                )
                self.logging_service.log(
                    async_db=db,
                    level="INFO",
                    category="WAITLIST",
                    action="waitlist_submit_success",
                    message="Waitlist email added successfully",
                    correlation_id=correlation_id,
                    request=request,
                    method=request.method,
                    endpoint=str(request.url.path),
                    path=str(request.url),
                    query_params=dict(request.query_params),
                    client_ip=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent"),
                    referer=request.headers.get("referer"),
                    status_code=200,
                    response_size=len(str(response_content)),
                    duration_ms=duration_ms,
                    context="Waitlist email submission",
                    metadata={
                        "email": email,
                        "waitlist_result": result.get("data"),
                        "response": response_content
                    },
                    operation="waitlist_add"
                )
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content=response_content
                )
            else:
                duration_ms = (time.time() - start_time) * 1000
                response_content = format_response(
                    success=False,
                    error=result.get("error")
                )
                self.logging_service.log(
                    async_db=db,
                    level="WARNING",
                    category="WAITLIST",
                    action="waitlist_submit_failed",
                    message=f"Waitlist submission failed: {result.get('error')}",
                    correlation_id=correlation_id,
                    request=request,
                    method=request.method,
                    endpoint=str(request.url.path),
                    path=str(request.url),
                    query_params=dict(request.query_params),
                    client_ip=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent"),
                    referer=request.headers.get("referer"),
                    status_code=422,
                    response_size=len(str(response_content)),
                    duration_ms=duration_ms,
                    context="Waitlist email submission validation",
                    metadata={
                        "email": email,
                        "error": result.get("error"),
                        "validation_step": "email_processing",
                        "response": response_content
                    },
                    operation="waitlist_add"
                )
                return JSONResponse(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    content=response_content
                )
                
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            import traceback
            response_content = format_response(
                success=False,
                error="An internal server error occurred while processing your waitlist submission"
            )
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="WAITLIST",
                action="waitlist_submit_exception",
                message="Unexpected error during waitlist submission",
                correlation_id=correlation_id,
                request=request,
                method=request.method,
                endpoint=str(request.url.path),
                path=str(request.url),
                query_params=dict(request.query_params),
                client_ip=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
                referer=request.headers.get("referer"),
                status_code=500,
                response_size=len(str(response_content)),
                duration_ms=duration_ms,
                error=e,
                stack_trace=traceback.format_exc(),
                context="Waitlist submission processing",
                metadata={
                    "email": email,
                    "error": "Internal server error occurred",
                    "exception_type": type(e).__name__,
                    "response": response_content
                },
                operation="waitlist_add"
            )
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=response_content
            )
    
    async def get_waitlist_entry(self, db: AsyncSession, request: Request, email: str) -> JSONResponse:
        """
        Get waitlist entry by email.
        
        Args:
            db: Database session
            email: Email address to search for
            
        Returns:
            JSON response with waitlist entry data
        """
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()
        
        try:
            result = await self.waitlist_service.get_waitlist_entry(db, email)
            
            if result.get("success"):
                duration_ms = (time.time() - start_time) * 1000
                response_content = format_response(
                    success=True,
                    data=result.get("data")
                )
                self.logging_service.log(
                    async_db=db,
                    level="INFO",
                    category="WAITLIST",
                    action="get_waitlist_success",
                    message="Waitlist entry retrieved successfully",
                    correlation_id=correlation_id,
                    request=request,
                    method=request.method,
                    endpoint=str(request.url.path),
                    path=str(request.url),
                    query_params=dict(request.query_params),
                    client_ip=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent"),
                    referer=request.headers.get("referer"),
                    status_code=200,
                    response_size=len(str(response_content)),
                    duration_ms=duration_ms,
                    context="Waitlist entry retrieval",
                    metadata={
                        "email": email,
                        "waitlist_data": result.get("data"),
                        "response": response_content
                    },
                    operation="waitlist_get"
                )
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content=response_content
                )
            else:
                duration_ms = (time.time() - start_time) * 1000
                response_content = format_response(
                    success=False,
                    error=result.get("error")
                )
                self.logging_service.log(
                    async_db=db,
                    level="WARNING",
                    category="WAITLIST",
                    action="get_waitlist_not_found",
                    message=f"Waitlist entry not found: {result.get('error')}",
                    correlation_id=correlation_id,
                    request=request,
                    method=request.method,
                    endpoint=str(request.url.path),
                    path=str(request.url),
                    query_params=dict(request.query_params),
                    client_ip=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent"),
                    referer=request.headers.get("referer"),
                    status_code=404,
                    response_size=len(str(response_content)),
                    duration_ms=duration_ms,
                    context="Waitlist entry lookup",
                    metadata={
                        "email": email,
                        "error": result.get("error"),
                        "lookup_step": "email_search",
                        "response": response_content
                    },
                    operation="waitlist_get"
                )
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content=response_content
                )
                
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            import traceback
            response_content = format_response(
                success=False,
                error="An internal server error occurred while retrieving waitlist entry"
            )
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="WAITLIST",
                action="get_waitlist_exception",
                message="Unexpected error during waitlist entry retrieval",
                correlation_id=correlation_id,
                request=request,
                method=request.method,
                endpoint=str(request.url.path),
                path=str(request.url),
                query_params=dict(request.query_params),
                client_ip=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
                referer=request.headers.get("referer"),
                status_code=500,
                response_size=len(str(response_content)),
                duration_ms=duration_ms,
                error=e,
                stack_trace=traceback.format_exc(),
                context="Waitlist entry retrieval processing",
                metadata={
                    "email": email,
                    "error": "Internal server error occurred",
                    "exception_type": type(e).__name__,
                    "response": response_content
                },
                operation="waitlist_get"
            )
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=response_content
            )
