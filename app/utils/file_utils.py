"""
File Utilities
==============

This module provides utilities for file operations and filename handling
throughout the Resomix application. It handles filename sanitization,
security validation, and file path processing.

Centralizes file-related utility functions to ensure consistent and secure
file handling across all application components.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

import os
import re
from datetime import datetime


def sanitize_filename(filename: str) -> str:
    """
    Sanitize a filename to prevent directory traversal and other security issues.
    
    Args:
        filename: The original filename
        
    Returns:
        Sanitized filename
    """
    # Remove path components (keeps only the basename)
    sanitized = os.path.basename(filename)
    
    # Replace problematic characters
    sanitized = re.sub(r'[^\w\s.-]', '_', sanitized)
    
    # Ensure it's not empty
    if not sanitized or sanitized.startswith('.'):
        sanitized = f"file_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    return sanitized
