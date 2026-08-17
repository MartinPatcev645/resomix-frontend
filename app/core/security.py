"""
Security Utilities & Authentication
====================================

Core security functions for password hashing, JWT token management,
and authentication helpers using industry best practices.

Version: 3.2.0
Author: Muhammad Usman Naeem
Date: October 23, 2025
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import secrets
import re
from passlib.context import CryptContext
from jose import ExpiredSignatureError, JWTError, jwt
# JWTClaimsError is exported from jose.exceptions, not the package root, in this version.
from jose.exceptions import JWTClaimsError
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

def create_access_token(
    data: Dict[str, Any], 
    expires_delta: Optional[timedelta] = None,
    extra_claims: Optional[Dict[str, Any]] = None
) -> str:
    """
    Create JWT access token.
    
    Args:
        data: Payload data to encode (should include 'sub' for user identifier)
        expires_delta: Optional custom expiration time
        extra_claims: Optional dictionary of additional claims (e.g. role: admin)
        
    Returns:
        Encoded JWT token string
    """
    to_encode = data.copy()
    
    if extra_claims:
        to_encode.update(extra_claims)
    
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
    # One `except JWTError` for all three cases produced a single, useless log line: an admin
    # looking at "HTTP 401: Could not validate credentials" could not tell an ordinary expired
    # session from a wrong signing key or a malformed token — three problems with completely
    # different responses. `raise ... from exc` keeps the original error as __cause__, so the
    # stack trace recorded by the exception handler names the real failure.
    except ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            # Safe to disclose and useful: it tells the client to refresh rather than re-login.
            detail="Access token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    except JWTClaimsError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token claims are invalid",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    except JWTError as exc:
        # Bad signature or malformed token. Deliberately vague to the CLIENT (revealing which
        # would help someone forge one) but the cause is preserved for the log.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


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
    
    # Allow alphanumeric, dots, underscores, and hyphens.
    #
    # Dots are permitted because registration derives the username from the email's local part
    # ("usman.naeem2212@gmail.com" -> "usman.naeem2212"). Rejecting them here would make every
    # auto-derived username with a dot in it unverifiable and un-editable from the profile page.
    if not re.match(r'^[a-zA-Z0-9._-]+$', username):
        return False, "Username can only contain letters, numbers, dots, underscores, and hyphens"

    # Must start with a letter
    if not username[0].isalpha():
        return False, "Username must start with a letter"

    return True, None


# Registration derives the username from the email, so the base needs room for a collision suffix
# without breaking the 50-character ceiling above (which is also the DB column width).
#
# Kept together deliberately: the base cap is DERIVED from the suffix budget rather than written
# out separately. When the two were independent numbers (40 + up to 12 "1"s) a long local part
# that collided repeatedly produced a 52-character username — over the limit, so the insert would
# have failed on the user's behalf.
USERNAME_MAX_LENGTH = 50
#: How many times the collision loop appends "1" before falling back to a random suffix.
USERNAME_MAX_SUFFIX_ATTEMPTS = 12
#: Random fallback is `secrets.token_hex(3)` — 6 characters.
_USERNAME_RANDOM_SUFFIX_LENGTH = 6
_USERNAME_BASE_MAX_LENGTH = USERNAME_MAX_LENGTH - max(
    USERNAME_MAX_SUFFIX_ATTEMPTS, _USERNAME_RANDOM_SUFFIX_LENGTH
)


def derive_username_base(email: str) -> str:
    """Build a *candidate* username from an email address.

    The local part, lowercased, stripped of anything the username rules disallow, and nudged into
    shape (must start with a letter, at least 3 characters, short enough to take a suffix). The
    result is NOT guaranteed to be free — the caller resolves collisions.

        usman.naeem2212@gmail.com -> usman.naeem2212
        2212usman@gmail.com       -> u2212usman      (must start with a letter)
        a.b@gmail.com             -> ab0             (padded to the 3-character minimum)
    """
    local = email.split("@", 1)[0].strip().lower()

    # Drop everything outside the allowed set (spaces, +tags, quotes, unicode…).
    cleaned = re.sub(r"[^a-z0-9._-]", "", local)
    # Leading punctuation would fail the "starts with a letter" rule and reads badly.
    cleaned = cleaned.lstrip("._-")

    if not cleaned or not cleaned[0].isalpha():
        cleaned = f"u{cleaned}"

    # Pad to the minimum length. Zeros rather than letters so it stays obviously generated.
    while len(cleaned) < 3:
        cleaned += "0"

    return cleaned[:_USERNAME_BASE_MAX_LENGTH]
