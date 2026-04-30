"""
User Repository
===============

Repository for user authentication and management operations.
Handles CRUD operations for User and related auth tables.

Version: 3.2.0
Author: Muhammad Usman Naeem
Date: October 23, 2025
"""

from typing import Optional, List
from datetime import datetime
from sqlalchemy import select, and_, or_, delete, update, func
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import (
    User,
    UserToken,
    UserSession
)
from app.repositories.base_repository import BaseRepository
from app.core.security import generate_session_id


class UserRepository(BaseRepository[User]):
    """Repository for User model operations"""
    
    def __init__(self):
        super().__init__(User)
    
    def _find_existing(self, db: Session, **kwargs) -> Optional[User]:
        """Find existing user by email or username"""
        email = kwargs.get('email')
        username = kwargs.get('username')
        
        if email:
            return db.query(User).filter(User.email == email).first()
        elif username:
            return db.query(User).filter(User.username == username).first()
        return None
    
    async def _async_find_existing(self, db: AsyncSession, **kwargs) -> Optional[User]:
        """Async version of _find_existing"""
        email = kwargs.get('email')
        username = kwargs.get('username')
        
        if email:
            stmt = select(User).where(User.email == email)
        elif username:
            stmt = select(User).where(User.username == username)
        else:
            return None
        
        result = await db.execute(stmt)
        return result.scalar_one_or_none()
    
    # === User CRUD Operations ===
    
    async def async_get_by_email(self, db: AsyncSession, email: str) -> Optional[User]:
        """Get user by email address"""
        stmt = select(User).where(User.email == email)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()
    
    async def async_get_by_username(self, db: AsyncSession, username: str) -> Optional[User]:
        """Get user by username"""
        stmt = select(User).where(User.username == username)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()
    
    async def async_get_by_uuid(self, db: AsyncSession, user_uuid: str) -> Optional[User]:
        """Get user by UUID (external/public ID)"""
        stmt = select(User).where(User.uuid == user_uuid)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def async_search_users(
        self,
        db: AsyncSession,
        query: str,
        limit: int = 20
    ) -> List[User]:
        """Search users by email, username, or UUID (partial match)."""
        search = (query or "").strip()
        if not search:
            return []

        filters = []
        lowered = search.lower()
        like_pattern = f"%{lowered}%"

        filters.append(func.lower(User.email).like(like_pattern))
        filters.append(func.lower(User.username).like(like_pattern))

        if len(search) == 36 and search.count("-") == 4:
            filters.append(User.uuid == search)
        else:
            filters.append(func.lower(User.uuid).like(like_pattern))

        if search.isdigit():
            filters.append(User.id == int(search))

        stmt = (
            select(User)
            .where(or_(*filters))
            .order_by(User.created_at.desc())
            .limit(limit)
        )

        result = await db.execute(stmt)
        return result.scalars().all()
    
    async def async_create_user(
        self,
        db: AsyncSession,
        email: str,
        username: str,
        password_hash: str,
        name: Optional[str] = None
    ) -> User:
        """Create new user"""
        user = User(
            email=email,
            username=username,
            password_hash=password_hash,
            name=name,
            is_email_verified=False,
            is_two_factor_enabled=False
        )
        
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user
    
    async def async_update_email_verified(
        self,
        db: AsyncSession,
        user_id: int,
        is_verified: bool = True
    ) -> Optional[User]:
        """Mark user email as verified"""
        user = await self.async_get_by_id(db, user_id)
        if user:
            user.is_email_verified = is_verified
            await db.commit()
            await db.refresh(user)
        return user
    
    async def async_update_password(
        self,
        db: AsyncSession,
        user_id: int,
        new_password_hash: str
    ) -> Optional[User]:
        """Update user password"""
        user = await self.async_get_by_id(db, user_id)
        if user:
            user.password_hash = new_password_hash
            await db.commit()
            await db.refresh(user)
        return user
    
    async def async_enable_2fa(
        self,
        db: AsyncSession,
        user_id: int,
        method: str = 'email'
    ) -> Optional[User]:
        """Enable 2FA for user"""
        user = await self.async_get_by_id(db, user_id)
        if user:
            user.is_two_factor_enabled = True
            user.two_factor_method = method
            await db.commit()
            await db.refresh(user)
        return user
    
    async def async_disable_2fa(self, db: AsyncSession, user_id: int) -> Optional[User]:
        """Disable 2FA for user"""
        user = await self.async_get_by_id(db, user_id)
        if user:
            user.is_two_factor_enabled = False
            await db.commit()
            await db.refresh(user)
        return user


class UserTokenRepository:
    """Repository for consolidated user tokens (email verification, password reset, 2fa)"""
    
    async def async_create_token(
        self,
        db: AsyncSession,
        user_id: int,
        token: str,
        token_type: str,
        expires_at: datetime
    ) -> UserToken:
        """Create a user token, removing any existing token of the same type for this user."""
        # Delete existing tokens of same type for user
        await db.execute(
            delete(UserToken).where(
                and_(
                    UserToken.user_id == user_id,
                    UserToken.token_type == token_type
                )
            )
        )
        
        user_token = UserToken(
            user_id=user_id,
            token=token,
            token_type=token_type,
            expires_at=expires_at
        )
        
        db.add(user_token)
        await db.commit()
        await db.refresh(user_token)
        return user_token
    
    async def async_get_by_token(
        self,
        db: AsyncSession,
        token: str,
        token_type: str
    ) -> Optional[UserToken]:
        """Get valid token by string and type"""
        stmt = select(UserToken).where(
            and_(
                UserToken.token == token,
                UserToken.token_type == token_type,
                UserToken.expires_at > datetime.utcnow()
            )
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()
    
    async def async_delete_token(
        self,
        db: AsyncSession,
        user_id: int,
        token_type: str
    ) -> bool:
        """Delete tokens of a specific type for a user"""
        stmt = delete(UserToken).where(
            and_(
                UserToken.user_id == user_id,
                UserToken.token_type == token_type
            )
        )
        result = await db.execute(stmt)
        await db.commit()
        return result.rowcount > 0

    async def async_cleanup_expired(self, db: AsyncSession) -> int:
        """Delete all expired tokens"""
        stmt = delete(UserToken).where(UserToken.expires_at < datetime.utcnow())
        result = await db.execute(stmt)
        await db.commit()
        return result.rowcount


class UserSessionRepository:
    """Repository for user sessions (refresh token management)"""
    
    async def async_create_session(
        self,
        db: AsyncSession,
        user_id: int,
        refresh_token_hash: str,
        user_agent: Optional[str] = None,
        ip_address: Optional[str] = None,
        expires_at: Optional[datetime] = None
    ) -> UserSession:
        """Create new user session"""
        session = UserSession(
            user_id=user_id,
            session_id=generate_session_id(),
            refresh_token_hash=refresh_token_hash,
            user_agent=user_agent,
            ip_address=ip_address,
            expires_at=expires_at,
            revoked_at=None
        )
        
        db.add(session)
        await db.commit()
        await db.refresh(session)
        return session
    
    async def async_get_by_session_id(
        self,
        db: AsyncSession,
        session_id: str
    ) -> Optional[UserSession]:
        """Get session by session ID"""
        stmt = select(UserSession).where(UserSession.session_id == session_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()
    
    async def async_get_active_sessions(
        self,
        db: AsyncSession,
        user_id: int
    ) -> List[UserSession]:
        """Get all active sessions for user"""
        stmt = select(UserSession).where(
            and_(
                UserSession.user_id == user_id,
                UserSession.revoked_at.is_(None),
                or_(
                    UserSession.expires_at.is_(None),
                    UserSession.expires_at > datetime.utcnow()
                )
            )
        )
        result = await db.execute(stmt)
        return result.scalars().all()
    
    async def async_revoke_session(
        self,
        db: AsyncSession,
        session_id: str
    ) -> bool:
        """Revoke a specific session"""
        session = await self.async_get_by_session_id(db, session_id)
        if session:
            session.revoked_at = datetime.utcnow()
            await db.commit()
            return True
        return False
    
    async def async_revoke_all_user_sessions(
        self,
        db: AsyncSession,
        user_id: int
    ) -> int:
        """Revoke all sessions for a user"""
        stmt = (
            update(UserSession)
            .where(
                and_(
                    UserSession.user_id == user_id,
                    UserSession.revoked_at.is_(None)
                )
            )
            .values(revoked_at=datetime.utcnow())
        )
        result = await db.execute(stmt)
        await db.commit()
        return result.rowcount
    
    async def async_cleanup_expired_sessions(self, db: AsyncSession) -> int:
        """Delete expired sessions"""
        stmt = delete(UserSession).where(
            and_(
                UserSession.expires_at.isnot(None),
                UserSession.expires_at < datetime.utcnow()
            )
        )
        result = await db.execute(stmt)
        await db.commit()
        return result.rowcount
