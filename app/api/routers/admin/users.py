"""
Admin Users Router
==================

API endpoints for administrative user management.
Guarded by robust RBAC and DB-backed admin verification.

Version: 1.0.0
Date: May 16, 2026
Author: Muhammad Usman Naeem
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession

from database.connection import get_async_db
from app.api.dependencies.auth import require_admin, require_permission
from app.controllers.admin_user_controller import AdminUserController
from app.schemas.admin_user import (
    AdminUserListResponse,
    AdminUserCreateRequest,
    AdminUserUpdateRequest,
    AdminRoleAssignRequest,
    AdminPlanGrantRequest,
)
from app.models.user import User

router = APIRouter(
    prefix="/admin/users",
    tags=["Admin User Management"],
    dependencies=[Depends(require_admin), Depends(require_permission("user:read"))]
)

user_controller = AdminUserController()


@router.get("", response_model=AdminUserListResponse)
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    search: Optional[str] = Query(None, description="Search by email, username, or name"),
    role_id: Optional[int] = Query(None, description="Filter by role ID"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    db: AsyncSession = Depends(get_async_db),
    request: Request = None
):
    """List all users with pagination and filters."""
    return await user_controller.get_users_list(
        db, request, page, page_size, search, role_id, is_active
    )


@router.get("/pending-deletions", dependencies=[Depends(require_permission("user:read"))])
async def pending_deletions(
    request: Request,
    db: AsyncSession = Depends(get_async_db),
    current_admin: User = Depends(require_admin),
):
    """Accounts that asked to be deleted and have not been actioned yet, oldest first.

    Each row carries `waiting_days`, `approaching` and `overdue`. Art. 12(3) gives us one month,
    nothing scrubs on a timer, and the user is told "within 4 weeks" rather than a date — so this
    queue is the only thing that surfaces the obligation.
    """
    return await user_controller.pending_deletions(db, request)


@router.get("/{user_uuid}")
async def get_user(
    user_uuid: str,
    db: AsyncSession = Depends(get_async_db)
):
    """Get detailed information for a single user."""
    return await user_controller.get_user_detail(db, user_uuid)


@router.get("/{user_uuid}/overview")
async def get_user_overview(
    user_uuid: str,
    db: AsyncSession = Depends(get_async_db),
):
    """Everything about one user on one screen — identity, activity, plan, billing, counts, support.

    Separate from `GET /{uuid}` on purpose: this is a dozen aggregates, and only the detail PAGE
    needs them. The list endpoint and the edit dialog must not pay for them.
    """
    return await user_controller.get_user_overview(db, user_uuid)


@router.post("", dependencies=[Depends(require_permission("user:create"))])
async def create_user(
    user_data: AdminUserCreateRequest,
    db: AsyncSession = Depends(get_async_db),
    request: Request = None,
    current_admin: User = Depends(require_admin)
):
    """Manually create a new user account."""
    return await user_controller.create_user(
        db, request, user_data.model_dump(), current_admin
    )


@router.patch("/{user_uuid}", dependencies=[Depends(require_permission("user:update"))])
async def update_user(
    user_uuid: str,
    update_data: AdminUserUpdateRequest,
    db: AsyncSession = Depends(get_async_db),
    request: Request = None,
    current_admin: User = Depends(require_admin)
):
    """Update user profile or metadata."""
    return await user_controller.update_user(
        db, request, user_uuid, update_data.model_dump(exclude_unset=True), current_admin
    )


@router.post("/{user_uuid}/roles", dependencies=[Depends(require_permission("user:role:assign"))])
async def assign_role(
    user_uuid: str,
    role_data: AdminRoleAssignRequest,
    db: AsyncSession = Depends(get_async_db),
    request: Request = None,
    current_admin: User = Depends(require_admin)
):
    """Assign an RBAC role to a user."""
    return await user_controller.assign_role(
        db, request, user_uuid, role_data.role_name, current_admin
    )


@router.delete("/{user_uuid}/roles/{role_name}", dependencies=[Depends(require_permission("user:role:assign"))])
async def remove_role(
    user_uuid: str,
    role_name: str,
    db: AsyncSession = Depends(get_async_db),
    request: Request = None,
    current_admin: User = Depends(require_admin)
):
    """Remove an RBAC role from a user."""
    return await user_controller.remove_role(
        db, request, user_uuid, role_name, current_admin
    )


@router.post("/{user_uuid}/plan-grant", dependencies=[Depends(require_permission("user:update"))])
async def grant_plan(
    user_uuid: str,
    payload: AdminPlanGrantRequest,
    db: AsyncSession = Depends(get_async_db),
    request: Request = None,
    current_admin: User = Depends(require_admin),
):
    """Give a user a plan free of charge, for a fixed period.

    No money changes hands and no Stripe object is created — this is complimentary access we
    control, and it ends by itself. The user is emailed, and the grant is visible on their profile
    and pricing page so they are never in any doubt that it is free and temporary.
    """
    return await user_controller.grant_plan(
        db, request, user_uuid, current_admin,
        plan_code=payload.plan_code,
        duration_code=payload.duration,
        reason=payload.reason,
        note=payload.note,
    )


@router.delete("/{user_uuid}/plan-grant", dependencies=[Depends(require_permission("user:update"))])
async def revoke_plan_grant(
    user_uuid: str,
    db: AsyncSession = Depends(get_async_db),
    request: Request = None,
    current_admin: User = Depends(require_admin),
):
    """End a complimentary plan early. The record is kept, stamped as revoked."""
    return await user_controller.revoke_plan_grant(db, request, user_uuid, current_admin)


@router.post("/{user_uuid}/cancel-subscription", dependencies=[Depends(require_permission("user:update"))])
async def cancel_user_subscription(
    user_uuid: str,
    immediate: bool = Query(
        False,
        description="End access now instead of at the end of the paid period. Still no refund.",
    ),
    db: AsyncSession = Depends(get_async_db),
    request: Request = None,
    current_admin: User = Depends(require_admin),
):
    """Cancel a user's paid subscription on their behalf.

    **This never refunds anything.** Money is returned only from the Stripe dashboard, which fires
    `charge.refunded` and ends the subscription through that path instead. By default this behaves
    exactly like the customer cancelling from the billing portal: billing stops, access runs to the
    end of the period they have already paid for.

    The confirmation email is sent by the `customer.subscription.*` webhook Stripe fires in
    response, so the customer gets the same message whoever pressed the button.
    """
    return await user_controller.cancel_subscription(
        db, request, user_uuid, current_admin, immediate=immediate
    )


@router.post("/{user_uuid}/deletion-delay-notice",
             dependencies=[Depends(require_permission("user:message"))])
async def notify_deletion_delay(
    request: Request,
    user_uuid: str,
    payload: dict,
    db: AsyncSession = Depends(get_async_db),
    current_admin: User = Depends(require_admin),
):
    """Tell a user their erasure request is running past the one-month mark.

    Art. 12(3) permits extending to three months only if the person is told within the first month,
    with reasons — so `reason` is required and is written by the admin.
    """
    return await user_controller.notify_deletion_delay(
        db, request, user_uuid, current_admin, (payload or {}).get("reason", "")
    )


@router.delete("/{user_uuid}", dependencies=[Depends(require_permission("user:delete"))])
async def purge_user(
    user_uuid: str,
    dry_run: bool = Query(
        True,
        description="Report what would happen without changing anything. Defaults to TRUE — the "
                    "destructive path has to be asked for by name.",
    ),
    db: AsyncSession = Depends(get_async_db),
    request: Request = None,
    current_admin: User = Depends(require_admin),
):
    """Permanently destroy a deleted account's data.

    Never automatic and never reversible. A user's deletion request only *schedules* this
    (`users.purge_due_at`, 30 days out); an admin decides when it actually happens.

    Financial and analytics records survive, repointed to the tombstone user — invoices,
    subscription events, orders, consents and the admin audit trail. Everything that is the person
    or their content is destroyed: playlists, uploaded tracks and their media, analyses, contacts,
    feedback, sessions.

    Call it once with `dry_run=true` (the default) to see the manifest, then again with
    `dry_run=false` to carry it out.
    """
    return await user_controller.purge_user(
        db, request, user_uuid, current_admin, dry_run=dry_run
    )


@router.post("/{user_uuid}/toggle-status", dependencies=[Depends(require_permission("user:update"))])
async def toggle_status(
    user_uuid: str,
    db: AsyncSession = Depends(get_async_db),
    request: Request = None,
    current_admin: User = Depends(require_admin)
):
    """Toggle user active status."""
    return await user_controller.toggle_user_status(
        db, request, user_uuid, current_admin
    )
