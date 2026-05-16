"""
Spotify App Service
===================

Business logic for admin management of Spotify apps and user associations.
Coordinates repositories to provide validated responses for controllers.

Version: 3.0.1
Init Date: November 14, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from __future__ import annotations

from typing import Dict, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.models.spotify_app import SpotifyApp, UserSpotifyApp
from app.models.user import User
from app.repositories.spotify_app_repository import (
    SpotifyAppRepository,
    UserSpotifyAppRepository,
)
from app.repositories.user_repository import UserRepository


class SpotifyAppService:
    """Service layer for admin Spotify app management."""

    def __init__(self) -> None:
        self.spotify_app_repository = SpotifyAppRepository()
        self.user_spotify_app_repository = UserSpotifyAppRepository()
        self.user_repository = UserRepository()

    # ------------------------------------------------------------------
    # Spotify App CRUD Operations
    # ------------------------------------------------------------------

    async def list_spotify_apps(
        self,
        db: AsyncSession,
        *,
        page: int = 1,
        page_size: int = 100,
        is_active: Optional[bool] = None,
        search: Optional[str] = None,
    ) -> Dict[str, object]:
        """List Spotify apps with optional filters."""
        offset = (page - 1) * page_size
        apps, total = await self.spotify_app_repository.async_list(
            db,
            is_active=is_active,
            search=search,
            offset=offset,
            limit=page_size,
        )

        data: List[Dict[str, object]] = [self._serialize_app(app) for app in apps]

        pagination = {
            "total": total,
            "skip": offset,
            "limit": page_size,
            "count": len(data),
        }

        return {"success": True, "data": data, "pagination": pagination}

    async def get_spotify_app(
        self,
        db: AsyncSession,
        *,
        app_id: int,
        include_secret: bool = False,
    ) -> Dict[str, object]:
        """Get single Spotify app by ID."""
        app = await self.spotify_app_repository.async_get_by_id(db, app_id)
        if not app:
            return {
                "success": False,
                "error": f"Spotify app with ID {app_id} not found",
            }

        data = self._serialize_app(app, include_secret=include_secret)
        return {"success": True, "data": data}

    async def create_spotify_app(
        self,
        db: AsyncSession,
        *,
        name: str,
        description: Optional[str],
        client_id: str,
        client_secret: str,
        is_active: bool = True,
    ) -> Dict[str, object]:
        """Create a new Spotify app."""
        # Check for duplicate name
        existing_by_name = await self.spotify_app_repository._async_find_existing(
            db, name=name
        )
        if existing_by_name:
            return {
                "success": False,
                "error": f"Spotify app with name '{name}' already exists",
            }

        # Check for duplicate client_id
        existing_by_client_id = (
            await self.spotify_app_repository.async_get_by_client_id(db, client_id)
        )
        if existing_by_client_id:
            return {
                "success": False,
                "error": f"Spotify app with client_id '{client_id}' already exists",
            }

        try:
            app = await self.spotify_app_repository.async_create(
                db,
                name=name,
                description=description,
                client_id=client_id,
                client_secret=client_secret,
                is_active=is_active,
                user_count=0,
            )
            data = self._serialize_app(app, include_secret=True)
            return {"success": True, "data": data}
        except IntegrityError as e:
            return {
                "success": False,
                "error": f"Failed to create Spotify app: {str(e)}",
            }

    async def update_spotify_app(
        self,
        db: AsyncSession,
        *,
        app_id: int,
        name: Optional[str] = None,
        description: Optional[str] = None,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> Dict[str, object]:
        """Update a Spotify app."""
        app = await self.spotify_app_repository.async_get_by_id(db, app_id)
        if not app:
            return {
                "success": False,
                "error": f"Spotify app with ID {app_id} not found",
            }

        # Check for duplicate name if changing
        if name and name != app.name:
            existing_by_name = await self.spotify_app_repository._async_find_existing(
                db, name=name
            )
            if existing_by_name:
                return {
                    "success": False,
                    "error": f"Spotify app with name '{name}' already exists",
                }

        # Check for duplicate client_id if changing
        if client_id and client_id != app.client_id:
            existing_by_client_id = (
                await self.spotify_app_repository.async_get_by_client_id(db, client_id)
            )
            if existing_by_client_id:
                return {
                    "success": False,
                    "error": f"Spotify app with client_id '{client_id}' already exists",
                }

        update_data = {}
        if name is not None:
            update_data["name"] = name
        if description is not None:
            update_data["description"] = description
        if client_id is not None:
            update_data["client_id"] = client_id
        if client_secret is not None:
            update_data["client_secret"] = client_secret
        if is_active is not None:
            update_data["is_active"] = is_active

        try:
            updated_app = await self.spotify_app_repository.async_update(
                db, app_id, **update_data
            )
            if not updated_app:
                return {
                    "success": False,
                    "error": f"Failed to update Spotify app with ID {app_id}",
                }

            data = self._serialize_app(updated_app, include_secret=True)
            return {"success": True, "data": data}
        except IntegrityError as e:
            return {
                "success": False,
                "error": f"Failed to update Spotify app: {str(e)}",
            }

    async def delete_spotify_app(
        self,
        db: AsyncSession,
        *,
        app_id: int,
        cascade: bool = False,
    ) -> Dict[str, object]:
        """Delete a Spotify app."""
        app = await self.spotify_app_repository.async_get_by_id(db, app_id)
        if not app:
            return {
                "success": False,
                "error": f"Spotify app with ID {app_id} not found",
            }

        # Check for existing user associations
        user_count = await self.user_spotify_app_repository.async_count_by_app_id(
            db, app_id
        )
        if user_count > 0 and not cascade:
            return {
                "success": False,
                "error": f"Cannot delete Spotify app with {user_count} associated user(s). Use cascade=true to delete with associations.",
            }

        # If cascade, associations will be deleted automatically due to CASCADE constraint
        # But we need to ensure user_count is reset (it will be 0 after cascade delete)
        deleted = await self.spotify_app_repository.async_delete(db, app_id)
        if not deleted:
            return {
                "success": False,
                "error": f"Failed to delete Spotify app with ID {app_id}",
            }

        return {
            "success": True,
            "message": f"Spotify app deleted successfully{' (with associations)' if cascade else ''}",
        }

    # ------------------------------------------------------------------
    # User Association Operations
    # ------------------------------------------------------------------

    async def list_user_associations(
        self,
        db: AsyncSession,
        *,
        page: int = 1,
        page_size: int = 30,
        search: Optional[str] = None,
        spotify_app_id: Optional[int] = None,
    ) -> Dict[str, object]:
        """List user-Spotify app associations with filters."""
        offset = (page - 1) * page_size
        results, total = await self.user_spotify_app_repository.async_list_associations(
            db,
            search=search,
            spotify_app_id=spotify_app_id,
            offset=offset,
            limit=page_size,
        )

        data: List[Dict[str, object]] = [
            self._serialize_association_bundle(bundle) for bundle in results
        ]

        pagination = {
            "total": total,
            "skip": offset,
            "limit": page_size,
            "count": len(data),
        }

        return {"success": True, "data": data, "pagination": pagination}

    async def get_user_association(
        self,
        db: AsyncSession,
        *,
        user_identifier: str,
    ) -> Dict[str, object]:
        """Get user association by user identifier."""
        user = await self._resolve_user(db, user_identifier)
        if not user:
            return {
                "success": False,
                "error": f"User not found for identifier '{user_identifier}'",
            }

        association = await self.user_spotify_app_repository.async_get_by_user_id(
            db, user.id
        )
        if not association:
            return {
                "success": False,
                "error": "User is not associated with any Spotify app",
            }

        # Fetch app for name
        app = await self.spotify_app_repository.async_get_by_id(
            db, association.spotify_app_id
        )
        data = self._serialize_association(association, user, app)
        return {"success": True, "data": data}

    async def upsert_user_association(
        self,
        db: AsyncSession,
        *,
        user_identifier: str,
        spotify_app_id: int,
        created_by: Optional[int] = None,
    ) -> Dict[str, object]:
        """Create or update user-Spotify app association."""
        # Resolve user
        user = await self._resolve_user(db, user_identifier)
        if not user:
            return {
                "success": False,
                "error": f"User not found for identifier '{user_identifier}'",
            }

        # Verify app exists and is active
        app = await self.spotify_app_repository.async_get_by_id(db, spotify_app_id)
        if not app:
            return {
                "success": False,
                "error": f"Spotify app with ID {spotify_app_id} not found",
            }

        if not app.is_active:
            return {
                "success": False,
                "error": f"Cannot associate user with inactive Spotify app '{app.name}'",
            }

        # Check for existing association
        existing_association = (
            await self.user_spotify_app_repository.async_get_by_user_id(db, user.id)
        )

        old_app_id = None
        if existing_association:
            old_app_id = existing_association.spotify_app_id
            # If same app, no change needed
            if old_app_id == spotify_app_id:
                app = await self.spotify_app_repository.async_get_by_id(
                    db, spotify_app_id
                )
                data = self._serialize_association(existing_association, user, app)
                return {"success": True, "data": data}

        # Check user limit: if app already has 25 users, don't allow new associations
        # Exception: if user is already associated with this app (handled above) or
        # if user is moving from another app (old_app_id != spotify_app_id)
        # In the moving case, we still need to check if the new app has space
        if app.user_count >= 25:
            return {
                "success": False,
                "error": f"Spotify app '{app.name}' has reached the maximum limit of 25 users. Cannot add more users.",
            }

        # Use transaction to ensure atomicity - all operations in one transaction
        try:
            # Update or create association (without committing)
            if existing_association:
                association = (
                    await self.user_spotify_app_repository.async_update_association(
                        db, user_id=user.id, spotify_app_id=spotify_app_id
                    )
                )
                # Safety check: if update returned None, association was deleted concurrently
                if not association:
                    return {
                        "success": False,
                        "error": "Association was deleted concurrently. Please try again.",
                    }
            else:
                association = (
                    await self.user_spotify_app_repository.async_create_association(
                        db,
                        user_id=user.id,
                        spotify_app_id=spotify_app_id,
                        created_by=created_by,
                    )
                )

            # Update user_count atomically (without committing)
            if old_app_id and old_app_id != spotify_app_id:
                # Decrement old app
                await self.spotify_app_repository.async_decrement_user_count(
                    db, old_app_id
                )
                # Increment new app
                await self.spotify_app_repository.async_increment_user_count(
                    db, spotify_app_id
                )
            elif not existing_association:
                # New association, increment new app
                await self.spotify_app_repository.async_increment_user_count(
                    db, spotify_app_id
                )

            # Refresh app to get updated user_count
            app = await self.spotify_app_repository.async_get_by_id(db, spotify_app_id)
            data = self._serialize_association(association, user, app)
            return {"success": True, "data": data}

        except IntegrityError as e:
            return {
                "success": False,
                "error": f"Failed to create/update association: {str(e)}",
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to create/update association: {str(e)}",
            }

    async def delete_user_association(
        self,
        db: AsyncSession,
        *,
        user_identifier: str,
    ) -> Dict[str, object]:
        """Delete user-Spotify app association."""
        user = await self._resolve_user(db, user_identifier)
        if not user:
            return {
                "success": False,
                "error": f"User not found for identifier '{user_identifier}'",
            }

        association = await self.user_spotify_app_repository.async_get_by_user_id(
            db, user.id
        )
        if not association:
            return {
                "success": False,
                "error": "User is not associated with any Spotify app",
            }

        app_id = association.spotify_app_id

        try:
            # Delete association (without committing)
            deleted = await self.user_spotify_app_repository.async_delete_association(
                db, user.id
            )
            if not deleted:
                return {
                    "success": False,
                    "error": "Failed to delete user association",
                }

            # Decrement user_count (without committing)
            await self.spotify_app_repository.async_decrement_user_count(
                db, app_id
            )

            return {
                "success": True,
                "message": "User association deleted successfully",
            }

        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to delete association: {str(e)}",
            }

    async def get_user_spotify_app_client_id(
        self,
        db: AsyncSession,
        *,
        user_identifier: str,
    ) -> Dict[str, object]:
        """Get user's associated Spotify app client_id for OAuth flow."""
        user = await self._resolve_user(db, user_identifier)
        if not user:
            return {
                "success": False,
                "client_id": None,
                "app_name": None,
                "message": f"User not found for identifier '{user_identifier}'",
            }

        association = await self.user_spotify_app_repository.async_get_by_user_id(
            db, user.id
        )
        if not association:
            return {
                "success": False,
                "client_id": None,
                "app_name": None,
                "message": "User not associated with any Spotify app. Please contact admin to enable Spotify transfer.",
            }

        app = await self.spotify_app_repository.async_get_by_id(
            db, association.spotify_app_id
        )
        if not app or not app.is_active:
            return {
                "success": False,
                "client_id": None,
                "app_name": None,
                "message": "User's associated Spotify app is not active. Please contact admin.",
            }

        return {
            "success": True,
            "client_id": app.client_id,
            "app_name": app.name,
            "message": None,
        }

    # ------------------------------------------------------------------
    # Helper Methods
    # ------------------------------------------------------------------

    async def _resolve_user(self, db: AsyncSession, identifier: str) -> Optional[User]:
        """Resolve user by email, UUID, username, or ID."""
        if not identifier:
            return None

        candidate = identifier.strip()
        if not candidate:
            return None

        # Try email first
        if "@" in candidate:
            return await self.user_repository.async_get_by_email(db, candidate.lower())

        # Try UUID (36 chars with hyphens)
        if len(candidate) == 36 and candidate.count("-") == 4:
            user = await self.user_repository.async_get_by_uuid(db, candidate)
            if user:
                return user

        # Try numeric ID
        if candidate.isdigit():
            user = await self.user_repository.async_get_by_id(db, int(candidate))
            if user:
                return user

        # Fallback to username
        return await self.user_repository.async_get_by_username(db, candidate)

    def _serialize_app(
        self, app: SpotifyApp, include_secret: bool = False
    ) -> Dict[str, object]:
        """Serialize Spotify app to dict."""
        data = {
            "id": app.id,
            "name": app.name,
            "description": app.description,
            "client_id": app.client_id,
            "is_active": app.is_active,
            "user_count": app.user_count,
            "created_at": (
                app.created_at.isoformat() if getattr(app, "created_at", None) else None
            ),
            "updated_at": (
                app.updated_at.isoformat() if getattr(app, "updated_at", None) else None
            ),
        }
        if include_secret:
            data["client_secret"] = app.client_secret
        return data

    def _serialize_association_bundle(
        self, bundle: Dict[str, object]
    ) -> Dict[str, object]:
        """Serialize association bundle to dict."""
        association: UserSpotifyApp = bundle["association"]
        user: User = bundle["user"]
        app: SpotifyApp = bundle["app"]
        return self._serialize_association(association, user, app)

    def _serialize_association(
        self,
        association: UserSpotifyApp,
        user: User,
        app: Optional[SpotifyApp],
    ) -> Dict[str, object]:
        """Serialize user association to dict."""
        return {
            "user_id": user.id,
            "user_email": getattr(user, "email", None),
            "user_username": getattr(user, "username", None),
            "user_uuid": getattr(user, "uuid", None),
            "spotify_app_id": association.spotify_app_id,
            "spotify_app_name": app.name if app else None,
            "created_at": (
                association.created_at.isoformat()
                if getattr(association, "created_at", None)
                else None
            ),
            "updated_at": (
                association.updated_at.isoformat()
                if getattr(association, "updated_at", None)
                else None
            ),
        }
