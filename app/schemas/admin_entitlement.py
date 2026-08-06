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


class AddPlanPriceRequest(BaseModel):
    """Attach a Stripe price to a plan. The amount/currency/product are pulled from Stripe by ID
    (source of truth); ``interval`` is a fallback if the price isn't recurring."""

    stripe_price_id: str = Field(..., description="Stripe Price ID, e.g. price_123...")
    interval: str = Field("month", description="Billing interval fallback (month|year).")
    # Defaults to `list`, which is what every price was before the founding offer existed — so an
    # existing caller that omits it keeps its old behaviour exactly.
    price_kind: str = Field(
        "list",
        description="founding | list. Part of the upsert key: a founding price must NOT overwrite the list price it will later roll onto.",
    )

    class Config:
        json_schema_extra = {"example": {"stripe_price_id": "price_123", "interval": "month"}}


class UpdatePlanPriceRequest(BaseModel):
    """Toggle a plan price active/inactive."""

    is_active: bool = Field(..., description="Whether this price is offered.")

    class Config:
        json_schema_extra = {"example": {"is_active": False}}
