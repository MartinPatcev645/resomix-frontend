"""
Playlist Engagement Schemas
===========================

Pydantic schemas for playlist engagement responses (favorites and follows).

Version: 3.0.1
Init Date: November 04, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from pydantic import BaseModel, Field


class PlaylistEngagementData(BaseModel):
    """Engagement state data returned to clients."""
    is_favorite: bool = Field(..., description="Whether the playlist is in user's favorites")
    is_following: bool = Field(..., description="Whether the user is following the playlist")

    class Config:
        json_schema_extra = {
            "example": {
                "is_favorite": True,
                "is_following": False
            }
        }


class PlaylistEngagementResponse(BaseModel):
    """Standard engagement response wrapper."""
    success: bool = Field(..., description="Whether the operation was successful")
    data: PlaylistEngagementData = Field(..., description="Engagement state")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "data": {
                    "is_favorite": True,
                    "is_following": False
                }
            }
        }
