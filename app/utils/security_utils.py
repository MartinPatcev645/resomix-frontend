"""
Security Utilities
==================

This module provides security utilities for URL signing, token generation,
and cryptographic operations throughout the ResomiX application.
It handles secure URL generation, HMAC signing, and encryption/decryption
for preview download URLs and other security-sensitive operations.

Centralizes security functionality to ensure consistent and secure
cryptographic operations across all application components.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

import time
import hmac
import hashlib
import base64
from typing import Optional
from cryptography.fernet import Fernet

from app.core.config import settings


class URLSigner:
    """
    Handles secure URL signing for preview downloads and other protected resources.
    """
    
    def __init__(self):
        """Initialize URL signer with centralized configuration."""
        # Get secrets from centralized settings
        self.hmac_secret = settings.preview_hmac_secret
        self.expires_seconds = settings.preview_audio_url_expires_seconds
        
        # Initialize Fernet encryption
        fernet_secret = settings.preview_fernet_secret

        # Ensure key is 32 bytes for Fernet
        if len(fernet_secret.encode()) < 32:
            fernet_secret = fernet_secret.ljust(32, '0')
        elif len(fernet_secret.encode()) > 32:
            fernet_secret = fernet_secret[:32]
            
        self.fernet_key = base64.urlsafe_b64encode(fernet_secret.encode())
        self.fernet = Fernet(self.fernet_key)
    
    def sign_preview_url(self, uuid: str, expires_in: Optional[int] = None) -> str:
        """
        Generate a signed URL for preview audio access.
        
        Args:
            uuid: Track UUID to generate URL for
            expires_in: Expiration time in seconds (optional, uses default if not provided)
            
        Returns:
            Signed URL string
        """
        if expires_in is None:
            expires_in = self.expires_seconds
        
        # Calculate expiry timestamp
        expiry = str(int(time.time()) + expires_in).encode()
        
        # Encrypt expiry timestamp
        xpi = self.fernet.encrypt(expiry).decode()
        
        # Create HMAC token
        hmac_raw = f"{uuid}:{xpi}".encode()
        token = hmac.new(self.hmac_secret.encode(), hmac_raw, hashlib.sha256).hexdigest()
        
        # Generate signed URL
        signed_url = f"https://rmedia.resomix.com/signed-audio/?uuid={uuid}&xpi={xpi}&token={token}"
        
        return signed_url
    
    def verify_signed_url(self, uuid: str, xpi: str, token: str) -> bool:
        """
        Verify a signed URL's authenticity and expiration.
        
        Args:
            uuid: Track UUID from URL
            xpi: Encrypted expiry timestamp
            token: HMAC token
            
        Returns:
            True if URL is valid and not expired, False otherwise
        """
        try:
            # Verify HMAC token
            hmac_raw = f"{uuid}:{xpi}".encode()
            expected_token = hmac.new(self.hmac_secret.encode(), hmac_raw, hashlib.sha256).hexdigest()
            
            if not hmac.compare_digest(token, expected_token):
                return False
            
            # Decrypt and verify expiry
            expiry_bytes = self.fernet.decrypt(xpi.encode())
            expiry_timestamp = int(expiry_bytes.decode())
            
            # Check if URL has expired
            current_time = int(time.time())
            if current_time > expiry_timestamp:
                return False
            
            return True
            
        except Exception as e:
            print(f"Error verifying signed URL: {e}")
            return False
    
    def get_url_expiry(self, xpi: str) -> Optional[int]:
        """
        Get expiry timestamp from encrypted expiry parameter.
        
        Args:
            xpi: Encrypted expiry timestamp
            
        Returns:
            Expiry timestamp or None if decryption fails
        """
        try:
            expiry_bytes = self.fernet.decrypt(xpi.encode())
            return int(expiry_bytes.decode())
        except Exception:
            return None


# Global instance for easy access
url_signer = URLSigner()


def sign_secure_url(uuid: str, expires_in: Optional[int] = None) -> str:
    """
    Convenience function to generate signed URL.
    
    Args:
        uuid: Track UUID
        expires_in: Expiration time in seconds
        
    Returns:
        Signed URL string
    """
    return url_signer.sign_preview_url(uuid, expires_in)


def verify_secure_url(uuid: str, xpi: str, token: str) -> bool:
    """
    Convenience function to verify signed URL.
    
    Args:
        uuid: Track UUID
        xpi: Encrypted expiry timestamp
        token: HMAC token
        
    Returns:
        True if valid, False otherwise
    """
    return url_signer.verify_signed_url(uuid, xpi, token)
