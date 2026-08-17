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
import csv
import os
import uuid
import math
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from datetime import datetime, timedelta

from app.repositories.waitlist_repository import WaitlistRepository
from app.core.config import settings
from app.utils.sanitization import csv_safe
from app.services.admin_operation_log_service import AdminOperationLogService
from app.models.user import User
import logging

logger = logging.getLogger(__name__)


class WaitlistService:
    """
    Service for managing waitlist operations using MariaDB.
    Handles email validation, submission, and status checking.
    """

    def __init__(self):
        """Initialize waitlist service."""
        self.waitlist_repository = WaitlistRepository()
        self.admin_log_service = AdminOperationLogService()

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
            existing_entry = await self.waitlist_repository.async_get_by_field(
                db, "email", email
            )
            if existing_entry:
                return {
                    "success": False,
                    "error": "Email address is already on the waitlist",
                }

            # Create new waitlist entry
            waitlist_entry = await self.waitlist_repository.async_create(
                db, email=email, status="pending"
            )
            await db.commit()

            return {
                "success": True,
                "data": {
                    "id": waitlist_entry.id,
                    "email": waitlist_entry.email,
                    "status": waitlist_entry.status,
                    "created_at": (
                        waitlist_entry.created_at.isoformat()
                        if waitlist_entry.created_at
                        else None
                    ),
                },
            }

        except IntegrityError:
            await db.rollback()
            # Handle unique constraint violation
            return {
                "success": False,
                "error": "Email address is already on the waitlist",
            }
        except Exception as e:
            await db.rollback()
            logger.error(f"Error adding email to waitlist: {e}")
            return {"success": False, "error": "Failed to add email to waitlist"}

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
            waitlist_entry = await self.waitlist_repository.async_get_by_field(
                db, "email", email
            )

            if not waitlist_entry:
                return {
                    "success": False,
                    "error": "Email address not found in waitlist",
                }

            return {
                "success": True,
                "data": {
                    "id": waitlist_entry.id,
                    "email": waitlist_entry.email,
                    "status": waitlist_entry.status,
                    "created_at": (
                        waitlist_entry.created_at.isoformat()
                        if waitlist_entry.created_at
                        else None
                    ),
                    "updated_at": (
                        waitlist_entry.updated_at.isoformat()
                        if waitlist_entry.updated_at
                        else None
                    ),
                },
            }

        except Exception as e:
            logger.error(f"Error retrieving waitlist entry: {e}")
            return {"success": False, "error": "Failed to retrieve waitlist entry"}

    async def update_waitlist_status(
        self, db: AsyncSession, email: str, status: str
    ) -> Dict[str, Any]:
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

        if status not in ["pending", "approved", "rejected"]:
            return {
                "success": False,
                "error": "Invalid status. Must be 'pending', 'approved', or 'rejected'",
            }

        email = email.strip().lower()

        try:
            waitlist_entry = await self.waitlist_repository.async_get_by_field(
                db, "email", email
            )

            if not waitlist_entry:
                return {
                    "success": False,
                    "error": "Email address not found in waitlist",
                }

            # Update the status
            updated_entry = await self.waitlist_repository.async_update(
                db, waitlist_entry.id, status=status
            )
            await db.commit()

            return {
                "success": True,
                "data": {
                    "id": updated_entry.id,
                    "email": updated_entry.email,
                    "status": updated_entry.status,
                    "created_at": (
                        updated_entry.created_at.isoformat()
                        if updated_entry.created_at
                        else None
                    ),
                    "updated_at": (
                        updated_entry.updated_at.isoformat()
                        if updated_entry.updated_at
                        else None
                    ),
                },
            }

        except Exception as e:
            await db.rollback()
            logger.error(f"Error updating waitlist status: {e}")
            return {"success": False, "error": "Failed to update waitlist status"}

    async def get_all_waitlist_entries(
        self, db: AsyncSession, skip: int = 0, limit: int = 100
    ) -> Dict[str, Any]:
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
            entries = await self.waitlist_repository.async_get_all(
                db, skip=skip, limit=limit
            )

            formatted_entries = []
            for entry in entries:
                formatted_entries.append(
                    {
                        "id": entry.id,
                        "email": entry.email,
                        "status": entry.status,
                        "created_at": (
                            entry.created_at.isoformat() if entry.created_at else None
                        ),
                        "updated_at": (
                            entry.updated_at.isoformat() if entry.updated_at else None
                        ),
                    }
                )

            return {
                "success": True,
                "data": {"entries": formatted_entries, "count": len(formatted_entries)},
            }

        except Exception as e:
            logger.error(f"Error retrieving waitlist entries: {e}")
            return {"success": False, "error": "Failed to retrieve waitlist entries"}

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
        email_pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
        return re.match(email_pattern, email) is not None

    # ============================================================================
    # Admin Methods
    # ============================================================================

    async def get_waitlist_list_admin(
        self, db: AsyncSession, filters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Get paginated waitlist list with filters for admin."""
        try:
            waitlist_list, total = (
                await self.waitlist_repository.get_waitlist_list_with_filters(
                    db=db, **{k: v for k, v in filters.items() if k not in ["format"]}
                )
            )
            total_pages = (
                math.ceil(total / filters.get("page_size", 30)) if total > 0 else 0
            )
            return {
                "success": True,
                "data": waitlist_list,
                "pagination": {
                    "page": filters.get("page", 1),
                    "page_size": filters.get("page_size", 30),
                    "total": total,
                    "total_pages": total_pages,
                },
            }
        except Exception:
            return {
                "success": False,
                "error": "Internal server error occurred while retrieving waitlist entries",
                "data": [],
                "pagination": {
                    "page": 1,
                    "page_size": 30,
                    "total": 0,
                    "total_pages": 0,
                },
            }

    async def get_waitlist_entry_by_id(self, db: AsyncSession, waitlist_id: int) -> Dict[str, Any]:
        """Get waitlist entry by ID."""
        try:
            entry = await self.waitlist_repository.async_get_by_id(db, waitlist_id)
            if not entry:
                return {"success": False, "error": "Waitlist entry not found"}
            return {"success": True, "data": entry}
        except Exception as e:
            logger.error(f"Error getting waitlist entry by ID: {e}")
            return {"success": False, "error": "Internal server error"}

    async def delete_waitlist_admin(
        self,
        db: AsyncSession,
        waitlist_id: int,
        current_admin: Optional[User] = None,
        ip_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """Delete a single waitlist entry."""
        try:
            # 1. Get before state for audit log
            entry = await self.waitlist_repository.async_get_by_id(db, waitlist_id)
            if not entry:
                return {
                    "success": False,
                    "error": f"Waitlist entry with ID {waitlist_id} not found",
                }

            before_state = {
                "id": entry.id,
                "email": entry.email,
                "status": entry.status
            }

            deleted = await self.waitlist_repository.delete_waitlist(db, waitlist_id)
            if deleted:
                if current_admin:
                    await self.admin_log_service.log_operation(
                        db=db,
                        admin_user_id=current_admin.id,
                        action="waitlist.delete",
                        target_type="waitlist",
                        target_id=str(waitlist_id),
                        before_state=before_state,
                        after_state=None,
                        ip_address=ip_address
                    )
                await db.commit()
                return {"success": True, "message": "Waitlist entry deleted successfully"}
            else:
                await db.rollback()
                return {
                    "success": False,
                    "error": f"Waitlist entry with ID {waitlist_id} not found",
                }
        except Exception as e:
            await db.rollback()
            logger.error(f"Error deleting waitlist entry: {e}")
            return {"success": False, "error": "Internal server error during deletion"}

    async def batch_delete_waitlist_admin(
        self,
        db: AsyncSession,
        waitlist_ids: List[int],
        current_admin: Optional[User] = None,
        ip_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """Delete multiple waitlist entries."""
        try:
            deleted_count = await self.waitlist_repository.batch_delete_waitlist(
                db, waitlist_ids
            )
            if current_admin:
                await self.admin_log_service.log_operation(
                    db=db,
                    admin_user_id=current_admin.id,
                    action="waitlist.batch_delete",
                    target_type="waitlist",
                    target_id="batch",
                    before_state={"ids": waitlist_ids},
                    after_state={"deleted_count": deleted_count},
                    ip_address=ip_address
                )
            await db.commit()
            return {
                "success": True,
                "deleted_count": deleted_count,
                "message": f"{deleted_count} waitlist entries deleted",
            }
        except Exception as e:
            await db.rollback()
            logger.error(f"Error batch deleting waitlist entries: {e}")
            return {
                "success": False,
                "error": "Internal server error during batch deletion",
                "deleted_count": 0,
            }

    async def update_waitlist_status_admin(
        self,
        db: AsyncSession,
        waitlist_id: int,
        status: str,
        current_admin: Optional[User] = None,
        ip_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """Update waitlist status for admin."""
        try:
            # Get before state
            entry = await self.waitlist_repository.async_get_by_id(db, waitlist_id)
            if not entry:
                return {
                    "success": False,
                    "error": f"Waitlist entry with ID {waitlist_id} not found",
                }

            before_state = {"status": entry.status}

            waitlist = await self.waitlist_repository.update_waitlist_status(
                db, waitlist_id, status
            )
            if waitlist:
                if current_admin:
                    await self.admin_log_service.log_operation(
                        db=db,
                        admin_user_id=current_admin.id,
                        action="waitlist.update_status",
                        target_type="waitlist",
                        target_id=str(waitlist_id),
                        before_state=before_state,
                        after_state={"status": status},
                        ip_address=ip_address
                    )
                await db.commit()
                return {
                    "success": True,
                    "data": waitlist,
                    "message": "Status updated successfully",
                }
            else:
                await db.rollback()
                return {
                    "success": False,
                    "error": f"Waitlist entry with ID {waitlist_id} not found",
                }
        except Exception as e:
            await db.rollback()
            logger.error(f"Error updating waitlist status admin: {e}")
            return {"success": False, "error": "Internal server error during status update"}

    async def export_waitlist_csv_admin(
        self,
        db: AsyncSession,
        filters: Dict[str, Any],
        current_admin: Optional[User] = None,
        ip_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """Export waitlist to CSV file and return download URL."""
        try:
            waitlist_list = await self.waitlist_repository.get_waitlist_for_export(
                db=db,
                **{
                    k: v
                    for k, v in filters.items()
                    if k not in ["page", "page_size", "format"]
                },
            )
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"waitlist_export_{timestamp}_{uuid.uuid4().hex[:8]}.csv"
            export_dir = os.path.join(os.getcwd(), "exports")
            os.makedirs(export_dir, exist_ok=True)

            with open(
                os.path.join(export_dir, filename), "w", newline="", encoding="utf-8"
            ) as f:
                writer = csv.writer(f)
                writer.writerow(["ID", "Email", "Status", "Created At", "Updated At"])
                for w in waitlist_list:
                    writer.writerow(
                        [
                            w.id,
                            csv_safe(w.email),
                            w.status,
                            w.created_at.isoformat() if w.created_at else "",
                            w.updated_at.isoformat() if w.updated_at else "",
                        ]
                    )

            base_url = settings.resomix_server_url
            download_url = f"{base_url}/exports/{filename}"

            if current_admin:
                await self.admin_log_service.log_operation(
                    db=db,
                    admin_user_id=current_admin.id,
                    action="waitlist.export",
                    target_type="waitlist",
                    target_id="csv",
                    before_state=filters,
                    after_state={"download_url": download_url},
                    ip_address=ip_address
                )
            await db.commit()

            return {
                "success": True,
                "download_url": download_url,
                "filename": filename,
                "expires_at": (datetime.now() + timedelta(hours=24)).isoformat(),
            }
        except Exception as e:
            await db.rollback()
            logger.error(f"Error exporting waitlist CSV: {e}")
            return {"success": False, "error": "Internal server error during CSV export"}
