"""
Admin User Controller
=====================

Handles administrative user management operations including CRUD, 
role assignment, and status management.

Version: 2.0.0
Date: May 22, 2026
Author: Muhammad Usman Naeem
"""

from typing import Dict, Any, List, Optional
from fastapi.responses import JSONResponse
from fastapi import status, Request, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
import time
import logging
from datetime import datetime

from app.services.user_service import UserService
from app.services.logging_service import LoggingService
from app.utils.response_utils import format_response
from app.models.user import User

logger = logging.getLogger(__name__)


class AdminUserController:
    """Controller for administrative user operations."""

    def __init__(self):
        self.user_service = UserService()
        self.logging_service = LoggingService()

    def _log_error(
        self,
        db: AsyncSession,
        request: Optional[Request],
        action: str,
        message: str,
        error: Exception,
        **metadata,
    ) -> None:
        """Record a failure in ``system_logs`` with its stack trace.

        `logger.error` alone only reaches the process log, which is not where anyone looks when an
        admin reports "it just says Failed". The log row is what carries the exception — without
        it, a 500 here is a dead end: the generic message tells the admin nothing and there is
        nothing to read afterwards either.
        """
        try:
            self.logging_service.log(
                async_db=db,
                level="ERROR",
                category="ADMIN_USER",
                action=action,
                message=message,
                request=request,
                status_code=500,
                metadata=metadata or None,
                error=error,
            )
        except Exception:  # noqa: BLE001 — logging must never mask the original failure
            logger.exception("Could not write the admin error log for %s", action)
        logger.exception("%s: %s", action, message)

    async def get_users_list(
        self,
        db: AsyncSession,
        request: Request,
        page: int = 1,
        page_size: int = 50,
        search: Optional[str] = None,
        role_id: Optional[int] = None,
        is_active: Optional[bool] = None,
    ) -> JSONResponse:
        """Get paginated list of users with filters."""
        start_time = time.time()
        correlation_id = self.logging_service.generate_correlation_id()

        try:
            users, total = await self.user_service.list_users_admin(
                db, page=page, page_size=page_size, search=search, role_id=role_id, is_active=is_active
            )

            # Plan for the whole page in three queries. Calling `get_effective_plan` per row would
            # be two queries each — a hundred for a fifty-row page.
            from app.services.admin_user_overview_service import AdminUserOverviewService

            plans = await AdminUserOverviewService.resolve_plans(db, list(users))

            user_list = []
            for u in users:
                user_list.append({
                    "uuid": u.uuid,
                    "email": u.email,
                    "username": u.username,
                    "name": u.name,
                    "partner_id": u.partner_id,
                    "is_active": u.is_active,
                    "is_email_verified": u.is_email_verified,
                    "roles": [r.role.name for r in u.roles],
                    "created_at": u.created_at.isoformat() if u.created_at else None,
                    # The plan they actually get, and when they were last here — the two questions
                    # the list was missing, both answerable without opening a row.
                    "plan": plans.get(u.id),
                    "last_seen_at": u.last_seen_at.isoformat() if u.last_seen_at else None,
                    "deactivated_at": u.deactivated_at.isoformat() if u.deactivated_at else None,
                    "purge_due_at": u.purge_due_at.isoformat() if u.purge_due_at else None,
                })

            duration_ms = (time.time() - start_time) * 1000
            response_data = {
                "success": True,
                "data": user_list,
                "pagination": {
                    "page": page,
                    "page_size": page_size,
                    "total": total,
                    "total_pages": (total + page_size - 1) // page_size if total > 0 else 0
                }
            }

            return JSONResponse(status_code=status.HTTP_200_OK, content=response_data)

        except Exception as e:
            self._log_error(db, request, "list_users_failed", "Failed to list users", e,
                            page=page, search=search)
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error="Failed to retrieve users list")
            )

    async def get_user_detail(self, db: AsyncSession, user_uuid: str) -> JSONResponse:
        """Get full details for a specific user."""
        try:
            user = await self.user_service.get_user_detail(db, user_uuid)
            if not user:
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content=format_response(success=False, error="User not found")
                )

            user_data = {
                "uuid": user.uuid,
                "email": user.email,
                "username": user.username,
                "name": user.name,
                "partner_id": user.partner_id,
                "is_active": user.is_active,
                "is_email_verified": user.is_email_verified,
                "is_two_factor_enabled": user.is_two_factor_enabled,
                "two_factor_method": user.two_factor_method,
                "roles": [r.role.name for r in user.roles],
                "created_at": user.created_at.isoformat() if user.created_at else None,
                "updated_at": user.updated_at.isoformat() if user.updated_at else None,
                "last_login": None
            }

            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=format_response(success=True, data=user_data)
            )

        except Exception as e:
            self._log_error(db, None, "user_detail_failed",
                            f"Failed to load detail for {user_uuid}", e, user_uuid=user_uuid)
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error="Failed to retrieve user details")
            )

    async def get_user_overview(self, db: AsyncSession, user_uuid: str) -> JSONResponse:
        """The admin user detail page, in one response."""
        from app.services.admin_user_overview_service import AdminUserOverviewService

        try:
            user = await self.user_service.get_user_detail(db, user_uuid)
            if not user:
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content=format_response(success=False, error="User not found"),
                )

            data = await AdminUserOverviewService().build(db, user)
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=format_response(success=True, data=data),
            )
        except Exception as e:
            self._log_error(db, None, "user_overview_failed",
                            f"Failed to build overview for {user_uuid}", e, user_uuid=user_uuid)
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error="Failed to load user overview"),
            )

    async def create_user(
        self,
        db: AsyncSession,
        request: Request,
        user_data: Dict[str, Any],
        current_admin: User
    ) -> JSONResponse:
        """Manually create a new user."""
        try:
            user = await self.user_service.admin_create_user(
                db=db,
                user_data=user_data,
                current_admin=current_admin,
                ip_address=request.client.host if request.client else None
            )

            return JSONResponse(
                status_code=status.HTTP_201_CREATED,
                content=format_response(success=True, data={"uuid": user.uuid, "message": "User created successfully"})
            )

        except HTTPException as he:
            return JSONResponse(
                status_code=he.status_code,
                content=format_response(success=False, error=he.detail)
            )
        except Exception as e:
            self._log_error(db, request, "user_create_failed", "Failed to create user", e)
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error="Failed to create user")
            )

    async def update_user(
        self,
        db: AsyncSession,
        request: Request,
        user_uuid: str,
        update_data: Dict[str, Any],
        current_admin: User
    ) -> JSONResponse:
        """Update user profile or status."""
        try:
            await self.user_service.admin_update_user(
                db=db,
                user_uuid=user_uuid,
                update_data=update_data,
                current_admin=current_admin,
                ip_address=request.client.host if request.client else None
            )

            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=format_response(success=True, message="User updated successfully")
            )

        except HTTPException as he:
            return JSONResponse(
                status_code=he.status_code,
                content=format_response(success=False, error=he.detail)
            )
        except Exception as e:
            self._log_error(db, request, "user_update_failed",
                            f"Failed to update {user_uuid}", e, user_uuid=user_uuid)
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error="Failed to update user")
            )

    async def assign_role(
        self,
        db: AsyncSession,
        request: Request,
        user_uuid: str,
        role_name: str,
        current_admin: User
    ) -> JSONResponse:
        """Assign a role to a user."""
        try:
            success = await self.user_service.admin_assign_role(
                db=db,
                user_uuid=user_uuid,
                role_name=role_name,
                current_admin=current_admin,
                ip_address=request.client.host if request.client else None
            )
            if success:
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content=format_response(success=True, message=f"Role '{role_name}' assigned to user")
                )
            else:
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content=format_response(success=False, error="Failed to assign role or already assigned")
                )

        except HTTPException as he:
            return JSONResponse(
                status_code=he.status_code,
                content=format_response(success=False, error=he.detail)
            )
        except Exception as e:
            self._log_error(db, request, "role_assign_failed",
                            f"Failed to assign {role_name} to {user_uuid}", e, user_uuid=user_uuid)
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error="Internal error during role assignment")
            )

    async def remove_role(
        self,
        db: AsyncSession,
        request: Request,
        user_uuid: str,
        role_name: str,
        current_admin: User
    ) -> JSONResponse:
        """Remove a role from a user."""
        try:
            success = await self.user_service.admin_remove_role(
                db=db,
                user_uuid=user_uuid,
                role_name=role_name,
                current_admin=current_admin,
                ip_address=request.client.host if request.client else None
            )
            if success:
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content=format_response(success=True, message=f"Role '{role_name}' removed from user")
                )
            else:
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content=format_response(success=False, error="Failed to remove role or not assigned")
                )

        except HTTPException as he:
            return JSONResponse(
                status_code=he.status_code,
                content=format_response(success=False, error=he.detail)
            )
        except Exception as e:
            self._log_error(db, request, "role_remove_failed",
                            f"Failed to remove {role_name} from {user_uuid}", e, user_uuid=user_uuid)
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error="Internal error during role removal")
            )

    async def grant_plan(
        self,
        db: AsyncSession,
        request: Request,
        user_uuid: str,
        current_admin: User,
        *,
        plan_code: str,
        duration_code: str,
        reason: str,
        note: Optional[str] = None,
    ) -> JSONResponse:
        """Give a user a plan free of charge, for a fixed period.

        No money and no Stripe object: this is entirely ours, and it is why the grant lives in its
        own table rather than in `user_subscriptions`.
        """
        from sqlalchemy import select

        from app.core.entitlement_keys import ACTIVE_SUBSCRIPTION_STATUSES, PlanCode
        from app.models.plan import Plan
        from app.models.purchase import UserSubscription
        from app.services.billing_service import BillingService
        from app.services.plan_grant_service import PlanGrantService

        try:
            user = await self.user_service.user_repo.async_get_by_uuid(db, user_uuid)
            if not user:
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content=format_response(success=False, error="User not found"),
                )

            plan = (
                await db.execute(select(Plan).where(Plan.code == plan_code))
            ).scalar_one_or_none()
            if plan is None:
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content=format_response(success=False, error=f"No plan with code {plan_code!r}"),
                )
            # `Plan` has NO `is_free` column — that field belongs to the BillingPlanDisplay DTO the
            # pricing page consumes. Reading it here raised AttributeError, which the broad
            # `except` below turned into a bare "Failed to grant plan" with nothing to debug from.
            # The model's own columns are `price_cents`, `is_active` and `is_assignable`.
            if plan.code in (PlanCode.FREE, PlanCode.GUEST) or plan.price_cents == 0:
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content=format_response(
                        success=False, error="That plan is already free — there is nothing to grant."
                    ),
                )
            if not plan.is_active or not plan.is_assignable:
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content=format_response(
                        success=False,
                        error=f"{plan.name} cannot be assigned (inactive or not assignable).",
                    ),
                )

            # Granting on top of a LIVE paid subscription does nothing visible: the subscription
            # outranks a grant in `get_effective_plan`, so the comp would sit inert and the admin
            # would reasonably think it had worked. Refused with an explanation rather than
            # silently accepted.
            #
            # A subscription that is CANCELLING or already ended is a different case — the grant
            # takes over when it lapses, which is a legitimate thing to want — so that is allowed.
            subscription = (
                await db.execute(
                    select(UserSubscription).where(UserSubscription.user_id == user.id)
                )
            ).scalar_one_or_none()
            if subscription is not None and subscription.status in ACTIVE_SUBSCRIPTION_STATUSES:
                cancellation = BillingService.cancellation_state(subscription)
                if not cancellation or not cancellation.get("pending"):
                    return JSONResponse(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        content=format_response(
                            success=False,
                            error="This user already has a live paid subscription, which takes "
                                  "precedence over a complimentary plan. Cancel it first, or wait "
                                  "until it is set to end.",
                        ),
                    )

            service = PlanGrantService()
            grant = await service.grant(
                db, user=user, plan=plan, duration_code=duration_code,
                granted_by=current_admin.id, reason=reason, note=note,
            )

            await self.admin_log_service.log_operation(
                db=db,
                admin_user_id=current_admin.id,
                action="user.plan_grant",
                target_type="user",
                target_id=user_uuid,
                before_state=None,
                after_state={
                    "plan": plan.code, "duration": duration_code,
                    "ends_at": grant.ends_at.isoformat(), "reason": reason,
                },
                ip_address=request.client.host if request and request.client else None,
            )
            await db.commit()

            try:
                from app.services.email_service import EmailService

                await EmailService().send_plan_granted(
                    email=user.email,
                    name=user.name or user.username or "there",
                    plan_name=plan.name,
                    ends_at=grant.ends_at.strftime("%-d %B %Y"),
                )
            except Exception as exc:  # noqa: BLE001 — the grant is already committed
                logger.error("Could not send plan-granted email to %s: %s", user.email, exc)

            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=format_response(
                    success=True,
                    data=PlanGrantService.describe(grant, plan),
                    message=f"{plan.name} granted until {grant.ends_at.strftime('%-d %B %Y')}",
                ),
            )
        except ValueError as e:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content=format_response(success=False, error=str(e)),
            )
        except Exception as e:
            self._log_error(db, request, "plan_grant_failed",
                            f"Failed to grant plan to {user_uuid}", e,
                            user_uuid=user_uuid, plan_code=plan_code, duration=duration_code)
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error="Failed to grant plan"),
            )

    async def revoke_plan_grant(
        self, db: AsyncSession, request: Request, user_uuid: str, current_admin: User
    ) -> JSONResponse:
        """End a complimentary plan early. The row is kept and stamped, never deleted."""
        from app.services.plan_grant_service import PlanGrantService

        try:
            user = await self.user_service.user_repo.async_get_by_uuid(db, user_uuid)
            if not user:
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content=format_response(success=False, error="User not found"),
                )

            grant = await PlanGrantService().revoke(
                db, user_id=user.id, revoked_by=current_admin.id
            )
            if grant is None:
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content=format_response(success=False, error="This user has no active grant."),
                )

            await self.admin_log_service.log_operation(
                db=db,
                admin_user_id=current_admin.id,
                action="user.plan_grant_revoked",
                target_type="user",
                target_id=user_uuid,
                before_state={"ends_at": grant.ends_at.isoformat()},
                after_state={"revoked_at": grant.revoked_at.isoformat()},
                ip_address=request.client.host if request and request.client else None,
            )
            await db.commit()

            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=format_response(success=True, message="Complimentary plan ended."),
            )
        except Exception as e:
            self._log_error(db, request, "plan_grant_revoke_failed",
                            f"Failed to revoke grant for {user_uuid}", e, user_uuid=user_uuid)
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error="Failed to revoke the grant"),
            )

    async def cancel_subscription(
        self,
        db: AsyncSession,
        request: Request,
        user_uuid: str,
        current_admin: User,
        *,
        immediate: bool = False,
    ) -> JSONResponse:
        """Cancel a user's paid subscription on their behalf.

        **No refund.** Money is returned only from the Stripe dashboard, which then fires
        `charge.refunded` and ends the subscription through that path instead. Cancelling here
        matches what the customer gets from the billing portal: billing stops, access continues to
        the end of the period they already paid for.

        `immediate=True` is the exception — access stops now, still with no refund. It exists for
        abuse cases, where letting someone run out the month is the wrong outcome.

        Stripe is called AFTER the local commit, the same rule the refund path follows: cancelling
        inside the transaction provokes a burst of subscription webhooks that race the uncommitted
        write, and the last one to land wins.
        """
        from sqlalchemy import select

        from app.models.purchase import UserSubscription
        from app.services.billing_refund_service import BillingRefundService

        try:
            user = await self.user_service.user_repo.async_get_by_uuid(db, user_uuid)
            if not user:
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content=format_response(success=False, error="User not found"),
                )

            row = (
                await db.execute(
                    select(UserSubscription).where(UserSubscription.user_id == user.id)
                )
            ).scalar_one_or_none()
            if row is None or not row.stripe_subscription_id:
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content=format_response(
                        success=False, error="This user has no Stripe subscription to cancel."
                    ),
                )
            if row.status not in ("active", "trialing", "past_due"):
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content=format_response(
                        success=False,
                        error=f"That subscription is already {row.status} — nothing to cancel.",
                    ),
                )

            subscription_id = row.stripe_subscription_id
            await self.admin_log_service.log_operation(
                db=db,
                admin_user_id=current_admin.id,
                action="user.subscription_cancelled",
                target_type="user",
                target_id=user_uuid,
                before_state={"status": row.status, "subscription": subscription_id},
                after_state={"immediate": immediate},
                ip_address=request.client.host if request and request.client else None,
            )
            await db.commit()

            # Stripe is the source of truth for the cancellation; the `customer.subscription.*`
            # webhook it fires writes our row and sends the customer's email through the same path
            # a self-service cancellation uses. No second email from here — that would duplicate it.
            service = BillingRefundService()
            ok = (
                service.cancel_in_stripe(subscription_id)
                if immediate
                else service.cancel_at_period_end(subscription_id)
            )
            if not ok:
                return JSONResponse(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    content=format_response(
                        success=False,
                        error="Stripe refused the cancellation. Nothing has changed — check the "
                              "Stripe dashboard before retrying.",
                    ),
                )

            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=format_response(
                    success=True,
                    message=(
                        "Subscription cancelled immediately. The customer has been emailed."
                        if immediate
                        else "Subscription will end at the end of the paid period. The customer "
                             "has been emailed."
                    ),
                ),
            )
        except Exception as e:
            self._log_error(db, request, "subscription_cancel_failed",
                            f"Failed to cancel subscription for {user_uuid}", e,
                            user_uuid=user_uuid, immediate=immediate)
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error="Failed to cancel the subscription"),
            )

    async def pending_deletions(self, db: AsyncSession, request: Request) -> JSONResponse:
        """Accounts waiting to be scrubbed, oldest first.

        THE ONLY PLACE THE LEGAL CLOCK IS VISIBLE. Nothing scrubs on a timer, and the user is told
        "within 4 weeks" rather than a date — so if this queue is not watched, a request simply
        sits. Art. 12(3) gives us one month to act, and "failed to respond in time / no proper
        process" is the category regulators actually fine.

        `waiting_days` is computed here rather than in the UI so the amber/red thresholds cannot
        drift between screens, and `overdue` is stated outright rather than left to a comparison
        someone might get the wrong way round.

        Already-scrubbed accounts are excluded: `deletion_requested_at IS NOT NULL AND
        anonymized_at IS NULL` is exactly "asked to leave, not yet actioned".
        """
        from app.core.config import settings

        try:
            sla = settings.deletion_request_sla_days
            rows = (
                await db.execute(
                    text(
                        "SELECT uuid, email, name, username, deletion_requested_at, purge_due_at "
                        "FROM users "
                        "WHERE deletion_requested_at IS NOT NULL AND anonymized_at IS NULL "
                        "ORDER BY deletion_requested_at ASC"
                    )
                )
            ).fetchall()

            now = datetime.utcnow()
            items = []
            for uuid_, email, name, username, requested_at, due_at in rows:
                waiting = (now - requested_at).days if requested_at else 0
                items.append(
                    {
                        "uuid": uuid_,
                        "email": email,
                        "name": name or username,
                        "deletion_requested_at": requested_at.isoformat() if requested_at else None,
                        "purge_due_at": due_at.isoformat() if due_at else None,
                        "waiting_days": waiting,
                        # Amber from two-thirds of the window, so it is noticed with time to act
                        # rather than on the day it is already too late.
                        "approaching": sla * 2 // 3 <= waiting < sla,
                        "overdue": waiting >= sla,
                    }
                )

            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=format_response(
                    success=True,
                    data={
                        "items": items,
                        "total": len(items),
                        "sla_days": sla,
                        "overdue": sum(1 for i in items if i["overdue"]),
                    },
                ),
            )
        except Exception as e:
            self._log_error(db, request, "pending_deletions_failed",
                            "Failed to list pending deletions", e)
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error="Failed to list pending deletions"),
            )

    async def purge_user(
        self,
        db: AsyncSession,
        request: Request,
        user_uuid: str,
        current_admin: User,
        *,
        dry_run: bool = True,
    ) -> JSONResponse:
        """Scrub a deleted account, or report what that would change.

        Runs :class:`AccountScrubService`, not the purge service. The account row survives with its
        `id` and `uuid` intact — that is what keeps playlists, invoices and support history joined
        and analysable — and only the identifying columns are cleared. See
        ``docs/ACCOUNT_DELETION_GDPR_OPTIONS.md`` §1.

        Three guards before anything irreversible happens, because this is the one admin action
        with no undo:

        1. the account must already be **deactivated** — scrubbing a live account strips someone's
           identity mid-session, with no notice;
        2. an admin cannot scrub themselves;
        3. an already-scrubbed account is reported as such rather than scrubbed twice.

        The 30-day SLA is deliberately NOT enforced here. It is an obligation on *us*, not a
        waiting period to serve: support sometimes needs to honour an erasure request the same day,
        and blocking that would mean editing the database by hand, which is worse. The manifest
        reports how long the request has been waiting so the decision is informed.
        """
        from app.services.account_scrub_service import AccountScrubService

        try:
            user = await self.user_service.user_repo.async_get_by_uuid(db, user_uuid)
            if not user:
                return JSONResponse(
                    status_code=status.HTTP_404_NOT_FOUND,
                    content=format_response(success=False, error="User not found"),
                )

            if user.id == current_admin.id:
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content=format_response(
                        success=False, error="You cannot delete your own account"
                    ),
                )

            if user.is_active:
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content=format_response(
                        success=False,
                        error="This account is still active. Deactivate it first — scrubbing a "
                              "live account removes someone's details with no notice.",
                    ),
                )

            service = AccountScrubService()

            if service.is_scrubbed(user) and not dry_run:
                # Not an error: the admin has almost certainly clicked twice, or two admins picked
                # up the same queue row. Saying so beats a second no-op reported as a fresh success.
                return JSONResponse(
                    status_code=status.HTTP_409_CONFLICT,
                    content=format_response(
                        success=False,
                        error="This account was already scrubbed on "
                              f"{user.anonymized_at:%-d %B %Y}.",
                    ),
                )

            # Captured BEFORE the scrub: the row will not carry them afterwards, and the completion
            # email is the only signal the user gets that their request was actioned (Art. 12(3)).
            email, name = user.email, (user.name or user.username or "there")

            manifest = await service.scrub(db, user, dry_run=dry_run)
            payload = manifest.as_dict()
            payload["deletion_requested_at"] = (
                user.deletion_requested_at.isoformat() if user.deletion_requested_at else None
            )
            payload["purge_due_at"] = user.purge_due_at.isoformat() if user.purge_due_at else None

            if dry_run:
                return JSONResponse(
                    status_code=status.HTTP_200_OK,
                    content=format_response(success=True, data=payload),
                )

            await self.admin_log_service.log_operation(
                db=db,
                admin_user_id=current_admin.id,
                action="user.scrub",
                target_type="user",
                target_id=user_uuid,
                before_state={"email": email},
                after_state=payload,
                ip_address=request.client.host if request and request.client else None,
            )
            await db.commit()

            # Last, and best-effort. A mail failure cannot un-scrub anything, and reporting it as
            # an error would suggest the scrub had not happened.
            try:
                from app.services.email_service import EmailService

                await EmailService().send_account_deleted(email=email, name=name)
            except Exception as exc:  # noqa: BLE001
                logger.error("Could not send account-deleted email to %s: %s", email, exc)

            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=format_response(success=True, data=payload),
            )

        except (RuntimeError, ValueError) as e:
            # The service aborts rather than half-scrub, so nothing has changed at this point.
            self._log_error(db, request, "user_scrub_refused",
                            f"Scrub refused for {user_uuid}: {e}", e, user_uuid=user_uuid)
            return JSONResponse(
                status_code=status.HTTP_409_CONFLICT,
                content=format_response(success=False, error=str(e)),
            )
        except Exception as e:
            self._log_error(db, request, "user_scrub_failed",
                            f"Failed to scrub {user_uuid}", e, user_uuid=user_uuid, dry_run=dry_run)
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error="Failed to delete user"),
            )

    async def toggle_user_status(
        self,
        db: AsyncSession,
        request: Request,
        user_uuid: str,
        current_admin: User
    ) -> JSONResponse:
        """Toggle user active/inactive status."""
        try:
            user = await self.user_service.admin_toggle_user_status(
                db=db,
                user_uuid=user_uuid,
                current_admin=current_admin,
                ip_address=request.client.host if request.client else None
            )

            status_str = "activated" if user.is_active else "deactivated"
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content=format_response(success=True, message=f"User {status_str} successfully")
            )

        except HTTPException as he:
            return JSONResponse(
                status_code=he.status_code,
                content=format_response(success=False, error=he.detail)
            )
        except Exception as e:
            self._log_error(db, request, "toggle_status_failed",
                            f"Failed to toggle status for {user_uuid}", e, user_uuid=user_uuid)
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content=format_response(success=False, error="Failed to toggle user status")
            )
