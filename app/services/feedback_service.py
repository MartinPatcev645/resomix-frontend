"""
Feedback Service
===============

This service provides functionality for handling user feedback and contact form submissions.
It uses the database to store feedback and contact data instead of Google Sheets.

Functions:
- process_feedback: Processes user feedback submissions and saves to database.
- process_contact: Processes contact form submissions and saves to database.

Author: AI Assistant
Date: December 2024 (Database-based implementation)
"""

from typing import Dict, Any, Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import SQLAlchemyError

from app.models.feedback import Feedback, Contact
from database.connection import get_async_db


class FeedbackService:
    """Service for handling feedback and contact form operations."""

    @staticmethod
    async def process_feedback(data: Dict[str, Any], db: AsyncSession) -> Dict[str, Any]:
        """
        Process and store user feedback to database.
        
        Args:
            data: Dictionary containing feedback data
            db: Async database session
            
        Returns:
            Success message dictionary
            
        Raises:
            ValueError: If validation fails
            Exception: If database operation fails
        """
        # Validate required fields
        required_fields = ["satisfaction", "recommendation"]
        for field in required_fields:
            if field not in data or not isinstance(data[field], (int, float)):
                raise ValueError(f"Missing or invalid required field: {field}")
        
        if not (1 <= data["satisfaction"] <= 10 and 1 <= data["recommendation"] <= 10):
            raise ValueError("Ratings must be between 1 and 10")
        
        print(f"Received feedback - Satisfaction: {data['satisfaction']}, Recommendation: {data['recommendation']}")

        try:
            # Create feedback record
            feedback_record = Feedback(
                user_id=data.get("user_id"),  # Optional, can be None for anonymous
                category=data.get("category"),  # Optional category
                message=data.get("feedback", ""),  # Optional feedback text
                satisfaction=int(data["satisfaction"]),
                recommendation=int(data["recommendation"]),
                status="open"  # Default status
                # submitted_at is automatically set by the database
            )
            
            db.add(feedback_record)
            await db.commit()
            await db.refresh(feedback_record)
            
            print(f"Successfully saved feedback with ID: {feedback_record.id}")
            
            return {"message": "Feedback received successfully and saved to database."}
            
        except SQLAlchemyError as e:
            await db.rollback()
            print(f"Database error while saving feedback: {e}")
            raise Exception("Failed to save feedback to database.")
        except Exception as e:
            await db.rollback()
            print(f"Unexpected error while saving feedback: {e}")
            raise Exception("An unexpected error occurred while processing feedback.")

    @staticmethod
    async def process_contact(data: Dict[str, Any], db: AsyncSession) -> Dict[str, Any]:
        """
        Process and store contact form submissions to database.
        
        Args:
            data: Dictionary containing contact form data
            db: Async database session
            
        Returns:
            Success message dictionary
            
        Raises:
            ValueError: If validation fails
            Exception: If database operation fails
        """
        # Validate required fields
        required_fields = ["name", "email", "message"]
        for field in required_fields:
            if field not in data or not data[field]:
                raise ValueError(f"Missing required field: {field}")
        
        # Basic email validation
        if "@" not in data["email"] or "." not in data["email"]:
            raise ValueError("Invalid email format")
        
        print(f"Received contact form from: {data['name']} ({data['email']})")

        try:
            # Create contact record
            contact_record = Contact(
                user_id=data.get("user_id"),  # Optional, can be None for anonymous
                name=data["name"],
                email=data["email"],
                subject=data.get("subject", ""),  # Optional subject
                phone=data.get("phone"),  # Optional phone
                message=data["message"],
                status="open"  # Default status
                # submitted_at is automatically set by the database
            )
            
            db.add(contact_record)
            await db.commit()
            await db.refresh(contact_record)
            
            print(f"Successfully saved contact form with ID: {contact_record.id}")
            
            return {"message": "Contact form submitted successfully and saved to database."}
            
        except SQLAlchemyError as e:
            await db.rollback()
            print(f"Database error while saving contact form: {e}")
            raise Exception("Failed to save contact form to database.")
        except Exception as e:
            await db.rollback()
            print(f"Unexpected error while saving contact form: {e}")
            raise Exception("An unexpected error occurred while processing contact form.")

    @staticmethod
    async def get_feedback_by_id(feedback_id: int, db: AsyncSession) -> Optional[Feedback]:
        """
        Retrieve feedback by ID.
        
        Args:
            feedback_id: ID of the feedback record
            db: Async database session
            
        Returns:
            Feedback record or None if not found
        """
        try:
            return await db.get(Feedback, feedback_id)
        except SQLAlchemyError as e:
            print(f"Database error while retrieving feedback: {e}")
            return None

    @staticmethod
    async def get_contact_by_id(contact_id: int, db: AsyncSession) -> Optional[Contact]:
        """
        Retrieve contact by ID.
        
        Args:
            contact_id: ID of the contact record
            db: Async database session
            
        Returns:
            Contact record or None if not found
        """
        try:
            return await db.get(Contact, contact_id)
        except SQLAlchemyError as e:
            print(f"Database error while retrieving contact: {e}")
            return None

    @staticmethod
    async def update_feedback_status(feedback_id: int, status: str, db: AsyncSession) -> bool:
        """
        Update feedback status.
        
        Args:
            feedback_id: ID of the feedback record
            status: New status ('open' or 'resolved')
            db: Async database session
            
        Returns:
            True if successful, False otherwise
        """
        if status not in ['open', 'resolved']:
            raise ValueError("Status must be 'open' or 'resolved'")
            
        try:
            feedback = await db.get(Feedback, feedback_id)
            if feedback:
                feedback.status = status
                await db.commit()
                print(f"Updated feedback {feedback_id} status to {status}")
                return True
            else:
                print(f"Feedback {feedback_id} not found")
                return False
        except SQLAlchemyError as e:
            await db.rollback()
            print(f"Database error while updating feedback status: {e}")
            return False

    @staticmethod
    async def update_contact_status(contact_id: int, status: str, db: AsyncSession) -> bool:
        """
        Update contact status.
        
        Args:
            contact_id: ID of the contact record
            status: New status ('open' or 'resolved')
            db: Async database session
            
        Returns:
            True if successful, False otherwise
        """
        if status not in ['open', 'resolved']:
            raise ValueError("Status must be 'open' or 'resolved'")
            
        try:
            contact = await db.get(Contact, contact_id)
            if contact:
                contact.status = status
                await db.commit()
                print(f"Updated contact {contact_id} status to {status}")
                return True
            else:
                print(f"Contact {contact_id} not found")
                return False
        except SQLAlchemyError as e:
            await db.rollback()
            print(f"Database error while updating contact status: {e}")
            return False


# Factory functions for backward compatibility
async def process_feedback(data: Dict[str, Any], db: AsyncSession = None) -> Dict[str, Any]:
    """
    Factory function for backward compatibility with existing code.
    
    Args:
        data: Feedback data dictionary
        db: Optional database session (if not provided, will need to be injected)
        
    Returns:
        Success message dictionary
    """
    if db is None:
        raise ValueError("Database session is required")
    
    return await FeedbackService.process_feedback(data, db)


async def process_contact(data: Dict[str, Any], db: AsyncSession = None) -> Dict[str, Any]:
    """
    Factory function for backward compatibility with existing code.
    
    Args:
        data: Contact form data dictionary
        db: Optional database session (if not provided, will need to be injected)
        
    Returns:
        Success message dictionary
    """
    if db is None:
        raise ValueError("Database session is required")
    
    return await FeedbackService.process_contact(data, db) 