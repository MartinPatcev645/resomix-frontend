# Resomix User Authentication Implementation Guide

**Version**: 3.2.0  
**Date**: October 23, 2025  
**Author**: Muhammad Usman Naeem  
**Purpose**: Complete step-by-step guide to implement secure user authentication with JWT, password management, email verification, and 2FA

---

## Table of Contents

1. [Overview & Architecture](#1-overview--architecture)
2. [Dependencies & Libraries](#2-dependencies--libraries)
3. [Database Models](#3-database-models)
4. [Configuration Updates](#4-configuration-updates)
5. [Core Security Layer](#5-core-security-layer)
6. [Repository Layer](#6-repository-layer)
7. [Service Layer](#7-service-layer)
8. [Schemas Layer](#8-schemas-layer)
9. [Controller Layer](#9-controller-layer)
10. [Router Layer](#10-router-layer)
11. [Middleware & Dependencies](#11-middleware--dependencies)
12. [Integration with Existing Features](#12-integration-with-existing-features)
13. [Testing Strategy](#13-testing-strategy)
14. [Security Best Practices](#14-security-best-practices)
15. [Deployment Checklist](#15-deployment-checklist)

---

## 1. Overview & Architecture

### Current State
- **Authentication**: Simple API key validation via query parameter
- **User Context**: All operations support nullable `user_id` (anonymous users)
- **Database**: MariaDB with SQLAlchemy ORM

### Target State
- **Dual Authentication Mode**: 
  - API Key (existing - for public/anonymous access)
  - JWT Bearer Token (new - for authenticated users)
- **User Management**: Full auth system with registration, login, password reset, email verification, 2FA
- **Backward Compatibility**: All existing endpoints remain accessible to anonymous users
- **Optional User Context**: Logged-in users automatically get `user_id` attached to operations

### Key Principles
✅ **Anonymous-first**: Service stays fully functional without login  
✅ **Optional Enhancement**: Login adds user tracking and personalization  
✅ **Security**: Battle-tested libraries, industry best practices  
✅ **Scalability**: JWT for stateless auth, sessions for revocation  
✅ **User Experience**: Email verification, password reset, 2FA  

---

## 2. Dependencies & Libraries

### Add to `requirements.txt`

```txt
# === Existing Dependencies ===
# (keep all your current dependencies)

# === NEW: Authentication & Security ===
# JWT handling - industry standard, battle-tested
python-jose[cryptography]==3.3.0      # JWT encoding/decoding with cryptography backend
passlib[bcrypt]==1.7.4                # Password hashing with bcrypt
python-multipart==0.0.6               # For form data (login forms)

# Email sending (choose one based on your preference)
fastapi-mail==1.4.1                   # FastAPI email integration
# OR
aiosmtplib==3.0.1                     # Async SMTP client
jinja2==3.1.2                         # Email templating

# Rate limiting for brute force protection
slowapi==0.1.9                        # Rate limiting for FastAPI
limits==3.6.0                         # Backend for slowapi

# Optional but recommended
email-validator==2.1.0                # Enhanced email validation
pyotp==2.9.0                          # For TOTP if you add app-based 2FA later
```

### Library Justification

- **`python-jose`**: Industry-standard JWT library, used by FastAPI docs, supports multiple algorithms
- **`passlib[bcrypt]`**: Recommended by OWASP, bcrypt is slow by design (resistant to brute force)
- **`fastapi-mail`**: Async email sending with template support, FastAPI integration
- **`slowapi`**: Built for FastAPI, provides decorator-based rate limiting
- **`email-validator`**: More robust than Pydantic's built-in validation

---

## 3. Database Models

### 3.1 Create User Model (`app/models/user.py`)

**Update the existing file to add the User model:**

```python
"""
User & Auth Models
==================

Complete user authentication models including User, sessions, tokens, and RBAC.
Supports dual ID system: internal BIGINT id + external UUID.

Version: 3.2.0
"""

from sqlalchemy import Column, Integer, BigInteger, String, Boolean, Enum, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from . import Base
import uuid as uuid_lib


class User(Base):
    """
    User model representing the users table
    
    Dual ID System:
    - id: Internal BIGINT for fast foreign keys
    - uuid: External CHAR(36) for API responses (stable, never changes)
    """
    __tablename__ = "users"
    
    # Primary keys
    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    uuid = Column(String(36), nullable=False, unique=True, index=True)
    
    # Authentication
    username = Column(String(50), nullable=False, unique=True, index=True)
    email = Column(String(100), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    
    # Profile
    name = Column(String(100), nullable=True)
    profile_picture = Column(String(255), nullable=True)
    language = Column(String(10), nullable=True, default='en')
    timezone = Column(String(50), nullable=True, default='UTC')
    
    # Security flags
    is_email_verified = Column(Boolean, nullable=False, default=False)
    is_two_factor_enabled = Column(Boolean, nullable=False, default=False)
    two_factor_method = Column(
        Enum('email', 'app', name='two_factor_method'),
        nullable=False,
        default='email'
    )
    
    # Timestamps
    created_at = Column(DateTime, nullable=False, server_default=func.current_timestamp())
    updated_at = Column(
        DateTime,
        nullable=False,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp()
    )
    
    # Relationships
    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")
    roles = relationship("UserRole", back_populates="user", cascade="all, delete-orphan")
    
    def __init__(self, **kwargs):
        """Initialize user with auto-generated UUID if not provided."""
        if 'uuid' not in kwargs:
            kwargs['uuid'] = str(uuid_lib.uuid4())
        super().__init__(**kwargs)
    
    def __repr__(self):
        return f"<User(id={self.id}, uuid='{self.uuid}', email='{self.email}', username='{self.username}')>"


class EmailVerificationToken(Base):
    """Email verification tokens for account activation"""
    __tablename__ = "email_verification_tokens"
    
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    token = Column(String(36), nullable=False, unique=True, index=True)
    expires_at = Column(DateTime, nullable=False)
    
    # Relationship
    user = relationship("User", foreign_keys=[user_id])
    
    def __repr__(self):
        return f"<EmailVerificationToken(user_id={self.user_id}, token='{self.token[:8]}...')>"


class PasswordResetToken(Base):
    """Password reset tokens for secure password recovery"""
    __tablename__ = "password_reset_tokens"
    
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    token = Column(String(36), nullable=False, unique=True, index=True)
    expires_at = Column(DateTime, nullable=False)
    consumed_at = Column(DateTime, nullable=True)
    
    # Relationship
    user = relationship("User", foreign_keys=[user_id])
    
    def __repr__(self):
        return f"<PasswordResetToken(user_id={self.user_id}, consumed={self.consumed_at is not None})>"


class TwoFactorEmailCode(Base):
    """2FA email codes for login and sensitive operations"""
    __tablename__ = "two_factor_email_codes"
    
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    code = Column(String(10), nullable=False, primary_key=True)
    purpose = Column(
        Enum('login', 'password_change', name='two_factor_purpose'),
        nullable=False,
        default='login'
    )
    expires_at = Column(DateTime, nullable=False)
    consumed_at = Column(DateTime, nullable=True)
    
    # Relationship
    user = relationship("User", foreign_keys=[user_id])
    
    def __repr__(self):
        return f"<TwoFactorEmailCode(user_id={self.user_id}, purpose='{self.purpose}')>"


class UserSession(Base):
    """
    User sessions for refresh tokens and device tracking
    Enables token revocation and session management
    """
    __tablename__ = "user_sessions"
    
    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    session_id = Column(String(36), nullable=False, unique=True, index=True)
    refresh_token_hash = Column(String(255), nullable=True)
    
    # Device tracking
    user_agent = Column(String(255), nullable=True)
    ip_address = Column(String(45), nullable=True)
    
    # Session lifecycle
    created_at = Column(DateTime, nullable=False, server_default=func.current_timestamp())
    expires_at = Column(DateTime, nullable=True, index=True)
    revoked_at = Column(DateTime, nullable=True, index=True)
    
    # Relationship
    user = relationship("User", back_populates="sessions")
    
    def __repr__(self):
        return f"<UserSession(id={self.id}, user_id={self.user_id}, revoked={self.revoked_at is not None})>"


class UserAuthProvider(Base):
    """OAuth/Social login providers (for future use - skip for now)"""
    __tablename__ = "user_auth_providers"
    
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    provider = Column(String(50), nullable=False, primary_key=True)
    provider_uid = Column(String(100), nullable=False)
    
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4"}
    )
    
    def __repr__(self):
        return f"<UserAuthProvider(user_id={self.user_id}, provider='{self.provider}')>"


# Update UserRole to include user relationship
class UserRole(Base):
    """User-role assignments for RBAC"""
    __tablename__ = "user_roles"
    
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True)
    
    # Relationships
    user = relationship("User", back_populates="roles")
    role = relationship("Role", back_populates="user_roles")
    
    def __repr__(self):
        return f"<UserRole(user_id={self.user_id}, role_id={self.role_id})>"


# Keep existing Role and Permission models unchanged
```

### 3.2 Update `app/models/__init__.py`

Add new imports:

```python
from .user import (
    User, 
    EmailVerificationToken, 
    PasswordResetToken, 
    TwoFactorEmailCode,
    UserSession,
    UserAuthProvider,
    Role, 
    Permission, 
    RolePermission, 
    UserRole
)

__all__ = [
    "Base",
    # ... existing models ...
    "User",
    "EmailVerificationToken",
    "PasswordResetToken", 
    "TwoFactorEmailCode",
    "UserSession",
    "UserAuthProvider",
    "Role", "Permission", "RolePermission", "UserRole",
    # ... rest of models ...
]
```

---

## 4. Configuration Updates

### 4.1 Update `app/core/config.py`

Add JWT and security configuration:

```python
class Settings(BaseModel):
    # ... existing config ...
    
    # === NEW: JWT & Auth Configuration ===
    # JWT Settings
    jwt_secret_key: str = Field(
        default="your-secret-key-change-in-production-min-32-chars",
        description="Secret key for JWT token signing (must be 32+ chars)"
    )
    jwt_algorithm: str = Field(
        default="HS256",
        description="JWT signing algorithm"
    )
    jwt_access_token_expire_minutes: int = Field(
        default=30,
        description="Access token expiration in minutes"
    )
    jwt_refresh_token_expire_days: int = Field(
        default=30,
        description="Refresh token expiration in days"
    )
    
    # Password Policy
    password_min_length: int = Field(default=8, description="Minimum password length")
    password_require_uppercase: bool = Field(default=True, description="Require uppercase letter")
    password_require_lowercase: bool = Field(default=True, description="Require lowercase letter")
    password_require_digit: bool = Field(default=True, description="Require digit")
    password_require_special: bool = Field(default=False, description="Require special character")
    
    # Email Verification
    email_verification_token_expire_hours: int = Field(
        default=24,
        description="Email verification token expiration in hours"
    )
    password_reset_token_expire_hours: int = Field(
        default=1,
        description="Password reset token expiration in hours"
    )
    
    # 2FA Settings
    two_factor_code_expire_minutes: int = Field(
        default=10,
        description="2FA code expiration in minutes"
    )
    two_factor_code_length: int = Field(
        default=6,
        description="2FA code length (digits)"
    )
    
    # Rate Limiting
    rate_limit_enabled: bool = Field(
        default=True,
        description="Enable rate limiting for auth endpoints"
    )
    login_rate_limit: str = Field(
        default="5/minute",
        description="Rate limit for login attempts"
    )
    register_rate_limit: str = Field(
        default="3/hour",
        description="Rate limit for registration"
    )
    password_reset_rate_limit: str = Field(
        default="3/hour",
        description="Rate limit for password reset requests"
    )
    
    # Email Service (SMTP)
    smtp_host: str = Field(default="smtp.gmail.com", description="SMTP server host")
    smtp_port: int = Field(default=587, description="SMTP server port")
    smtp_user: Optional[str] = Field(default=None, description="SMTP username")
    smtp_password: Optional[str] = Field(default=None, description="SMTP password")
    smtp_from_email: str = Field(
        default="noreply@resomix.com",
        description="From email address"
    )
    smtp_from_name: str = Field(
        default="Resomix",
        description="From name"
    )
    
    # Frontend URLs (for email links)
    frontend_url: str = Field(
        default="https://resomix.com",
        description="Frontend URL for email verification/reset links"
    )
    
    def __init__(self, **data):
        # ... existing __init__ code ...
        
        # Add new environment variable mappings
        new_env_vars = {
            "JWT_SECRET_KEY": "jwt_secret_key",
            "JWT_ALGORITHM": "jwt_algorithm",
            "JWT_ACCESS_TOKEN_EXPIRE_MINUTES": "jwt_access_token_expire_minutes",
            "JWT_REFRESH_TOKEN_EXPIRE_DAYS": "jwt_refresh_token_expire_days",
            "SMTP_HOST": "smtp_host",
            "SMTP_PORT": "smtp_port",
            "SMTP_USER": "smtp_user",
            "SMTP_PASSWORD": "smtp_password",
            "SMTP_FROM_EMAIL": "smtp_from_email",
            "FRONTEND_URL": "frontend_url",
        }
        
        for env_key, config_key in new_env_vars.items():
            env_value = os.getenv(env_key)
            if env_value is not None:
                # Handle integer conversion
                if config_key in ["jwt_access_token_expire_minutes", "jwt_refresh_token_expire_days", "smtp_port"]:
                    try:
                        env_overrides[config_key] = int(env_value)
                    except ValueError:
                        pass
                else:
                    env_overrides[config_key] = env_value
        
        # Continue with existing initialization...
```

---

## 5. Core Security Layer

### 5.1 Create `app/core/security.py`

Replace the placeholder file with:

```python
"""
Security Utilities & Authentication
====================================

Core security functions for password hashing, JWT token management,
and authentication helpers using industry best practices.

Version: 3.2.0
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import secrets
import re
from passlib.context import CryptContext
from jose import JWTError, jwt
from fastapi import HTTPException, status

from app.core.config import settings


# ============================================================================
# Password Hashing (using bcrypt - OWASP recommended)
# ============================================================================

# Initialize password context with bcrypt
# rounds=12 is a good balance between security and performance
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)


def hash_password(password: str) -> str:
    """
    Hash a password using bcrypt.
    
    Args:
        password: Plain text password
        
    Returns:
        Hashed password string
    """
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against its hash.
    
    Args:
        plain_password: Plain text password to verify
        hashed_password: Hashed password from database
        
    Returns:
        True if password matches, False otherwise
    """
    return pwd_context.verify(plain_password, hashed_password)


# ============================================================================
# JWT Token Management
# ============================================================================

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """
    Create JWT access token.
    
    Args:
        data: Payload data to encode (should include 'sub' for user identifier)
        expires_delta: Optional custom expiration time
        
    Returns:
        Encoded JWT token string
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.jwt_access_token_expire_minutes)
    
    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow(),
        "type": "access"
    })
    
    encoded_jwt = jwt.encode(
        to_encode,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm
    )
    return encoded_jwt


def create_refresh_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """
    Create JWT refresh token (longer-lived).
    
    Args:
        data: Payload data to encode
        expires_delta: Optional custom expiration time
        
    Returns:
        Encoded JWT refresh token string
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=settings.jwt_refresh_token_expire_days)
    
    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow(),
        "type": "refresh"
    })
    
    encoded_jwt = jwt.encode(
        to_encode,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm
    )
    return encoded_jwt


def decode_token(token: str) -> Dict[str, Any]:
    """
    Decode and verify JWT token.
    
    Args:
        token: JWT token string
        
    Returns:
        Decoded token payload
        
    Raises:
        HTTPException: If token is invalid or expired
    """
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm]
        )
        return payload
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ============================================================================
# Token Generation Utilities
# ============================================================================

def generate_verification_token() -> str:
    """Generate secure random token for email verification."""
    return secrets.token_urlsafe(32)


def generate_reset_token() -> str:
    """Generate secure random token for password reset."""
    return secrets.token_urlsafe(32)


def generate_2fa_code(length: int = 6) -> str:
    """
    Generate numeric 2FA code.
    
    Args:
        length: Code length (default 6 digits)
        
    Returns:
        Numeric code string
    """
    # Generate cryptographically secure random digits
    return ''.join([str(secrets.randbelow(10)) for _ in range(length)])


def generate_session_id() -> str:
    """Generate unique session ID."""
    import uuid
    return str(uuid.uuid4())


# ============================================================================
# Password Validation
# ============================================================================

def validate_password_strength(password: str) -> tuple[bool, Optional[str]]:
    """
    Validate password against security policy.
    
    Args:
        password: Password to validate
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    if len(password) < settings.password_min_length:
        return False, f"Password must be at least {settings.password_min_length} characters long"
    
    if settings.password_require_uppercase and not re.search(r'[A-Z]', password):
        return False, "Password must contain at least one uppercase letter"
    
    if settings.password_require_lowercase and not re.search(r'[a-z]', password):
        return False, "Password must contain at least one lowercase letter"
    
    if settings.password_require_digit and not re.search(r'\d', password):
        return False, "Password must contain at least one digit"
    
    if settings.password_require_special and not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        return False, "Password must contain at least one special character"
    
    return True, None


# ============================================================================
# Username Validation
# ============================================================================

def validate_username(username: str) -> tuple[bool, Optional[str]]:
    """
    Validate username format.
    
    Args:
        username: Username to validate
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    if len(username) < 3:
        return False, "Username must be at least 3 characters long"
    
    if len(username) > 50:
        return False, "Username cannot exceed 50 characters"
    
    # Allow alphanumeric, underscores, and hyphens
    if not re.match(r'^[a-zA-Z0-9_-]+$', username):
        return False, "Username can only contain letters, numbers, underscores, and hyphens"
    
    # Must start with a letter
    if not username[0].isalpha():
        return False, "Username must start with a letter"
    
    return True, None
```

---

## 6. Repository Layer

### 6.1 Create `app/repositories/user_repository.py`

```python
"""
User Repository
===============

Repository for user authentication and management operations.
Handles CRUD operations for User and related auth tables.

Version: 3.2.0
"""

from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timedelta
from sqlalchemy import select, and_, or_, delete, update
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.models.user import (
    User,
    EmailVerificationToken,
    PasswordResetToken,
    TwoFactorEmailCode,
    UserSession
)
from app.repositories.base_repository import BaseRepository
from app.core.security import hash_password, generate_session_id


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


class EmailVerificationTokenRepository:
    """Repository for email verification tokens"""
    
    async def async_create_token(
        self,
        db: AsyncSession,
        user_id: int,
        token: str,
        expires_at: datetime
    ) -> EmailVerificationToken:
        """Create email verification token"""
        # Delete existing token for user (one token per user)
        await db.execute(
            delete(EmailVerificationToken).where(EmailVerificationToken.user_id == user_id)
        )
        
        verification_token = EmailVerificationToken(
            user_id=user_id,
            token=token,
            expires_at=expires_at
        )
        
        db.add(verification_token)
        await db.commit()
        await db.refresh(verification_token)
        return verification_token
    
    async def async_get_by_token(
        self,
        db: AsyncSession,
        token: str
    ) -> Optional[EmailVerificationToken]:
        """Get verification token by token string"""
        stmt = select(EmailVerificationToken).where(EmailVerificationToken.token == token)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()
    
    async def async_delete_token(self, db: AsyncSession, user_id: int) -> bool:
        """Delete verification token for user"""
        stmt = delete(EmailVerificationToken).where(EmailVerificationToken.user_id == user_id)
        result = await db.execute(stmt)
        await db.commit()
        return result.rowcount > 0


class PasswordResetTokenRepository:
    """Repository for password reset tokens"""
    
    async def async_create_token(
        self,
        db: AsyncSession,
        user_id: int,
        token: str,
        expires_at: datetime
    ) -> PasswordResetToken:
        """Create password reset token"""
        # Delete existing token for user
        await db.execute(
            delete(PasswordResetToken).where(PasswordResetToken.user_id == user_id)
        )
        
        reset_token = PasswordResetToken(
            user_id=user_id,
            token=token,
            expires_at=expires_at,
            consumed_at=None
        )
        
        db.add(reset_token)
        await db.commit()
        await db.refresh(reset_token)
        return reset_token
    
    async def async_get_by_token(
        self,
        db: AsyncSession,
        token: str
    ) -> Optional[PasswordResetToken]:
        """Get reset token by token string"""
        stmt = select(PasswordResetToken).where(PasswordResetToken.token == token)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()
    
    async def async_consume_token(
        self,
        db: AsyncSession,
        token: str
    ) -> Optional[PasswordResetToken]:
        """Mark token as consumed"""
        reset_token = await self.async_get_by_token(db, token)
        if reset_token:
            reset_token.consumed_at = datetime.utcnow()
            await db.commit()
            await db.refresh(reset_token)
        return reset_token
    
    async def async_delete_token(self, db: AsyncSession, user_id: int) -> bool:
        """Delete reset token for user"""
        stmt = delete(PasswordResetToken).where(PasswordResetToken.user_id == user_id)
        result = await db.execute(stmt)
        await db.commit()
        return result.rowcount > 0


class TwoFactorCodeRepository:
    """Repository for 2FA email codes"""
    
    async def async_create_code(
        self,
        db: AsyncSession,
        user_id: int,
        code: str,
        purpose: str,
        expires_at: datetime
    ) -> TwoFactorEmailCode:
        """Create 2FA code"""
        # Delete existing codes for this user and purpose
        await db.execute(
            delete(TwoFactorEmailCode).where(
                and_(
                    TwoFactorEmailCode.user_id == user_id,
                    TwoFactorEmailCode.purpose == purpose
                )
            )
        )
        
        two_fa_code = TwoFactorEmailCode(
            user_id=user_id,
            code=code,
            purpose=purpose,
            expires_at=expires_at,
            consumed_at=None
        )
        
        db.add(two_fa_code)
        await db.commit()
        await db.refresh(two_fa_code)
        return two_fa_code
    
    async def async_verify_code(
        self,
        db: AsyncSession,
        user_id: int,
        code: str,
        purpose: str
    ) -> bool:
        """Verify 2FA code and consume it"""
        stmt = select(TwoFactorEmailCode).where(
            and_(
                TwoFactorEmailCode.user_id == user_id,
                TwoFactorEmailCode.code == code,
                TwoFactorEmailCode.purpose == purpose,
                TwoFactorEmailCode.consumed_at.is_(None),
                TwoFactorEmailCode.expires_at > datetime.utcnow()
            )
        )
        result = await db.execute(stmt)
        two_fa_code = result.scalar_one_or_none()
        
        if two_fa_code:
            two_fa_code.consumed_at = datetime.utcnow()
            await db.commit()
            return True
        
        return False
    
    async def async_cleanup_expired(self, db: AsyncSession) -> int:
        """Delete expired codes"""
        stmt = delete(TwoFactorEmailCode).where(
            TwoFactorEmailCode.expires_at < datetime.utcnow()
        )
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
```

### 6.2 Update `app/repositories/__init__.py`

Add exports for new repositories.

---

## 7. Service Layer

### 7.1 Create `app/services/auth_service.py`

**Purpose**: Main business logic for authentication operations  
**Key Methods**:
- `register_user()` - Handle registration, validate uniqueness, create user + verification token, send email
- `login_user()` - Validate credentials, check email verification, handle 2FA if enabled
- `verify_email()` - Validate token, mark email verified, delete token
- `request_password_reset()` - Generate token, send reset email
- `reset_password()` - Validate token, update password, consume token
- `enable_2fa()` / `disable_2fa()` - Toggle 2FA settings
- `send_2fa_code()` - Generate and email 2FA code
- `verify_2fa_code()` - Validate and consume 2FA code
- `refresh_access_token()` - Validate refresh token, issue new access token
- `logout()` - Revoke specific session
- `logout_all_devices()` - Revoke all user sessions

**Dependencies**: UserRepository, EmailVerificationTokenRepository, PasswordResetTokenRepository, TwoFactorCodeRepository, UserSessionRepository, EmailService  
**Security Notes**: Always hash refresh tokens before storage, validate token expiry, cleanup expired tokens periodically

---

### 7.2 Create `app/services/email_service.py`

**Purpose**: Handle all email communications  
**Key Methods**:
- `send_verification_email()` - Email with verification link
- `send_password_reset_email()` - Email with reset link
- `send_2fa_code_email()` - Email with 2FA code
- `send_welcome_email()` - Post-verification welcome

**Implementation Options**:
- Use `fastapi-mail` with HTML templates in `app/templates/emails/`
- Templates: `verification.html`, `password_reset.html`, `2fa_code.html`, `welcome.html`
- Include both HTML and plain text versions
- Use Jinja2 for template rendering with user data

**Security Notes**: Never log email content, use rate limiting, validate email addresses before sending

---

### 7.3 Create `app/services/user_service.py`

**Purpose**: User profile management and updates  
**Key Methods**:
- `get_user_profile()` - Get user info by UUID (external ID)
- `update_profile()` - Update name, language, timezone, profile picture
- `change_password()` - Require current password, validate new password
- `delete_account()` - Soft delete or hard delete based on business logic
- `get_user_sessions()` - List active sessions/devices
- `revoke_session()` - Logout specific device

**Dependencies**: UserRepository, UserSessionRepository  
**Notes**: Always use UUID for external operations, internal ID for FK operations

---

## 8. Schemas Layer

### 8.1 Create `app/schemas/auth.py`

**Required Schemas**:

**Registration**:
- `RegisterRequest` - email (EmailStr), username (3-50 chars, alphanumeric+_-), password (validated), optional name
- `RegisterResponse` - user_uuid, email, username, message

**Login**:
- `LoginRequest` - email/username (either), password
- `LoginResponse` - access_token, refresh_token, token_type="bearer", user (uuid, email, username, name)
- `TwoFactorRequiredResponse` - requires_2fa=true, session_id (temp identifier)
- `TwoFactorVerifyRequest` - session_id, code
- `TokenRefreshRequest` - refresh_token
- `TokenRefreshResponse` - access_token, token_type="bearer"

**Email Verification**:
- `EmailVerificationRequest` - token
- `ResendVerificationRequest` - email

**Password Reset**:
- `PasswordResetRequest` - email
- `PasswordResetConfirmRequest` - token, new_password
- `ChangePasswordRequest` - current_password, new_password

**User Profile**:
- `UserProfileResponse` - uuid, email, username, name, is_email_verified, is_two_factor_enabled, created_at
- `UpdateProfileRequest` - name, language, timezone, profile_picture (all optional)

**Security Notes**: Use `EmailStr` from pydantic, add password strength validators, sanitize all inputs

---

### 8.2 Update `app/schemas/__init__.py`

Add imports and exports for all auth schemas.

---

## 9. Controller Layer

### 9.1 Create `app/controllers/auth_controller.py`

**Purpose**: HTTP request handling for auth endpoints  
**Key Methods**: Match service methods but add:
- Request validation
- Response formatting using `format_response()`
- Comprehensive logging via `LoggingService`
- Error handling with proper status codes
- Extract client info (IP, user agent) from Request object

**Pattern**: Follow existing controller pattern (see `ContactController` or `FeedbackController`)  
**Logging Categories**: Use `AUTH` category, track actions like `register_success`, `login_failed`, `2fa_sent`, etc.

---

### 9.2 Create `app/controllers/user_controller.py`

**Purpose**: User profile management endpoints  
**Methods**: Profile CRUD, password change, session management  
**Auth Required**: All endpoints require valid JWT token

---

## 10. Router Layer

### 10.1 Create `app/api/routers/auth.py`

**Endpoints Structure**:

```
POST   /auth/register              - Create new account
POST   /auth/login                 - Login with email/password
POST   /auth/verify-2fa            - Complete 2FA login
POST   /auth/refresh               - Get new access token
POST   /auth/logout                - Revoke current session
POST   /auth/logout-all            - Revoke all sessions
GET    /auth/verify-email          - Verify email with token
POST   /auth/resend-verification   - Resend verification email
POST   /auth/password-reset        - Request password reset
POST   /auth/password-reset-confirm - Complete password reset
```

**Rate Limiting**: Apply `slowapi` decorators on sensitive endpoints (login, register, password reset)  
**Tags**: `["authentication"]`  
**Dependencies**: All use `get_database_session`, none require `get_api_key` (separate auth flow)

---

### 10.2 Create `app/api/routers/users.py`

**Endpoints**:
```
GET    /users/me                   - Get current user profile
PATCH  /users/me                   - Update profile
POST   /users/me/change-password   - Change password
GET    /users/me/sessions          - List active sessions
DELETE /users/me/sessions/{id}     - Revoke session
POST   /users/me/enable-2fa        - Enable 2FA
POST   /users/me/disable-2fa       - Disable 2FA
```

**Dependencies**: `get_current_user` (new dependency - validates JWT)  
**Tags**: `["users"]`

---

### 10.3 Update `app/api/routers/__init__.py`

Add new routers to `all_routers` list.

---

## 11. Middleware & Dependencies

### 11.1 Create `app/api/dependencies/auth.py` (UPDATE existing)

**Keep Existing**: `get_api_key()` function unchanged  
**Add New Functions**:

```python
# OAuth2 scheme for JWT tokens
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/auth/login",
    auto_error=False  # Don't auto-fail, we support optional auth
)

async def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_database_session)
) -> User:
    """
    Get current authenticated user from JWT token.
    REQUIRED auth - raises 401 if no valid token.
    """
    # Decode token, extract user_uuid, fetch user from DB
    # Raise HTTPException if invalid
    
async def get_current_user_optional(
    token: Optional[str] = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_database_session)
) -> Optional[User]:
    """
    Get current user if authenticated, None if anonymous.
    OPTIONAL auth - returns None for anonymous users.
    """
    # Try to decode token, return user or None
    # Don't raise exception if token missing/invalid
    
async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Get current user and verify email is verified.
    """
    # Check is_email_verified flag
    # Raise 403 if not verified
```

**Key Points**:
- Use `OAuth2PasswordBearer` from `fastapi.security`
- `auto_error=False` for optional auth support
- Always validate token expiry
- Check session revocation status
- Return User object (with UUID) for use in endpoints

---

### 11.2 Create Rate Limiting Setup

**File**: `app/api/middlewares/rate_limit.py`

**Content**:
- Initialize `SlowAPI` limiter with Redis or in-memory backend
- Create decorator for easy rate limiting
- Configure different limits per endpoint type
- Handle rate limit exceeded errors gracefully

**Usage**: Apply as decorator on auth endpoints:
```python
@limiter.limit(settings.login_rate_limit)
async def login_endpoint(...):
```

---

## 12. Integration with Existing Features

### 12.1 Update Existing Routers to Support Optional Auth

**Files to Update**: All existing routers (similarity, ratings, playlists, feedback, contact, waitlist)

**Pattern**:
```python
# OLD:
async def rate_track(
    request: Request,
    request_data: TrackRatingRequest,
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key)  # Keep this
) -> JSONResponse:
    # user_id came from request body
    
# NEW:
async def rate_track(
    request: Request,
    request_data: TrackRatingRequest,
    db: AsyncSession = Depends(get_database_session),
    api_key: str = Security(get_api_key),  # Keep for backward compat
    current_user: Optional[User] = Depends(get_current_user_optional)  # NEW
) -> JSONResponse:
    # If current_user exists, use current_user.id (internal) for DB operations
    # If current_user is None, proceed as anonymous (existing behavior)
    # Request body user_id is now optional and overridden by JWT if present
```

**Strategy**:
1. Add `current_user: Optional[User] = Depends(get_current_user_optional)` to all user-facing endpoints
2. In controller/service, prioritize JWT user over request body user_id
3. Use `current_user.id` (BIGINT internal ID) for database FK operations
4. Use `current_user.uuid` (CHAR(36)) for API responses
5. Keep all user_id fields nullable for backward compatibility

**Files to Update**:
- `app/api/routers/ratings.py` - Track and playlist ratings
- `app/api/routers/feedback.py` - Feedback submission
- `app/api/routers/contact.py` - Contact form
- `app/api/routers/waitlist.py` - Waitlist (optional)
- `app/api/routers/playlists.py` - Playlist operations
- `app/api/routers/similarity.py` - Similarity uploads

---

### 12.2 Update Controllers

**Pattern**: In each controller method, add logic:
```python
# Extract user_id for database operations
user_id_for_db = None
if current_user:
    user_id_for_db = current_user.id  # Use internal BIGINT ID
    logger.info(f"Authenticated user: {current_user.uuid}")
elif request_data.user_id:  # Fallback to request body (deprecated but supported)
    user_id_for_db = request_data.user_id
    logger.warning("Using user_id from request body (deprecated)")
```

**No Breaking Changes**: Service layer signatures stay the same, controllers handle user resolution

---

### 12.3 Update Services

**Minimal Changes**: Services already accept `user_id` parameter as Optional  
**No Modifications Needed**: Existing service methods work as-is

---

## 13. Testing Strategy

### 13.1 Unit Tests

**File**: `tests/unit/test_auth.py`

**Test Coverage**:
- Password hashing and verification
- JWT token creation and validation
- Token expiry handling
- 2FA code generation and verification
- Session management (create, revoke, cleanup)
- Username/password validation functions

**Libraries**: pytest, pytest-asyncio

---

### 13.2 Integration Tests

**File**: `tests/integration/test_auth_flow.py`

**Test Scenarios**:
- Complete registration flow (register → verify email → login)
- Login with 2FA enabled
- Password reset flow (request → verify token → reset)
- Refresh token flow
- Session revocation
- Invalid token handling
- Expired token handling
- Duplicate email/username registration

**Use TestClient** from FastAPI for endpoint testing

---

### 13.3 Security Tests

**File**: `tests/security/test_auth_security.py`

**Test Cases**:
- Brute force protection (rate limiting)
- SQL injection attempts in login
- XSS in registration fields
- Token replay attacks
- Expired token rejection
- Revoked session rejection
- Weak password rejection
- Email enumeration protection

---

## 14. Security Best Practices

### 14.1 Password Security

✅ **Use bcrypt with 12 rounds** (already configured in security.py)  
✅ **Validate password strength** before hashing  
✅ **Never log passwords** or hashes  
✅ **Require current password** for password changes  
✅ **Rate limit** password reset requests (3/hour)  
✅ **Invalidate all sessions** on password change

---

### 14.2 JWT Security

✅ **Keep tokens short-lived** (30 min access, 30 day refresh)  
✅ **Use HS256 algorithm** (symmetric) or RS256 (asymmetric) for production  
✅ **Include minimal claims** in JWT (sub, exp, iat, type)  
✅ **Store refresh tokens hashed** in database  
✅ **Implement token rotation** on refresh  
✅ **Validate token type** (access vs refresh)  
✅ **Use HTTPS only** for token transmission

---

### 14.3 Session Management

✅ **Track device info** (user agent, IP) for security monitoring  
✅ **Allow session revocation** (logout from specific device)  
✅ **Cleanup expired sessions** via background task  
✅ **Limit concurrent sessions** per user (optional, e.g., max 5 devices)  
✅ **Log suspicious activity** (login from new location/device)

---

### 14.4 Email Security

✅ **Use secure tokens** (32+ bytes, cryptographically secure)  
✅ **Time-limited tokens** (1 hour for reset, 24 hours for verification)  
✅ **One-time use tokens** (mark as consumed)  
✅ **Rate limit email sending** to prevent abuse  
✅ **Don't reveal if email exists** (same response for valid/invalid emails in password reset)

---

### 14.5 2FA Security

✅ **Use 6-digit codes** minimum  
✅ **10-minute expiry** for codes  
✅ **One-time use codes** (mark as consumed)  
✅ **Rate limit 2FA requests** (5/minute)  
✅ **Clear codes on successful use**  
✅ **Store purpose** (login vs password_change) separately

---

### 14.6 Rate Limiting Configuration

**Critical Endpoints** (use `slowapi`):
- Login: `5/minute` per IP
- Register: `3/hour` per IP
- Password Reset: `3/hour` per IP
- 2FA Send: `5/minute` per user
- Email Verification Resend: `3/hour` per user

**Implementation**:
```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
```

---

## 15. Deployment Checklist

### 15.1 Environment Variables

**Required in Production** (`.env` file):
```bash
# JWT
JWT_SECRET_KEY=<generate-with-openssl-rand-hex-32>
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=30

# SMTP (use your email provider)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-specific-password
SMTP_FROM_EMAIL=noreply@resomix.com

# Frontend
FRONTEND_URL=https://resomix.com

# Rate Limiting (if using Redis)
REDIS_URL=redis://localhost:6379/0
```

**Generate Secure JWT Secret**:
```bash
openssl rand -hex 32
```

---

### 15.2 Database Migration

**File**: `database/migrations/002_add_user_auth.sql`

**Steps**:
1. Run the users/auth tables creation (already in schema)
2. Verify tables created: `users`, `email_verification_tokens`, `password_reset_tokens`, `two_factor_email_codes`, `user_sessions`
3. Create default roles if using RBAC
4. Test foreign key constraints

**Command**:
```bash
python -m database.manage migrate
```

---

### 15.3 Security Hardening

**Before Production**:

1. **HTTPS Only**: Enforce HTTPS in production, set `Secure` and `HttpOnly` flags on cookies
2. **CORS**: Update allowed origins to production domains only
3. **Secrets**: Rotate all default secrets (JWT, SMTP passwords)
4. **Headers**: Add security headers (HSTS, CSP, X-Frame-Options)
5. **Logging**: Never log passwords, tokens, or sensitive data
6. **Error Messages**: Don't reveal if user exists in login/reset (timing-safe comparisons)
7. **Input Validation**: Sanitize all inputs, use Pydantic validators
8. **Dependencies**: Pin versions in requirements.txt, audit for vulnerabilities

---

### 15.4 Monitoring & Logging

**Track These Events**:
- Registration attempts (success/failure)
- Login attempts (success/failure, track IP for suspicious activity)
- Password changes
- 2FA enable/disable
- Session creation/revocation
- Failed authentication attempts (potential brute force)
- Email verification status changes

**Use Existing LoggingService**: Already supports correlation IDs, metrics, categorization - just add AUTH category logs

---

## 16. Implementation Order (Step-by-Step)

### Phase 1: Core Foundation (Day 1-2)
1. ✅ Install dependencies
2. ✅ Update database schema, run migration
3. ✅ Create User models (completed above)
4. ✅ Update config with JWT/SMTP settings
5. ✅ Implement `app/core/security.py` (completed above)
6. ✅ Create user repositories (completed above)

### Phase 2: Basic Auth (Day 3-4)
7. Create `auth_service.py` - register, login, refresh (no 2FA first)
8. Create `email_service.py` - basic email sending
9. Create `auth.py` schemas - register, login, token refresh
10. Create `auth_controller.py` - basic endpoints
11. Create `auth.py` router - register, login, refresh, logout
12. **Test**: Registration, login, token refresh work

### Phase 3: Email Verification (Day 5)
13. Add email verification to `auth_service.py`
14. Create email templates
15. Add verification endpoints to router
16. **Test**: Email verification flow

### Phase 4: Password Reset (Day 6)
17. Add password reset to `auth_service.py`
18. Create reset email template
19. Add reset endpoints to router
20. **Test**: Password reset flow

### Phase 5: 2FA (Day 7)
21. Add 2FA code generation and verification to `auth_service.py`
22. Update login flow to handle 2FA
23. Create 2FA email template
24. Add 2FA endpoints
25. **Test**: 2FA login flow

### Phase 6: Integration (Day 8-9)
26. Update existing routers with `get_current_user_optional`
27. Update controllers to use JWT user when available
28. **Test**: All existing features work with both auth modes

### Phase 7: Profiles & Sessions (Day 10)
29. Create `user_service.py`
30. Create `user_controller.py`
31. Create `users.py` router
32. **Test**: Profile management, session management

### Phase 8: Polish & Security (Day 11-12)
33. Add rate limiting
34. Add security headers
35. Comprehensive testing
36. Security audit
37. Documentation

---

## 17. Key Files Summary

### New Files to Create (18 total):

**Models** (1):
- User models already in `app/models/user.py` - just add User, tokens, sessions

**Core** (1):
- `app/core/security.py` ✅ (already specified above)

**Repositories** (1):
- `app/repositories/user_repository.py` ✅ (already specified above)

**Services** (3):
- `app/services/auth_service.py` - Main auth logic
- `app/services/email_service.py` - Email sending
- `app/services/user_service.py` - Profile management

**Schemas** (1):
- `app/schemas/auth.py` - All auth-related request/response schemas

**Controllers** (2):
- `app/controllers/auth_controller.py` - Auth HTTP handlers
- `app/controllers/user_controller.py` - User profile HTTP handlers

**Routers** (2):
- `app/api/routers/auth.py` - Auth endpoints
- `app/api/routers/users.py` - User profile endpoints

**Middleware** (1):
- `app/api/middlewares/rate_limit.py` - Rate limiting setup

**Templates** (4):
- `app/templates/emails/verification.html`
- `app/templates/emails/password_reset.html`
- `app/templates/emails/2fa_code.html`
- `app/templates/emails/welcome.html`

**Migrations** (1):
- `database/migrations/002_add_user_auth.sql` - Create auth tables

**Tests** (1):
- `tests/integration/test_auth_flow.py` - Integration tests

### Files to Update (8):

- `app/models/__init__.py` - Add User model imports
- `app/schemas/__init__.py` - Add auth schema imports
- `app/api/routers/__init__.py` - Add new routers
- `app/core/config.py` - Add JWT/email config
- `app/api/dependencies/auth.py` - Add JWT dependencies
- `requirements.txt` - Add auth dependencies
- All existing routers (6 files) - Add optional user context

---

## 18. Critical Security Considerations

### 🔐 Passwords
- **Library**: `passlib[bcrypt]` - battle-tested, OWASP recommended
- **Rounds**: 12 (good balance)
- **Never**: Log, expose, or transmit plaintext passwords

### 🎫 JWT Tokens
- **Library**: `python-jose[cryptography]` - FastAPI recommended
- **Algorithm**: HS256 (symmetric) or RS256 (asymmetric)
- **Storage**: Never store access tokens, only hash refresh tokens
- **Transmission**: HTTPS only, Authorization header

### 📧 Email Tokens
- **Generation**: `secrets.token_urlsafe(32)` - cryptographically secure
- **Expiry**: Short (1-24 hours)
- **One-time**: Mark as consumed after use
- **Cleanup**: Background task to delete expired tokens

### 🔒 Sessions
- **Tracking**: User agent, IP address for security
- **Revocation**: Support logout from specific device
- **Cleanup**: Delete expired/old sessions regularly
- **Limit**: Optional max concurrent sessions per user

### 🚦 Rate Limiting
- **Library**: `slowapi` - FastAPI integration
- **Backend**: Redis recommended for production, in-memory for dev
- **Key**: By IP address for anonymous, by user_id for authenticated
- **Bypass**: Admin endpoints should have higher limits or be exempt

---

## 19. Email Template Examples

### Structure:
```
app/templates/emails/
  ├── base.html           (common layout)
  ├── verification.html   (email confirmation)
  ├── password_reset.html (password reset)
  ├── 2fa_code.html       (2FA code)
  └── welcome.html        (welcome message)
```

**Use Jinja2**: Variable interpolation, conditional blocks  
**Include**: Plain text versions for email clients that don't support HTML  
**Branding**: Match Resomix branding, include logo, social links  
**Links**: Use `settings.frontend_url` for all links

---

## 20. Migration from Anonymous to Authenticated

**Scenario**: User has been using service anonymously, now wants to register

**Options**:

**Option A - Fresh Start** (Simplest):
- User registers, starts fresh
- Previous anonymous data not linked
- Pros: Simple, clean
- Cons: User loses history

**Option B - Claim Existing Data** (Complex):
- During registration, ask for email used in anonymous submissions
- Backend links feedback/ratings/playlists to new user account
- Requires: Email tracking in anonymous operations, verification step
- Pros: User retains history
- Cons: Complex, potential security issues

**Recommendation**: Start with Option A, add Option B later if needed

---

## 21. FINAL CHECKLIST

### Before Going Live:

- [ ] All dependencies installed and versions pinned
- [ ] Database migration applied successfully
- [ ] JWT_SECRET_KEY generated and set in production
- [ ] SMTP credentials configured and tested
- [ ] Rate limiting enabled and tested
- [ ] HTTPS enforced (no HTTP in production)
- [ ] CORS configured for production domains only
- [ ] Security headers added
- [ ] All tokens properly validated (expiry, type, revocation)
- [ ] Error messages don't leak sensitive info
- [ ] Logging excludes sensitive data (passwords, tokens)
- [ ] Email templates tested and branded
- [ ] Integration tests passing
- [ ] Load testing for auth endpoints
- [ ] Documentation updated (API docs, README)
- [ ] Frontend integration tested

---

## 22. Quick Reference: Authentication Flow Diagrams

### Registration Flow:
```
1. POST /auth/register {email, username, password}
2. Validate input, check uniqueness
3. Hash password, create user (is_email_verified=False)
4. Generate verification token, save to DB
5. Send verification email
6. Return success (201)

7. User clicks email link → GET /auth/verify-email?token=xxx
8. Validate token, mark email verified
9. Delete token, return success
```

### Login Flow (No 2FA):
```
1. POST /auth/login {email, password}
2. Get user by email
3. Verify password
4. Check is_email_verified
5. Generate access + refresh tokens
6. Create session, hash and store refresh token
7. Return tokens + user info (200)
```

### Login Flow (With 2FA):
```
1. POST /auth/login {email, password}
2. Validate credentials
3. Check is_two_factor_enabled → TRUE
4. Generate 6-digit code, save to DB
5. Send 2FA email
6. Return {requires_2fa: true, temp_session_id}

7. POST /auth/verify-2fa {temp_session_id, code}
8. Validate code
9. Generate access + refresh tokens
10. Create session
11. Return tokens + user info (200)
```

### Token Refresh Flow:
```
1. POST /auth/refresh {refresh_token}
2. Decode refresh token
3. Validate type=refresh, check expiry
4. Get session, verify not revoked
5. Verify refresh_token hash matches
6. Generate NEW access + refresh tokens
7. Update session with new refresh token hash
8. Return new tokens (200)
```

### Password Reset Flow:
```
1. POST /auth
