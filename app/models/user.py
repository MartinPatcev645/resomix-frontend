"""
User Role Models
================

This module defines the Role, Permission, RolePermission, and UserRole SQLAlchemy models
for the Resomix application. It handles user authorization and access control through
role-based permissions and user role assignments.

Provides comprehensive user access control modeling with many-to-many relationships
between users, roles, and permissions for the audio similarity system.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

# UserRole, Role, Permission models
from sqlalchemy import (
    Column,
    Integer,
    BigInteger,
    String,
    Boolean,
    Enum,
    ForeignKey,
    DateTime,
)
from sqlalchemy.orm import relationship
from . import Base
from sqlalchemy.sql import func
import uuid as uuid_lib


class Role(Base):
    """
    Role model representing the roles table

    Schema from SQL:
    CREATE TABLE IF NOT EXISTS roles (
        id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name        VARCHAR(50)  NOT NULL UNIQUE,
        description VARCHAR(255)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """

    __tablename__ = "roles"

    # Primary key
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)

    # Fields
    name = Column(String(50), nullable=False, unique=True)
    description = Column(String(255), nullable=True)

    # Relationships
    role_permissions = relationship(
        "RolePermission", back_populates="role", cascade="all, delete-orphan"
    )
    user_roles = relationship(
        "UserRole", back_populates="role", cascade="all, delete-orphan"
    )
    permissions = relationship(
        "Permission", secondary="role_permissions", viewonly=True
    )

    def __repr__(self):
        return f"<Role(id={self.id}, name='{self.name}')>"


class Permission(Base):
    """
    Permission model representing the permissions table

    Schema from SQL:
    CREATE TABLE IF NOT EXISTS permissions (
        id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name        VARCHAR(100) NOT NULL UNIQUE,
        description VARCHAR(255)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """

    __tablename__ = "permissions"

    # Primary key
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)

    # Fields
    name = Column(String(100), nullable=False, unique=True)
    description = Column(String(255), nullable=True)

    # Relationships
    role_permissions = relationship(
        "RolePermission", back_populates="permission", cascade="all, delete-orphan"
    )
    roles = relationship("Role", secondary="role_permissions", viewonly=True)

    def __repr__(self):
        return f"<Permission(id={self.id}, name='{self.name}')>"


class RolePermission(Base):
    """
    RolePermission model representing the role_permissions many-to-many table

    Schema from SQL:
    CREATE TABLE IF NOT EXISTS role_permissions (
        role_id       INT UNSIGNED NOT NULL,
        permission_id INT UNSIGNED NOT NULL,
        PRIMARY KEY (role_id, permission_id),
        FOREIGN KEY (role_id)       REFERENCES roles(id)       ON DELETE CASCADE,
        FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """

    __tablename__ = "role_permissions"

    # Composite primary key
    role_id = Column(
        Integer, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True
    )
    permission_id = Column(
        Integer, ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True
    )

    # Relationships
    role = relationship("Role", back_populates="role_permissions")
    permission = relationship("Permission", back_populates="role_permissions")

    def __repr__(self):
        return f"<RolePermission(role_id={self.role_id}, permission_id={self.permission_id})>"


class UserRole(Base):
    """
    UserRole model representing the user_roles table

    Schema from SQL:
    CREATE TABLE IF NOT EXISTS user_roles (
        user_id BIGINT UNSIGNED NOT NULL,
        role_id INT UNSIGNED NOT NULL,
        PRIMARY KEY (user_id, role_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """

    __tablename__ = "user_roles"

    # Composite primary key
    user_id = Column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    role_id = Column(
        Integer, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True
    )

    # Relationships
    role = relationship("Role", back_populates="user_roles")
    user = relationship("User", back_populates="roles")

    def __repr__(self):
        return f"<UserRole(user_id={self.user_id}, role_id={self.role_id})>"


# =========================================================================
# User & Authentication Models (Step 3.1 - AUTH_IMPLEMENTATION_GUIDE)
# =========================================================================


class User(Base):
    """User model representing the users table (dual ID system)"""

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
    language = Column(String(10), nullable=True, default="en")
    timezone = Column(String(50), nullable=True, default="UTC")

    # Security flags
    is_email_verified = Column(Boolean, nullable=False, default=False)
    is_two_factor_enabled = Column(Boolean, nullable=False, default=False)
    two_factor_method = Column(
        Enum("email", "app", name="two_factor_method"), nullable=False, default="email"
    )

    # Timestamps
    created_at = Column(
        DateTime, nullable=False, server_default=func.current_timestamp()
    )
    updated_at = Column(
        DateTime,
        nullable=False,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
    )

    # Relationships (defined later to avoid circular refs)
    sessions = relationship(
        "UserSession", back_populates="user", cascade="all, delete-orphan"
    )
    roles = relationship(
        "UserRole", back_populates="user", cascade="all, delete-orphan"
    )
    operation_limits = relationship(
        "UserOperationLimit",
        back_populates="user",
        cascade="all, delete-orphan",
        foreign_keys="UserOperationLimit.user_id",
    )
    spotify_app_association = relationship(
        "UserSpotifyApp",
        back_populates="user",
        cascade="all, delete-orphan",
        foreign_keys="UserSpotifyApp.user_id",
        uselist=False,  # One-to-one relationship
    )
    uploaded_tracks = relationship(
        "Track",
        back_populates="uploader",
        cascade="all, delete-orphan",
        foreign_keys="Track.user_id",
    )

    def __init__(self, **kwargs):
        if "uuid" not in kwargs:
            kwargs["uuid"] = str(uuid_lib.uuid4())
        super().__init__(**kwargs)

    def __repr__(self):
        return f"<User(id={self.id}, uuid='{self.uuid}', email='{self.email}', username='{self.username}')>"


class EmailVerificationToken(Base):
    """Email verification tokens"""

    __tablename__ = "email_verification_tokens"

    user_id = Column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    token = Column(
        String(64), nullable=False, unique=True, index=True
    )  # Increased from 36 to 64 for token_urlsafe(32)
    expires_at = Column(DateTime, nullable=False)

    user = relationship("User", foreign_keys=[user_id])

    def __repr__(self):
        return f"<EmailVerificationToken(user_id={self.user_id}, token='{self.token[:8]}...')>"


class PasswordResetToken(Base):
    """Password reset tokens"""

    __tablename__ = "password_reset_tokens"

    user_id = Column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    token = Column(
        String(64), nullable=False, unique=True, index=True
    )  # Increased from 36 to 64 for token_urlsafe(32)
    expires_at = Column(DateTime, nullable=False)
    consumed_at = Column(DateTime, nullable=True)

    user = relationship("User", foreign_keys=[user_id])

    def __repr__(self):
        return f"<PasswordResetToken(user_id={self.user_id}, consumed={self.consumed_at is not None})>"


class TwoFactorEmailCode(Base):
    """2FA email codes"""

    __tablename__ = "two_factor_email_codes"

    user_id = Column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    code = Column(String(10), nullable=False, primary_key=True)
    purpose = Column(
        Enum("login", "password_change", name="two_factor_purpose"),
        nullable=False,
        default="login",
    )
    expires_at = Column(DateTime, nullable=False)
    consumed_at = Column(DateTime, nullable=True)

    user = relationship("User", foreign_keys=[user_id])

    def __repr__(self):
        return f"<TwoFactorEmailCode(user_id={self.user_id}, purpose='{self.purpose}')>"


class UserSession(Base):
    """User sessions for refresh tokens and device tracking"""

    __tablename__ = "user_sessions"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    user_id = Column(
        BigInteger,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    session_id = Column(String(36), nullable=False, unique=True, index=True)
    refresh_token_hash = Column(String(255), nullable=True)

    # Device tracking
    user_agent = Column(String(255), nullable=True)
    ip_address = Column(String(45), nullable=True)

    # Session lifecycle
    created_at = Column(
        DateTime, nullable=False, server_default=func.current_timestamp()
    )
    expires_at = Column(DateTime, nullable=True, index=True)
    revoked_at = Column(DateTime, nullable=True, index=True)

    user = relationship("User", back_populates="sessions")

    def __repr__(self):
        return f"<UserSession(id={self.id}, user_id={self.user_id}, revoked={self.revoked_at is not None})>"


class UserAuthProvider(Base):
    """OAuth/Social login providers (future use)"""

    __tablename__ = "user_auth_providers"

    user_id = Column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    provider = Column(String(50), nullable=False, primary_key=True)
    provider_uid = Column(String(100), nullable=False)

    __table_args__ = ({"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4"},)

    def __repr__(self):
        return f"<UserAuthProvider(user_id={self.user_id}, provider='{self.provider}')>"


# =========================================================================
