"""
Database Seeding Utilities
===========================

This module contains utilities for seeding the MariaDB database with initial data
for the Resomix Audio Similarity API. It provides functions for populating
test data, reference data, and sample content for development and testing.

Manages initial data creation, sample user insertion, RBAC setup,
and database initialization for development environments.

Version: 3.2.0
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

import uuid
import logging
import hashlib
import json
import os
from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Dict, Any
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from database.connection import engine

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class SeedDataManager:
    """Manages database seeding operations with sample data."""
    
    def __init__(self):
        self.engine = engine
    
    def _hash_password(self, password: str) -> str:
        """Simple hash for demo purposes. In production, use bcrypt/argon2."""
        return hashlib.sha256(password.encode()).hexdigest()
    
    def seed_users(self) -> bool:
        """Seed sample users with various profiles."""
        try:
            with self.engine.begin() as conn:
                users_data = [
                    {
                        'uuid': str(uuid.uuid4()),
                        'username': 'admin',
                        'email': 'admin@resomix.com',
                        'password_hash': self._hash_password('Admin@123'),
                        'name': 'System Administrator',
                        'profile_picture': '/avatars/admin.png',
                        'language': 'en',
                        'timezone': 'UTC',
                        'is_email_verified': 1,
                        'is_two_factor_enabled': 0,  # Disabled for dev environment
                        'two_factor_method': 'email'
                    },
                    {
                        'uuid': str(uuid.uuid4()),
                        'username': 'john_doe',
                        'email': 'john.doe@example.com',
                        'password_hash': self._hash_password('User@123'),
                        'name': 'John Doe',
                        'profile_picture': '/avatars/john.png',
                        'language': 'en',
                        'timezone': 'America/New_York',
                        'is_email_verified': 1,
                        'is_two_factor_enabled': 0,
                        'two_factor_method': 'email'
                    },
                    {
                        'uuid': str(uuid.uuid4()),
                        'username': 'jane_smith',
                        'email': 'jane.smith@example.com',
                        'password_hash': self._hash_password('User@123'),
                        'name': 'Jane Smith',
                        'profile_picture': '/avatars/jane.png',
                        'language': 'en',
                        'timezone': 'America/Los_Angeles',
                        'is_email_verified': 1,
                        'is_two_factor_enabled': 0,  # Disabled for dev environment
                        'two_factor_method': 'email'
                    },
                    {
                        'uuid': str(uuid.uuid4()),
                        'username': 'dj_mike',
                        'email': 'mike@example.com',
                        'password_hash': self._hash_password('Premium@123'),
                        'name': 'Mike DJ',
                        'profile_picture': '/avatars/mike.png',
                        'language': 'en',
                        'timezone': 'Europe/London',
                        'is_email_verified': 1,
                        'is_two_factor_enabled': 0,  # Disabled for dev environment
                        'two_factor_method': 'email'
                    },
                    {
                        'uuid': str(uuid.uuid4()),
                        'username': 'sarah_producer',
                        'email': 'sarah@musicstudio.com',
                        'password_hash': self._hash_password('Premium@123'),
                        'name': 'Sarah Producer',
                        'profile_picture': '/avatars/sarah.png',
                        'language': 'en',
                        'timezone': 'Europe/Berlin',
                        'is_email_verified': 1,
                        'is_two_factor_enabled': 0,
                        'two_factor_method': 'email'
                    },
                    {
                        'uuid': str(uuid.uuid4()),
                        'username': 'moderator_alex',
                        'email': 'alex@resomix.com',
                        'password_hash': self._hash_password('Mod@123'),
                        'name': 'Alex Moderator',
                        'profile_picture': '/avatars/alex.png',
                        'language': 'en',
                        'timezone': 'Asia/Tokyo',
                        'is_email_verified': 1,
                        'is_two_factor_enabled': 0,  # Disabled for dev environment
                        'two_factor_method': 'email'
                    },
                    {
                        'uuid': str(uuid.uuid4()),
                        'username': 'carlos_musician',
                        'email': 'carlos@musician.com',
                        'password_hash': self._hash_password('User@123'),
                        'name': 'Carlos Musician',
                        'profile_picture': '/avatars/carlos.png',
                        'language': 'es',
                        'timezone': 'America/Mexico_City',
                        'is_email_verified': 1,
                        'is_two_factor_enabled': 0,
                        'two_factor_method': 'email'
                    },
                    {
                        'uuid': str(uuid.uuid4()),
                        'username': 'emma_listener',
                        'email': 'emma@listener.com',
                        'password_hash': self._hash_password('User@123'),
                        'name': 'Emma Listener',
                        'profile_picture': '/avatars/emma.png',
                        'language': 'en',
                        'timezone': 'Australia/Sydney',
                        'is_email_verified': 1,  # Changed to verified for easier dev testing
                        'is_two_factor_enabled': 0,
                        'two_factor_method': 'email'
                    }
                ]
                
                for user in users_data:
                    conn.execute(text("""
                        INSERT IGNORE INTO users (
                            uuid, username, email, password_hash, name, profile_picture,
                            language, timezone, is_email_verified, is_two_factor_enabled,
                            two_factor_method
                        )
                        VALUES (
                            :uuid, :username, :email, :password_hash, :name, :profile_picture,
                            :language, :timezone, :is_email_verified, :is_two_factor_enabled,
                            :two_factor_method
                        )
                    """), user)
                
                logger.info(f"Seeded {len(users_data)} users successfully")
                return True
                
        except SQLAlchemyError as e:
            logger.error(f"Failed to seed users: {e}")
            return False
    
    def seed_auth_tokens(self) -> bool:
        """Seed sample auth tokens for demonstration."""
        try:
            with self.engine.begin() as conn:
                # Email verification tokens for unverified users
                result = conn.execute(text("""
                    SELECT id FROM users WHERE is_email_verified = 0 LIMIT 1
                """))
                unverified_user = result.fetchone()
                
                if unverified_user:
                    conn.execute(text("""
                        INSERT INTO email_verification_tokens (user_id, token, expires_at)
                        VALUES (:user_id, :token, :expires_at)
                        ON DUPLICATE KEY UPDATE token=VALUES(token), expires_at=VALUES(expires_at)
                    """), {
                        'user_id': unverified_user[0],
                        'token': uuid.uuid4().hex[:43],  # VARCHAR(64) supports up to 43 chars
                        'expires_at': datetime.now() + timedelta(hours=24)
                    })
                
                # Password reset tokens (sample - would be expired)
                result = conn.execute(text("""
                    SELECT id FROM users WHERE username = 'john_doe'
                """))
                user = result.fetchone()
                
                if user:
                    conn.execute(text("""
                        INSERT INTO password_reset_tokens (user_id, token, expires_at, consumed_at)
                        VALUES (:user_id, :token, :expires_at, :consumed_at)
                        ON DUPLICATE KEY UPDATE token=VALUES(token)
                    """), {
                        'user_id': user[0],
                        'token': uuid.uuid4().hex[:43],  # VARCHAR(64) supports up to 43 chars
                        'expires_at': datetime.now() - timedelta(hours=1),  # Expired
                        'consumed_at': None
                    })
                
                logger.info("Seeded auth tokens successfully")
                return True
                
        except SQLAlchemyError as e:
            logger.error(f"Failed to seed auth tokens: {e}")
            return False
    
    def seed_user_sessions(self) -> bool:
        """Seed sample user sessions."""
        try:
            with self.engine.begin() as conn:
                # Get some users
                result = conn.execute(text("""
                    SELECT id FROM users LIMIT 5
                """))
                users = result.fetchall()
                
                user_agents = [
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X)',
                    'Mozilla/5.0 (iPad; CPU OS 14_7_1 like Mac OS X)',
                    'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36'
                ]
                
                ip_addresses = [
                    '192.168.1.100',
                    '10.0.0.50',
                    '172.16.0.10',
                    '203.0.113.45',
                    '198.51.100.78'
                ]
                
                for idx, user in enumerate(users):
                    # Active session
                    conn.execute(text("""
                        INSERT INTO user_sessions (
                            user_id, session_id, refresh_token_hash, user_agent,
                            ip_address, expires_at, revoked_at
                        )
                        VALUES (
                            :user_id, :session_id, :refresh_token_hash, :user_agent,
                            :ip_address, :expires_at, :revoked_at
                        )
                    """), {
                        'user_id': user[0],
                        'session_id': str(uuid.uuid4()),
                        'refresh_token_hash': self._hash_password(f'refresh_token_{idx}'),
                        'user_agent': user_agents[idx % len(user_agents)],
                        'ip_address': ip_addresses[idx % len(ip_addresses)],
                        'expires_at': datetime.now() + timedelta(days=30),
                        'revoked_at': None
                    })
                    
                    # Revoked session (old session)
                    conn.execute(text("""
                        INSERT INTO user_sessions (
                            user_id, session_id, refresh_token_hash, user_agent,
                            ip_address, expires_at, revoked_at
                        )
                        VALUES (
                            :user_id, :session_id, :refresh_token_hash, :user_agent,
                            :ip_address, :expires_at, :revoked_at
                        )
                    """), {
                        'user_id': user[0],
                        'session_id': str(uuid.uuid4()),
                        'refresh_token_hash': self._hash_password(f'old_refresh_token_{idx}'),
                        'user_agent': user_agents[idx % len(user_agents)],
                        'ip_address': ip_addresses[idx % len(ip_addresses)],
                        'expires_at': datetime.now() + timedelta(days=30),
                        'revoked_at': datetime.now() - timedelta(days=5)
                    })
                
                logger.info("Seeded user sessions successfully")
                return True
                
        except SQLAlchemyError as e:
            logger.error(f"Failed to seed user sessions: {e}")
            return False
    
    def seed_oauth_providers(self) -> bool:
        """Seed OAuth provider connections."""
        try:
            with self.engine.begin() as conn:
                # Get some users for OAuth linkage
                result = conn.execute(text("""
                    SELECT id FROM users WHERE username IN ('jane_smith', 'dj_mike', 'sarah_producer')
                """))
                users = result.fetchall()
                
                providers_data = [
                    {'provider': 'google', 'provider_uid': 'google_12345678901234567890'},
                    {'provider': 'google', 'provider_uid': 'google_98765432109876543210'},
                    {'provider': 'spotify', 'provider_uid': 'spotify_abcdef123456'},
                ]
                
                for idx, user in enumerate(users):
                    if idx < len(providers_data):
                        conn.execute(text("""
                            INSERT IGNORE INTO user_auth_providers (user_id, provider, provider_uid)
                            VALUES (:user_id, :provider, :provider_uid)
                        """), {
                            'user_id': user[0],
                            **providers_data[idx]
                        })
                
                logger.info("Seeded OAuth providers successfully")
                return True
                
        except SQLAlchemyError as e:
            logger.error(f"Failed to seed OAuth providers: {e}")
            return False
    
    def seed_rbac_data(self) -> bool:
        """Seed RBAC (roles, permissions, and relationships) data."""
        try:
            with self.engine.begin() as conn:
                # Insert roles
                roles_data = [
                    {'name': 'admin', 'description': 'System administrator with full access to all features and user management'},
                    {'name': 'user', 'description': 'Regular user with basic access to search, similarity, and playlist features'},
                    {'name': 'premium', 'description': 'Premium user with enhanced features including downloads and advanced filters'},
                    {'name': 'moderator', 'description': 'Content moderator with permissions to review and manage user content and feedback'},
                    {'name': 'api_user', 'description': 'API-only user with programmatic access rights'},
                    {'name': 'content_creator', 'description': 'Users who can upload and manage their own content'}
                ]
                
                for role in roles_data:
                    conn.execute(text("""
                        INSERT IGNORE INTO roles (name, description) 
                        VALUES (:name, :description)
                    """), role)
                
                # Insert comprehensive permissions
                permissions_data = [
                    # Track permissions
                    {'name': 'track.view', 'description': 'View track information and metadata'},
                    {'name': 'track.download', 'description': 'Download tracks for offline use'},
                    {'name': 'track.upload', 'description': 'Upload new tracks to the platform'},
                    {'name': 'track.edit', 'description': 'Edit track metadata and information'},
                    {'name': 'track.delete', 'description': 'Delete tracks from the system'},
                    {'name': 'track.rate', 'description': 'Rate and review tracks'},
                    {'name': 'track.preview', 'description': 'Access track preview/samples'},
                    
                    # Playlist permissions
                    {'name': 'playlist.view', 'description': 'View playlists'},
                    {'name': 'playlist.create', 'description': 'Create new playlists'},
                    {'name': 'playlist.edit', 'description': 'Edit existing playlists'},
                    {'name': 'playlist.delete', 'description': 'Delete playlists'},
                    {'name': 'playlist.share', 'description': 'Share playlists with others'},
                    {'name': 'playlist.export', 'description': 'Export playlists to external platforms'},
                    {'name': 'playlist.rate', 'description': 'Rate playlists'},
                    
                    # Similarity permissions
                    {'name': 'similarity.calculate', 'description': 'Calculate track similarity scores'},
                    {'name': 'similarity.advanced', 'description': 'Access advanced similarity filters and options'},
                    {'name': 'similarity.bulk', 'description': 'Perform bulk similarity operations'},
                    
                    # Search permissions
                    {'name': 'search.basic', 'description': 'Basic search functionality'},
                    {'name': 'search.advanced', 'description': 'Advanced search with filters'},
                    
                    # User management permissions
                    {'name': 'user.view', 'description': 'View user profiles'},
                    {'name': 'user.edit_own', 'description': 'Edit own profile'},
                    {'name': 'user.manage', 'description': 'Manage other users (admin)'},
                    {'name': 'user.delete', 'description': 'Delete user accounts'},
                    
                    # Admin permissions
                    {'name': 'admin.users', 'description': 'Full user management access'},
                    {'name': 'admin.system', 'description': 'System administration and configuration'},
                    {'name': 'admin.logs', 'description': 'View and manage system logs'},
                    {'name': 'admin.analytics', 'description': 'Access system analytics and reports'},
                    
                    # Feedback permissions
                    {'name': 'feedback.submit', 'description': 'Submit feedback and suggestions'},
                    {'name': 'feedback.view', 'description': 'View feedback submissions'},
                    {'name': 'feedback.manage', 'description': 'Manage and respond to feedback'},
                    
                    # Contact permissions
                    {'name': 'contact.submit', 'description': 'Submit contact messages'},
                    {'name': 'contact.view', 'description': 'View contact submissions'},
                    {'name': 'contact.manage', 'description': 'Manage contact messages'},
                    
                    # Purchase permissions
                    {'name': 'purchase.make', 'description': 'Purchase tracks and albums'},
                    {'name': 'purchase.view_history', 'description': 'View purchase history'},
                    {'name': 'purchase.manage', 'description': 'Manage all purchases (admin)'},
                    
                    # Subscription permissions
                    {'name': 'subscription.view', 'description': 'View subscription details'},
                    {'name': 'subscription.manage', 'description': 'Manage subscription status'},
                    
                    # API permissions
                    {'name': 'api.access', 'description': 'Access API endpoints'},
                    {'name': 'api.rate_limit_high', 'description': 'Higher API rate limits'},
                ]
                
                for permission in permissions_data:
                    conn.execute(text("""
                        INSERT IGNORE INTO permissions (name, description) 
                        VALUES (:name, :description)
                    """), permission)
                
                # Assign permissions to roles
                role_permissions = [
                    # Admin gets all permissions
                    ('admin', [
                        'track.view', 'track.download', 'track.upload', 'track.edit', 'track.delete', 'track.rate', 'track.preview',
                        'playlist.view', 'playlist.create', 'playlist.edit', 'playlist.delete', 'playlist.share', 'playlist.export', 'playlist.rate',
                        'similarity.calculate', 'similarity.advanced', 'similarity.bulk',
                        'search.basic', 'search.advanced',
                        'user.view', 'user.edit_own', 'user.manage', 'user.delete',
                        'admin.users', 'admin.system', 'admin.logs', 'admin.analytics',
                        'feedback.submit', 'feedback.view', 'feedback.manage',
                        'contact.submit', 'contact.view', 'contact.manage',
                        'purchase.make', 'purchase.view_history', 'purchase.manage',
                        'subscription.view', 'subscription.manage',
                        'api.access', 'api.rate_limit_high'
                    ]),
                    
                    # Premium user gets enhanced features
                    ('premium', [
                        'track.view', 'track.download', 'track.upload', 'track.rate', 'track.preview',
                        'playlist.view', 'playlist.create', 'playlist.edit', 'playlist.delete', 'playlist.share', 'playlist.export', 'playlist.rate',
                        'similarity.calculate', 'similarity.advanced',
                        'search.basic', 'search.advanced',
                        'user.view', 'user.edit_own',
                        'feedback.submit',
                        'contact.submit',
                        'purchase.make', 'purchase.view_history',
                        'subscription.view', 'subscription.manage',
                        'api.access', 'api.rate_limit_high'
                    ]),
                    
                    # Regular user gets basic features
                    ('user', [
                        'track.view', 'track.rate', 'track.preview',
                        'playlist.view', 'playlist.create', 'playlist.edit', 'playlist.delete', 'playlist.share', 'playlist.rate',
                        'similarity.calculate',
                        'search.basic',
                        'user.view', 'user.edit_own',
                        'feedback.submit',
                        'contact.submit',
                        'purchase.make', 'purchase.view_history',
                        'subscription.view',
                        'api.access'
                    ]),
                    
                    # Moderator gets content management
                    ('moderator', [
                        'track.view', 'track.edit', 'track.delete', 'track.rate', 'track.preview',
                        'playlist.view', 'playlist.create', 'playlist.edit', 'playlist.delete', 'playlist.rate',
                        'similarity.calculate',
                        'search.basic', 'search.advanced',
                        'user.view',
                        'feedback.view', 'feedback.manage',
                        'contact.view', 'contact.manage',
                        'admin.logs'
                    ]),
                    
                    # API user
                    ('api_user', [
                        'track.view', 'track.preview',
                        'playlist.view',
                        'similarity.calculate',
                        'search.basic', 'search.advanced',
                        'api.access', 'api.rate_limit_high'
                    ]),
                    
                    # Content creator
                    ('content_creator', [
                        'track.view', 'track.upload', 'track.edit', 'track.rate', 'track.preview',
                        'playlist.view', 'playlist.create', 'playlist.edit', 'playlist.delete', 'playlist.share', 'playlist.rate',
                        'similarity.calculate',
                        'search.basic', 'search.advanced',
                        'user.view', 'user.edit_own',
                        'feedback.submit'
                    ])
                ]
                
                for role_name, permission_names in role_permissions:
                    for permission_name in permission_names:
                        conn.execute(text("""
                            INSERT IGNORE INTO role_permissions (role_id, permission_id)
                            SELECT r.id, p.id 
                            FROM roles r, permissions p 
                            WHERE r.name = :role_name AND p.name = :permission_name
                        """), {'role_name': role_name, 'permission_name': permission_name})
                
                logger.info("RBAC data seeded successfully")
                return True
                
        except SQLAlchemyError as e:
            logger.error(f"Failed to seed RBAC data: {e}")
            return False
    
    def seed_user_roles(self) -> bool:
        """Assign roles to seeded users."""
        try:
            with self.engine.begin() as conn:
                user_role_assignments = [
                    ('admin', 'admin'),
                    ('john_doe', 'user'),
                    ('jane_smith', 'premium'),
                    ('dj_mike', 'premium'),
                    ('sarah_producer', 'content_creator'),
                    ('moderator_alex', 'moderator'),
                    ('carlos_musician', 'user'),
                    ('emma_listener', 'user'),
                ]
                
                for username, role_name in user_role_assignments:
                    conn.execute(text("""
                        INSERT IGNORE INTO user_roles (user_id, role_id)
                        SELECT u.id, r.id
                        FROM users u, roles r
                        WHERE u.username = :username AND r.name = :role_name
                    """), {'username': username, 'role_name': role_name})
                
                logger.info("User roles assigned successfully")
                return True
                
        except SQLAlchemyError as e:
            logger.error(f"Failed to seed user roles: {e}")
            return False
    
    def seed_waitlist(self) -> bool:
        """Seed waitlist entries."""
        try:
            with self.engine.begin() as conn:
                waitlist_data = [
                    {'email': 'newuser1@example.com', 'status': 'pending'},
                    {'email': 'newuser2@example.com', 'status': 'pending'},
                    {'email': 'approved_user@example.com', 'status': 'approved'},
                    {'email': 'rejected_user@example.com', 'status': 'rejected'},
                    {'email': 'beta_tester@example.com', 'status': 'approved'},
                    {'email': 'interested_dj@musicworld.com', 'status': 'pending'},
                    {'email': 'producer_waiting@studio.com', 'status': 'pending'},
                    {'email': 'music_enthusiast@fan.com', 'status': 'approved'},
                ]
                
                for entry in waitlist_data:
                    conn.execute(text("""
                        INSERT IGNORE INTO waitlist (email, status)
                        VALUES (:email, :status)
                    """), entry)
                
                logger.info(f"Seeded {len(waitlist_data)} waitlist entries successfully")
                return True
                
        except SQLAlchemyError as e:
            logger.error(f"Failed to seed waitlist: {e}")
            return False
    
    def seed_subscriptions(self) -> bool:
        """Seed user subscriptions."""
        try:
            with self.engine.begin() as conn:
                # Get premium users
                result = conn.execute(text("""
                    SELECT u.id 
                    FROM users u
                    JOIN user_roles ur ON u.id = ur.user_id
                    JOIN roles r ON ur.role_id = r.id
                    WHERE r.name = 'premium'
                """))
                premium_users = result.fetchall()
                
                for user in premium_users:
                    conn.execute(text("""
                        INSERT IGNORE INTO user_subscriptions (user_id, stripe_subscription_id)
                        VALUES (:user_id, :stripe_subscription_id)
                    """), {
                        'user_id': user[0],
                        'stripe_subscription_id': f'sub_{uuid.uuid4().hex[:24]}'
                    })
                
                logger.info("Seeded subscriptions successfully")
                return True
                
        except SQLAlchemyError as e:
            logger.error(f"Failed to seed subscriptions: {e}")
            return False
    
    def seed_feedback(self) -> bool:
        """Seed comprehensive feedback entries."""
        try:
            with self.engine.begin() as conn:
                # Get user IDs
                result = conn.execute(text("""
                    SELECT id FROM users WHERE username IN ('john_doe', 'jane_smith', 'dj_mike', 'carlos_musician')
                """))
                users = result.fetchall()
                
                feedback_data = [
                    {
                        'user_id': users[0][0] if len(users) > 0 else None,
                        'category': 'performance',
                        'message': 'The similarity search is incredibly accurate and fast! Love how quickly I can find tracks that match my vibe.',
                        'satisfaction': 9,
                        'recommendation': 9,
                        'status': 'resolved'
                    },
                    {
                        'user_id': users[1][0] if len(users) > 1 else None,
                        'category': 'feature_request',
                        'message': 'Would love to see more genre filters in search. Also, a mobile app would be amazing!',
                        'satisfaction': 8,
                        'recommendation': 8,
                        'status': 'open'
                    },
                    {
                        'user_id': None,  # Anonymous feedback
                        'category': 'bug_report',
                        'message': 'Sometimes the metadata extraction fails for certain file types, especially FLAC files with complex tags.',
                        'satisfaction': 6,
                        'recommendation': 7,
                        'status': 'open'
                    },
                    {
                        'user_id': users[2][0] if len(users) > 2 else None,
                        'category': 'user_experience',
                        'message': 'The playlist export feature to Spotify is a game-changer! Works flawlessly.',
                        'satisfaction': 10,
                        'recommendation': 10,
                        'status': 'resolved'
                    },
                    {
                        'user_id': users[3][0] if len(users) > 3 else None,
                        'category': 'feature_request',
                        'message': 'Can we get key detection for uploaded tracks? Also, BPM range filters would be helpful for DJs.',
                        'satisfaction': 7,
                        'recommendation': 8,
                        'status': 'open'
                    },
                    {
                        'user_id': users[0][0] if len(users) > 0 else None,
                        'category': 'general',
                        'message': 'Great platform overall. The audio similarity algorithm is top-notch!',
                        'satisfaction': 9,
                        'recommendation': 9,
                        'status': 'resolved'
                    },
                    {
                        'user_id': None,
                        'category': 'bug_report',
                        'message': 'Download links sometimes expire too quickly. Could we get longer validity?',
                        'satisfaction': 7,
                        'recommendation': 8,
                        'status': 'open'
                    }
                ]
                
                for feedback in feedback_data:
                    conn.execute(text("""
                        INSERT INTO feedback (user_id, category, message, satisfaction, recommendation, status)
                        VALUES (:user_id, :category, :message, :satisfaction, :recommendation, :status)
                    """), feedback)
                
                logger.info("Seeded feedback data successfully")
                return True
                
        except SQLAlchemyError as e:
            logger.error(f"Failed to seed feedback data: {e}")
            return False
    
    def seed_production_tracks(self, json_file: str = "tracks_seed.json") -> bool:
        """
        Seed tracks and related data from production export.
        
        Args:
            json_file: Path to JSON file with exported production data
        """
        try:
            # Make path absolute if relative (check in scripts directory first, then project root)
            if not os.path.isabs(json_file):
                # First try in scripts directory (where extract script puts it)
                scripts_dir = Path(__file__).parent
                scripts_json_file = str(scripts_dir / json_file)
                
                if os.path.exists(scripts_json_file):
                    json_file = scripts_json_file
                else:
                    # Fallback to project root
                    project_root = Path(__file__).parent.parent
                    json_file = str(project_root / json_file)
            
            # Check if file exists
            if not os.path.exists(json_file):
                logger.warning(f"❌ Production data file not found: {json_file}")
                logger.info("ℹ️  To extract production data, run:")
                logger.info("   python scripts/extract_production_data.py --output tracks_seed.json")
                logger.info("📝 Skipping production track seeding (this is optional)")
                return True
            
            logger.info(f"Loading production data from {json_file}...")
            with open(json_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            with self.engine.begin() as conn:
                # 1. Seed Artists
                if data.get('artists'):
                    logger.info(f"Seeding {len(data['artists'])} artists...")
                    for artist in data['artists']:
                        conn.execute(text("""
                            INSERT INTO artists (name)
                            VALUES (:name)
                            ON DUPLICATE KEY UPDATE name=VALUES(name)
                        """), {'name': artist['name']})
                    logger.info(f"✓ Seeded {len(data['artists'])} artists")
                
                # 2. Seed Labels
                if data.get('labels'):
                    logger.info(f"Seeding {len(data['labels'])} labels...")
                    for label in data['labels']:
                        conn.execute(text("""
                            INSERT INTO labels (name, website)
                            VALUES (:name, :website)
                            ON DUPLICATE KEY UPDATE website=VALUES(website)
                        """), {
                            'name': label['name'],
                            'website': label.get('website')
                        })
                    logger.info(f"✓ Seeded {len(data['labels'])} labels")
                
                # 3. Seed Genres
                if data.get('genres'):
                    logger.info(f"Seeding {len(data['genres'])} genres...")
                    for genre in data['genres']:
                        conn.execute(text("""
                            INSERT INTO genres (name)
                            VALUES (:name)
                            ON DUPLICATE KEY UPDATE name=VALUES(name)
                        """), {'name': genre['name']})
                    logger.info(f"✓ Seeded {len(data['genres'])} genres")
                
                # Now we need to fetch the actual IDs that were assigned
                # Build mappings from names to IDs
                artist_name_to_id = {}
                label_name_to_id = {}
                genre_name_to_id = {}
                
                if data.get('artists'):
                    result = conn.execute(text("SELECT id, name FROM artists"))
                    for row in result:
                        artist_name_to_id[row.name] = row.id
                
                if data.get('labels'):
                    result = conn.execute(text("SELECT id, name FROM labels"))
                    for row in result:
                        label_name_to_id[row.name] = row.id
                
                if data.get('genres'):
                    result = conn.execute(text("SELECT id, name FROM genres"))
                    for row in result:
                        genre_name_to_id[row.name] = row.id
                
                # 4. Seed Albums (need to map artist IDs)
                album_json_id_to_db_id = {}
                if data.get('albums'):
                    logger.info(f"Seeding {len(data['albums'])} albums...")
                    for album in data['albums']:
                        # Find artist by name
                        artist_name = next(
                            (a['name'] for a in data['artists'] if a['id'] == album['artist_id']),
                            None
                        )
                        artist_id = artist_name_to_id.get(artist_name) if artist_name else None
                        
                        result = conn.execute(text("""
                            INSERT INTO albums (artist_id, title, release_date, cover_image)
                            VALUES (:artist_id, :title, :release_date, :cover_image)
                        """), {
                            'artist_id': artist_id,
                            'title': album['title'],
                            'release_date': album.get('release_date'),
                            'cover_image': album.get('cover_image')
                        })
                        album_json_id_to_db_id[album['id']] = result.lastrowid
                    logger.info(f"✓ Seeded {len(data['albums'])} albums")
                
                # 5. Seed Tracks (need to map album, label, genre IDs)
                track_json_id_to_db_id = {}
                if data.get('tracks'):
                    logger.info(f"Seeding {len(data['tracks'])} tracks...")
                    for idx, track in enumerate(data['tracks'], 1):
                        # Map foreign keys
                        album_id = album_json_id_to_db_id.get(track['album_id']) if track.get('album_id') else None
                        
                        label_name = next(
                            (l['name'] for l in data.get('labels', []) if l['id'] == track.get('label_id')),
                            None
                        )
                        label_id = label_name_to_id.get(label_name) if label_name else None
                        
                        genre_name = next(
                            (g['name'] for g in data.get('genres', []) if g['id'] == track.get('genre_id')),
                            None
                        )
                        genre_id = genre_name_to_id.get(genre_name) if genre_name else None
                        
                        result = conn.execute(text("""
                            INSERT INTO tracks (
                                uuid, album_id, label_id, genre_id, title, year, duration_sec,
                                bpm, musical_key, file_path, preview_path, file_size, type
                            )
                            VALUES (
                                :uuid, :album_id, :label_id, :genre_id, :title, :year, :duration_sec,
                                :bpm, :musical_key, :file_path, :preview_path, :file_size, :type
                            )
                        """), {
                            'uuid': track['uuid'],
                            'album_id': album_id,
                            'label_id': label_id,
                            'genre_id': genre_id,
                            'title': track['title'],
                            'year': track.get('year'),
                            'duration_sec': track.get('duration_sec'),
                            'bpm': track.get('bpm'),
                            'musical_key': track.get('musical_key'),
                            'file_path': track['file_path'],
                            'preview_path': track.get('preview_path'),
                            'file_size': track.get('file_size'),
                            'type': track.get('type', 'electrobuzz')
                        })
                        track_json_id_to_db_id[track['id']] = result.lastrowid
                        
                        if idx % 100 == 0:
                            logger.info(f"  Processed {idx}/{len(data['tracks'])} tracks")
                    
                    logger.info(f"✓ Seeded {len(data['tracks'])} tracks")
                
                # 6. Seed Track-Artist relationships
                if data.get('track_artists'):
                    logger.info(f"Seeding {len(data['track_artists'])} track-artist relationships...")
                    for ta in data['track_artists']:
                        track_id = track_json_id_to_db_id.get(ta['track_id'])
                        
                        # Find artist by name
                        artist_name = next(
                            (a['name'] for a in data.get('artists', []) if a['id'] == ta['artist_id']),
                            None
                        )
                        artist_id = artist_name_to_id.get(artist_name) if artist_name else None
                        
                        if track_id and artist_id:
                            conn.execute(text("""
                                INSERT IGNORE INTO track_artists (track_id, artist_id)
                                VALUES (:track_id, :artist_id)
                            """), {
                                'track_id': track_id,
                                'artist_id': artist_id
                            })
                    logger.info(f"✓ Seeded {len(data['track_artists'])} track-artist relationships")
                
                # 7. Seed Playlists (assign to random users)
                playlist_json_id_to_db_id = {}
                if data.get('playlists'):
                    logger.info(f"Seeding {len(data['playlists'])} playlists...")
                    
                    # Get some user IDs to assign playlists
                    result = conn.execute(text("SELECT id FROM users LIMIT 5"))
                    user_ids = [row.id for row in result]
                    
                    for idx, playlist in enumerate(data['playlists']):
                        # Assign to random user or leave null
                        user_id = user_ids[idx % len(user_ids)] if user_ids else None
                        
                        result = conn.execute(text("""
                            INSERT INTO playlists (
                                uuid, user_id, name, is_public, type, seed_track_id,
                                fork_id, forked_at, fork_count
                            )
                            VALUES (
                                :uuid, :user_id, :name, :is_public, :type, :seed_track_id,
                                :fork_id, :forked_at, :fork_count
                            )
                        """), {
                            'uuid': playlist['uuid'],
                            'user_id': user_id,
                            'name': playlist['name'],
                            'is_public': playlist['is_public'],
                            'type': playlist['type'],
                            'seed_track_id': None,  # Not mapping seed tracks
                            'fork_id': playlist.get('fork_id'),
                            'forked_at': playlist.get('forked_at'),
                            'fork_count': playlist.get('fork_count', 0)
                        })
                        playlist_json_id_to_db_id[playlist['id']] = result.lastrowid
                    
                    logger.info(f"✓ Seeded {len(data['playlists'])} playlists")
                
                # 8. Seed Playlist Tracks
                if data.get('playlist_tracks'):
                    logger.info(f"Seeding {len(data['playlist_tracks'])} playlist tracks...")
                    for pt in data['playlist_tracks']:
                        playlist_id = playlist_json_id_to_db_id.get(pt['playlist_id'])
                        track_id = track_json_id_to_db_id.get(pt['track_id'])
                        
                        if playlist_id and track_id:
                            conn.execute(text("""
                                INSERT INTO playlist_tracks (playlist_id, track_id, position, score)
                                VALUES (:playlist_id, :track_id, :position, :score)
                            """), {
                                'playlist_id': playlist_id,
                                'track_id': track_id,
                                'position': pt['position'],
                                'score': pt.get('score')
                            })
                    logger.info(f"✓ Seeded {len(data['playlist_tracks'])} playlist tracks")
            
            logger.info("=" * 60)
            logger.info("✓ Production track data seeded successfully!")
            logger.info("=" * 60)
            return True
            
        except Exception as e:
            logger.error(f"Failed to seed production tracks: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def seed_contact(self) -> bool:
        """Seed contact message entries."""
        try:
            with self.engine.begin() as conn:
                # Get user IDs
                result = conn.execute(text("""
                    SELECT id FROM users LIMIT 3
                """))
                users = result.fetchall()
                
                contact_data = [
                    {
                        'user_id': users[0][0] if len(users) > 0 else None,
                        'name': 'John Doe',
                        'email': 'john.doe@example.com',
                        'subject': 'API Integration Question',
                        'phone': '+1-555-0123',
                        'message': 'Hi, I\'m interested in integrating your API into my music streaming app. Can you provide more details about rate limits and pricing?',
                        'status': 'open'
                    },
                    {
                        'user_id': None,  # Anonymous contact
                        'name': 'Music Studio Pro',
                        'email': 'contact@musicstudiopro.com',
                        'subject': 'Business Partnership Inquiry',
                        'phone': '+1-555-0456',
                        'message': 'We run a professional music production studio and would like to discuss potential partnership opportunities for bulk licensing.',
                        'status': 'resolved'
                    },
                    {
                        'user_id': users[1][0] if len(users) > 1 else None,
                        'name': 'Jane Smith',
                        'email': 'jane.smith@example.com',
                        'subject': 'Technical Support',
                        'phone': '+1-555-0789',
                        'message': 'Having issues with playlist export to Tidal. The authentication keeps failing. Can you help?',
                        'status': 'resolved'
                    },
                    {
                        'user_id': None,
                        'name': 'DJ Events Agency',
                        'email': 'bookings@djevents.com',
                        'subject': 'Enterprise Plan Information',
                        'phone': '+1-555-0321',
                        'message': 'We\'re an agency representing 50+ DJs. Looking for information on enterprise plans with multiple user accounts.',
                        'status': 'open'
                    },
                    {
                        'user_id': users[2][0] if len(users) > 2 else None,
                        'name': 'Carlos Musician',
                        'email': 'carlos@musician.com',
                        'subject': 'Content Upload Guidelines',
                        'phone': '+1-555-0654',
                        'message': 'What are the guidelines for uploading my own produced tracks? Are there any format or quality requirements?',
                        'status': 'resolved'
                    },
                    {
                        'user_id': None,
                        'name': 'Radio Station Manager',
                        'email': 'manager@radiostation.fm',
                        'subject': 'Licensing Inquiry',
                        'phone': '+1-555-0987',
                        'message': 'We operate an online radio station and are interested in licensing tracks from your catalog. What are the terms?',
                        'status': 'open'
                    }
                ]
                
                for contact in contact_data:
                    conn.execute(text("""
                        INSERT INTO contact (user_id, name, email, subject, phone, message, status)
                        VALUES (:user_id, :name, :email, :subject, :phone, :message, :status)
                    """), contact)
                
                logger.info("Seeded contact data successfully")
                return True
                
        except SQLAlchemyError as e:
            logger.error(f"Failed to seed contact data: {e}")
            return False
    
    def seed_all(self) -> bool:
        """Seed all sample data in correct order."""
        logger.info("Starting comprehensive database seeding...")
        
        success = True
        
        # Seed in dependency order
        logger.info("Step 1: Seeding users...")
        success &= self.seed_users()
        
        logger.info("Step 2: Seeding RBAC data...")
        success &= self.seed_rbac_data()
        
        logger.info("Step 3: Assigning user roles...")
        success &= self.seed_user_roles()
        
        logger.info("Step 4: Seeding auth tokens...")
        success &= self.seed_auth_tokens()
        
        logger.info("Step 5: Seeding user sessions...")
        success &= self.seed_user_sessions()
        
        logger.info("Step 6: Seeding OAuth providers...")
        success &= self.seed_oauth_providers()
        
        logger.info("Step 7: Seeding subscriptions...")
        success &= self.seed_subscriptions()
        
        logger.info("Step 8: Seeding waitlist...")
        success &= self.seed_waitlist()
        
        logger.info("Step 9: Seeding production tracks and playlists...")
        success &= self.seed_production_tracks()
        
        logger.info("Step 10: Seeding feedback...")
        success &= self.seed_feedback()
        
        logger.info("Step 11: Seeding contact messages...")
        success &= self.seed_contact()
        
        if success:
            logger.info("=" * 60)
            logger.info("All sample data seeded successfully!")
            logger.info("=" * 60)
            logger.info("\nSample Credentials:")
            logger.info("  Admin: admin@resomix.com / Admin@123")
            logger.info("  User: john.doe@example.com / User@123")
            logger.info("  Premium: jane.smith@example.com / User@123")
            logger.info("=" * 60)
        else:
            logger.error("Some seeding operations failed")
        
        return success
    
    def clear_all_data(self) -> bool:
        """Clear all data from tables (for testing/reset)."""
        try:
            with self.engine.begin() as conn:
                # Disable foreign key checks temporarily
                conn.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
                
                # Clear all tables in reverse dependency order
                tables = [
                    'playlist_transfer_tracks', 'track_artists', 'playlist_tracks', 
                    'track_ratings', 'playlist_ratings', 'purchases', 'user_subscriptions',
                    'system_logs', 'feedback', 'contact', 'waitlist',
                    'tracks', 'albums', 'playlists', 'artists', 'labels', 'genres',
                    'user_auth_providers', 'user_sessions', 'two_factor_email_codes',
                    'password_reset_tokens', 'email_verification_tokens',
                    'role_permissions', 'user_roles', 'permissions', 'roles',
                    'users'
                ]
                
                for table in tables:
                    try:
                        conn.execute(text(f"DELETE FROM {table}"))
                        logger.info(f"✓ Cleared table: {table}")
                    except Exception as e:
                        logger.warning(f"⚠ Could not clear {table}: {e}")
                
                # Re-enable foreign key checks
                conn.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
                
                logger.info("=" * 60)
                logger.info("All data cleared successfully")
                logger.info("=" * 60)
                return True
                
        except SQLAlchemyError as e:
            logger.error(f"Failed to clear data: {e}")
            return False


def main():
    """CLI interface for seeding operations."""
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python seed_data.py <command> [options]")
        print("\nCommands:")
        print("  seed-all         - Seed all sample data (recommended)")
        print("  seed-users       - Seed users only")
        print("  seed-rbac        - Seed RBAC data only")
        print("  seed-auth        - Seed auth tokens only")
        print("  seed-sessions    - Seed user sessions only")
        print("  seed-oauth       - Seed OAuth providers only")
        print("  seed-subscriptions - Seed subscriptions only")
        print("  seed-waitlist    - Seed waitlist only")
        print("  seed-tracks      - Seed production tracks only")
        print("  seed-feedback    - Seed feedback only")
        print("  seed-contact     - Seed contact messages only")
        print("  clear-all        - Clear all data (WARNING: destructive)")
        return
    
    seeder = SeedDataManager()
    command = sys.argv[1]
    
    try:
        if command == "seed-all":
            success = seeder.seed_all()
        elif command == "seed-users":
            success = seeder.seed_users()
        elif command == "seed-rbac":
            success = seeder.seed_rbac_data()
        elif command == "seed-auth":
            success = seeder.seed_auth_tokens()
        elif command == "seed-sessions":
            success = seeder.seed_user_sessions()
        elif command == "seed-oauth":
            success = seeder.seed_oauth_providers()
        elif command == "seed-subscriptions":
            success = seeder.seed_subscriptions()
        elif command == "seed-waitlist":
            success = seeder.seed_waitlist()
        elif command == "seed-tracks":
            json_file = sys.argv[2] if len(sys.argv) > 2 else "tracks_seed.json"
            success = seeder.seed_production_tracks(json_file)
        elif command == "seed-feedback":
            success = seeder.seed_feedback()
        elif command == "seed-contact":
            success = seeder.seed_contact()
        elif command == "clear-all":
            confirm = input("⚠️  This will delete ALL data. Type 'yes' to confirm: ")
            if confirm.lower() == 'yes':
                success = seeder.clear_all_data()
            else:
                print("Operation cancelled")
                return
        else:
            print(f"Unknown command: {command}")
            sys.exit(1)
        
        sys.exit(0 if success else 1)
        
    except Exception as e:
        logger.error(f"Command failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
