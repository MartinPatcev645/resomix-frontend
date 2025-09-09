"""
Waitlist Service
================

This service provides functionality for managing waitlist operations.
It handles email submissions, status checking, and waitlist management
using MariaDB repositories with proper validation and error handling.

Coordinates with waitlist repository to perform database operations
and format results for API consumption.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

import re
from typing import Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.repositories.waitlist_repository import WaitlistRepository
from app.models.waitlist import Waitlist


class WaitlistService:
    """
    Service for managing waitlist operations using MariaDB.
    Handles email validation, submission, and status checking.
    """
    
    def __init__(self):
        """Initialize waitlist service."""
        self.waitlist_repository = WaitlistRepository()
    
    async def add_to_waitlist(self, db: AsyncSession, email: str) -> Dict[str, Any]:
        """
        Add an email to the waitlist.
        
        Args:
            db: Database session
            email: Email address to add to waitlist
            
        Returns:
            Dictionary with success status and data or error message
        """
        if not email or not email.strip():
            return {"success": False, "error": "Email address is required"}
        
        email = email.strip().lower()
        
        # Validate email format
        if not self._is_valid_email(email):
            return {"success": False, "error": "Invalid email format"}
        
        try:
            # Check if email already exists
            existing_entry = await self.waitlist_repository.async_get_by_field(db, "email", email)
            if existing_entry:
                return {
                    "success": False, 
                    "error": "Email address is already on the waitlist"
                }
            
            # Create new waitlist entry
            waitlist_entry = await self.waitlist_repository.async_create(
                db, 
                email=email, 
                status='pending'
            )
            
            return {
                "success": True,
                "data": {
                    "id": waitlist_entry.id,
                    "email": waitlist_entry.email,
                    "status": waitlist_entry.status,
                    "created_at": waitlist_entry.created_at.isoformat() if waitlist_entry.created_at else None
                }
            }
            
        except IntegrityError:
            # Handle unique constraint violation
            return {
                "success": False, 
                "error": "Email address is already on the waitlist"
            }
        except Exception as e:
            print(f"Error adding email to waitlist: {e}")
            return {
                "success": False, 
                "error": "Failed to add email to waitlist"
            }
    
    async def get_waitlist_entry(self, db: AsyncSession, email: str) -> Dict[str, Any]:
        """
        Get waitlist entry by email.
        
        Args:
            db: Database session
            email: Email address to search for
            
        Returns:
            Dictionary with waitlist entry data or error message
        """
        if not email or not email.strip():
            return {"success": False, "error": "Email address is required"}
        
        email = email.strip().lower()
        
        try:
            waitlist_entry = await self.waitlist_repository.async_get_by_field(db, "email", email)
            
            if not waitlist_entry:
                return {
                    "success": False, 
                    "error": "Email address not found in waitlist"
                }
            
            return {
                "success": True,
                "data": {
                    "id": waitlist_entry.id,
                    "email": waitlist_entry.email,
                    "status": waitlist_entry.status,
                    "created_at": waitlist_entry.created_at.isoformat() if waitlist_entry.created_at else None,
                    "updated_at": waitlist_entry.updated_at.isoformat() if waitlist_entry.updated_at else None
                }
            }
            
        except Exception as e:
            print(f"Error retrieving waitlist entry: {e}")
            return {
                "success": False, 
                "error": "Failed to retrieve waitlist entry"
            }
    
    async def update_waitlist_status(self, db: AsyncSession, email: str, status: str) -> Dict[str, Any]:
        """
        Update waitlist entry status.
        
        Args:
            db: Database session
            email: Email address to update
            status: New status ('pending', 'approved', 'rejected')
            
        Returns:
            Dictionary with success status and data or error message
        """
        if not email or not email.strip():
            return {"success": False, "error": "Email address is required"}
        
        if status not in ['pending', 'approved', 'rejected']:
            return {"success": False, "error": "Invalid status. Must be 'pending', 'approved', or 'rejected'"}
        
        email = email.strip().lower()
        
        try:
            waitlist_entry = await self.waitlist_repository.async_get_by_field(db, "email", email)
            
            if not waitlist_entry:
                return {
                    "success": False, 
                    "error": "Email address not found in waitlist"
                }
            
            # Update the status
            updated_entry = await self.waitlist_repository.async_update(
                db, 
                waitlist_entry.id, 
                status=status
            )
            
            return {
                "success": True,
                "data": {
                    "id": updated_entry.id,
                    "email": updated_entry.email,
                    "status": updated_entry.status,
                    "created_at": updated_entry.created_at.isoformat() if updated_entry.created_at else None,
                    "updated_at": updated_entry.updated_at.isoformat() if updated_entry.updated_at else None
                }
            }
            
        except Exception as e:
            print(f"Error updating waitlist status: {e}")
            return {
                "success": False, 
                "error": "Failed to update waitlist status"
            }
    
    async def get_all_waitlist_entries(self, db: AsyncSession, skip: int = 0, limit: int = 100) -> Dict[str, Any]:
        """
        Get all waitlist entries with pagination.
        
        Args:
            db: Database session
            skip: Number of entries to skip
            limit: Maximum number of entries to return
            
        Returns:
            Dictionary with list of waitlist entries
        """
        try:
            entries = await self.waitlist_repository.async_get_all(db, skip=skip, limit=limit)
            
            formatted_entries = []
            for entry in entries:
                formatted_entries.append({
                    "id": entry.id,
                    "email": entry.email,
                    "status": entry.status,
                    "created_at": entry.created_at.isoformat() if entry.created_at else None,
                    "updated_at": entry.updated_at.isoformat() if entry.updated_at else None
                })
            
            return {
                "success": True,
                "data": {
                    "entries": formatted_entries,
                    "count": len(formatted_entries)
                }
            }
            
        except Exception as e:
            print(f"Error retrieving waitlist entries: {e}")
            return {
                "success": False, 
                "error": "Failed to retrieve waitlist entries"
            }
    
    def _is_valid_email(self, email: str) -> bool:
        """
        Validate email format using regex.
        
        Args:
            email: Email address to validate
            
        Returns:
            True if email format is valid, False otherwise
        """
        if not email:
            return False
        
        # Basic email regex pattern
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return re.match(email_pattern, email) is not None
