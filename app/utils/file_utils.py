"""
File Utilities
=============

This module provides utilities for file operations and filename handling.

Functions:
- sanitize_filename: Sanitizes filenames to prevent security issues.

Author: AI Assistant
Date: May 2023
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
