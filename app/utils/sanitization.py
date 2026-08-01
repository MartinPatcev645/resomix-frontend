"""
Sanitization Utilities
=====================

This module provides sanitization functions for database name fields.
It handles problematic characters, length limits, and ensures database compatibility
for artist names, label names, genre names, and album titles.

Removes or replaces characters that could cause database constraint violations
or SQL issues, and enforces appropriate length limits for each field type.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

import logging

logger = logging.getLogger(__name__)


def sanitize_name(name: str, field_type: str = "name") -> str:
    """
    Sanitize name for database insertion.
    
    Removes or replaces problematic characters that could cause
    database constraint violations or SQL issues.
    
    Args:
        name: Raw name from metadata
        field_type: Type of field for logging (e.g., "artist", "label", "genre")
        
    Returns:
        Sanitized name safe for database insertion
    """
    if not name or not isinstance(name, str):
        return "Unknown"
    
    # Remove null bytes and control characters
    name = ''.join(char for char in name if ord(char) >= 32)
    
    # Replace problematic characters
    replacements = {
        '\\': '/',  # Replace backslashes with forward slashes
        '"': "'",   # Replace double quotes with single quotes
        '`': "'",   # Replace backticks with single quotes
        '\x00': '', # Remove null bytes
        '\x01': '', # Remove start of heading
        '\x02': '', # Remove start of text
        '\x03': '', # Remove end of text
        '\x04': '', # Remove end of transmission
        '\x05': '', # Remove enquiry
        '\x06': '', # Remove acknowledge
        '\x07': '', # Remove bell
        '\x08': '', # Remove backspace
        '\x0b': '', # Remove vertical tab
        '\x0c': '', # Remove form feed
        '\x0e': '', # Remove shift out
        '\x0f': '', # Remove shift in
        '\x10': '', # Remove data link escape
        '\x11': '', # Remove device control 1
        '\x12': '', # Remove device control 2
        '\x13': '', # Remove device control 3
        '\x14': '', # Remove device control 4
        '\x15': '', # Remove negative acknowledge
        '\x16': '', # Remove synchronous idle
        '\x17': '', # Remove end of transmission block
        '\x18': '', # Remove cancel
        '\x19': '', # Remove end of medium
        '\x1a': '', # Remove substitute
        '\x1b': '', # Remove escape
        '\x1c': '', # Remove file separator
        '\x1d': '', # Remove group separator
        '\x1e': '', # Remove record separator
        '\x1f': '', # Remove unit separator
    }
    
    for old_char, new_char in replacements.items():
        name = name.replace(old_char, new_char)
    
    # Normalize whitespace
    name = ' '.join(name.split())
    
    # Trim to appropriate database column limits
    if field_type == "artist":
        max_length = 100  # VARCHAR(100) for artists
    elif field_type == "label":
        max_length = 120  # VARCHAR(120) for labels
    elif field_type == "genre":
        max_length = 80   # VARCHAR(80) for genres
    elif field_type == "album":
        max_length = 200  # VARCHAR(200) for albums
    else:
        max_length = 100  # Default
    
    if len(name) > max_length:
        name = name[:max_length-3] + "..."
    
    # Ensure we have a valid name
    if not name or name.isspace():
        return "Unknown"
    
    return name.strip()


def sanitize_artist_name(name: str) -> str:
    """
    Sanitize artist name for database insertion.
    
    Args:
        name: Raw artist name from metadata
        
    Returns:
        Sanitized artist name safe for database insertion
    """
    return sanitize_name(name, "artist")


def sanitize_label_name(name: str) -> str:
    """
    Sanitize label name for database insertion.
    
    Args:
        name: Raw label name from metadata
        
    Returns:
        Sanitized label name safe for database insertion
    """
    return sanitize_name(name, "label")


def sanitize_genre_name(name: str) -> str:
    """
    Sanitize genre name for database insertion.
    
    Args:
        name: Raw genre name from metadata
        
    Returns:
        Sanitized genre name safe for database insertion
    """
    return sanitize_name(name, "genre")


def sanitize_album_title(title: str) -> str:
    """
    Sanitize album title for database insertion.
    
    Args:
        title: Raw album title from metadata
        
    Returns:
        Sanitized album title safe for database insertion
    """
    return sanitize_name(title, "album")
    

# Characters that make a spreadsheet treat a cell as a formula rather than text.
_CSV_FORMULA_TRIGGERS = ("=", "+", "-", "@", "\t", "\r")


def csv_safe(value) -> str:
    """Neutralise a value that will be written into a CSV cell.

    Excel, LibreOffice and Google Sheets execute a cell beginning with ``=``, ``+``, ``-`` or ``@``
    as a formula on open. A user-supplied name is therefore a code-execution vector against whoever
    opens the export — the classic "CSV injection". Prefixing a single quote makes the spreadsheet
    read it as literal text; the quote is not part of the stored value and is not shown once parsed.

    This belongs on the WAY OUT, not on the way in. Restricting what a user may type would not fix
    it (a name starting with ``-`` was accepted by the old playlist-name allowlist and was already
    a live formula), and it would block legitimate names for a problem that only exists in one
    output format.

    Args:
        value: Any cell value; non-strings are returned unchanged.

    Returns:
        The value, prefixed with ``'`` when a spreadsheet would otherwise evaluate it.
    """
    if not isinstance(value, str) or not value:
        return value
    return f"'{value}" if value.startswith(_CSV_FORMULA_TRIGGERS) else value
