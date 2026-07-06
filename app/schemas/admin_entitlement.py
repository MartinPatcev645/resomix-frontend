"""
Admin Entitlement Schemas
=========================

Request bodies for the Phase-7 admin plan/entitlement editor. Responses use the standard
``format_response`` envelope (data shaped by ``AdminEntitlementService``), so only request
models are defined here.
"""

from typing import Optional, Union

from pydantic import BaseModel, Field


class SetEntitlementRequest(BaseModel):
    """Set one plan × feature entitlement value. The value is validated + cast server-side
    against the feature's ``value_type`` (int / bool / enum / csv)."""

    value: Union[bool, int, str] = Field(
        ..., description="New value; type-checked against the feature's value_type."
    )

    class Config:
        json_schema_extra = {"example": {"value": 5}}


class UpdatePlanRequest(BaseModel):
    """Update plan-level flags. All fields optional; only provided fields are changed.
    Setting ``is_default=true`` clears the default flag on every other plan."""

    name: Optional[str] = Field(None, max_length=150)
    is_active: Optional[bool] = None
    is_default: Optional[bool] = None

    class Config:
        json_schema_extra = {"example": {"is_active": True}}
