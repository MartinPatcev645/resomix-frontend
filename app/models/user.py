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
    String,
    Boolean,
    Enum,
    ForeignKey,
    DateTime,
    CHAR,
    text
)
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.dialects import mysql
from . import Base
from sqlalchemy.sql import func
from typing import List, Optional
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
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    # Primary key
    id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True, index=True, autoincrement=True)

    # Fields
    name: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Relationships
    role_permissions: Mapped[List["RolePermission"]] = relationship(
        "RolePermission", back_populates="role", cascade="all, delete-orphan"
    )
    user_roles: Mapped[List["UserRole"]] = relationship(
        "UserRole", back_populates="role", cascade="all, delete-orphan"
    )
    permissions: Mapped[List["Permission"]] = relationship(
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
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    # Primary key
    id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True, index=True, autoincrement=True)

    # Fields
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Relationships
    role_permissions: Mapped[List["RolePermission"]] = relationship(
        "RolePermission", back_populates="permission", cascade="all, delete-orphan"
    )
    roles: Mapped[List["Role"]] = relationship("Role", secondary="role_permissions", viewonly=True)

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
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    # Composite primary key
    role_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True), ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True
    )
    permission_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True), ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True
    )

    # Relationships
    role: Mapped["Role"] = relationship("Role", back_populates="role_permissions")
    permission: Mapped["Permission"] = relationship("Permission", back_populates="role_permissions")

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
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    # Composite primary key
    user_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    role_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True), ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True
    )

    # Relationships
    role: Mapped["Role"] = relationship("Role", back_populates="user_roles")
    user: Mapped["User"] = relationship("User", back_populates="roles")

    def __repr__(self):
        return f"<UserRole(user_id={self.user_id}, role_id={self.role_id})>"


# =========================================================================
# User & Authentication Models (Step 3.1 - AUTH_IMPLEMENTATION_GUIDE)
# =========================================================================


class User(Base):
    """User model representing the users table (dual ID system)"""

    __tablename__ = "users"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    # Primary keys
    id: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), primary_key=True, index=True, autoincrement=True)
    uuid: Mapped[str] = mapped_column(CHAR(36), nullable=False, unique=True, index=True)

    # Authentication
    username: Mapped[str] = mapped_column(String(50), nullable=False, unique=True, index=True)
    email: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)

    # Profile
    name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    profile_picture: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    language: Mapped[Optional[str]] = mapped_column(String(10), nullable=True, default="en")
    timezone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, default="UTC")

    # Security flags
    is_email_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_two_factor_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    two_factor_method: Mapped[str] = mapped_column(
        Enum("email", "app", name="two_factor_method"), nullable=False, default="email"
    )

    # Stripe Integration
    stripe_customer_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, unique=True)

    # Timestamps
    created_at: Mapped[DateTime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp()
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
    )

    # Relationships
    sessions: Mapped[List["UserSession"]] = relationship(
        "UserSession", back_populates="user", cascade="all, delete-orphan"
    )
    roles: Mapped[List["UserRole"]] = relationship(
        "UserRole", back_populates="user", cascade="all, delete-orphan"
    )
    operation_limits: Mapped[List["UserOperationLimit"]] = relationship(
        "UserOperationLimit",
        back_populates="user",
        cascade="all, delete-orphan",
        foreign_keys="UserOperationLimit.user_id",
    )
    spotify_app_association: Mapped[Optional["UserSpotifyApp"]] = relationship(
        "UserSpotifyApp",
        back_populates="user",
        cascade="all, delete-orphan",
        foreign_keys="UserSpotifyApp.user_id",
        uselist=False,
    )
    uploaded_tracks: Mapped[List["Track"]] = relationship(
        "Track",
        back_populates="uploader",
        cascade="all, delete-orphan",
        foreign_keys="Track.user_id",
    )
    tokens: Mapped[List["UserToken"]] = relationship(
        "UserToken", back_populates="user", cascade="all, delete-orphan"
    )

    def __init__(self, **kwargs):
        if "uuid" not in kwargs:
            kwargs["uuid"] = str(uuid_lib.uuid4())
        super().__init__(**kwargs)

    def __repr__(self):
        return f"<User(id={self.id}, uuid='{self.uuid}', email='{self.email}', username='{self.username}')>"


class UserToken(Base):
    """Consolidated user tokens (email verification, password reset, 2fa)"""

    __tablename__ = "user_tokens"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    id: Mapped[int] = mapped_column(mysql.BIGINT(unsigned=True), primary_key=True, index=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    token: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    token_type: Mapped[str] = mapped_column(
        Enum("email_verification", "password_reset", "2fa", name="user_token_type"),
        nullable=False,
    )
    expires_at: Mapped[DateTime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp()
    )

    user: Mapped["User"] = relationship("User", back_populates="tokens")

    def __repr__(self):
        return f"<UserToken(user_id={self.user_id}, type='{self.token_type}', token='{self.token[:8]}...')>"


class UserSession(Base):
    """User sessions for refresh tokens and device tracking"""

    __tablename__ = "user_sessions"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    id: Mapped[int] = mapped_column(mysql.BIGINT(unsigned=True), primary_key=True, index=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    session_id: Mapped[str] = mapped_column(CHAR(36), nullable=False, unique=True, index=True)
    refresh_token_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Device tracking
    user_agent: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)

    # Session lifecycle
    created_at: Mapped[DateTime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp()
    )
    expires_at: Mapped[Optional[DateTime]] = mapped_column(DateTime, nullable=True, index=True)
    revoked_at: Mapped[Optional[DateTime]] = mapped_column(DateTime, nullable=True, index=True)

    user: Mapped["User"] = relationship("User", back_populates="sessions")

    def __repr__(self):
        return f"<UserSession(id={self.id}, user_id={self.user_id}, revoked={self.revoked_at is not None})>"


class UserAuthProvider(Base):
    """OAuth/Social login providers (future use)"""

    __tablename__ = "user_auth_providers"
    __table_args__ = (
        {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )

    user_id: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    provider: Mapped[str] = mapped_column(String(50), nullable=False, primary_key=True)
    provider_uid: Mapped[str] = mapped_column(String(100), nullable=False)

    def __repr__(self):
        return f"<UserAuthProvider(user_id={self.user_id}, provider='{self.provider}')>"


# =========================================================================
