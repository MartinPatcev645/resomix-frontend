"""
Bandcamp schemas
================

Request models for the Bandcamp collection import endpoints.
"""

from pydantic import BaseModel, Field


class BandcampConnectRequest(BaseModel):
    """Public Bandcamp fan username (or a pasted ``https://bandcamp.com/<username>`` link)."""

    username: str = Field(..., min_length=1, max_length=200, description="Public Bandcamp fan username")
