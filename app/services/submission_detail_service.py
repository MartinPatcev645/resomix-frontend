"""
Submission detail for the admin screens
=======================================

Everything we hold about one contact submission or one piece of feedback, plus **who sent it**.

WHY THE SUBMITTER MATTERS MOST

The row itself answers "what did they say". It does not answer the question an admin actually has,
which is "who is this and should I care" — a paying customer three weeks into a founding
subscription is a different conversation from an anonymous form fill, and the contact table cannot
tell them apart.

AUTHENTICATED VS GUEST

``contacts.user_id`` and ``feedbacks.user_id`` are both nullable — either can be submitted by
someone who is not signed in. So this returns one of two shapes:

* **account** — the resolved user, their plan, when they joined, when they were last seen, and
  what else they have sent us;
* **guest** — whatever the form itself carried (contacts have a name, email and phone; feedback
  has nothing at all), plus the IP and browser.

The guest shape is deliberately not padded out to look like the account one. "We do not know who
this was" is the honest answer, and dressing it up would invite an admin to trust it.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User

logger = logging.getLogger(__name__)


def _iso(value) -> Optional[str]:
    return value.isoformat() if value else None


class SubmissionDetailService:
    """Assembles the full picture behind a contact or feedback row."""

    async def submitter(
        self, db: AsyncSession, *, user_id: Optional[int], fallback_email: Optional[str] = None
    ) -> Dict[str, Any]:
        """Who sent this — resolved from the account when there is one.

        ``fallback_email`` lets a guest submission still be matched to an account: someone who
        wrote in before signing up, or who was simply signed out at the time, is the same person,
        and treating them as anonymous loses the thread.
        """
        user: Optional[User] = None
        if user_id:
            user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
        elif fallback_email:
            user = (
                await db.execute(select(User).where(User.email == fallback_email))
            ).scalar_one_or_none()

        if user is None:
            return {"type": "guest", "matched_account": False}

        plan = None
        try:
            from app.services.entitlement_service import EntitlementService

            resolved = await EntitlementService().get_effective_plan(db, user)
            plan = {"code": resolved.code, "name": resolved.name} if resolved else None
        except Exception as exc:  # noqa: BLE001 — a plan lookup must not blank the panel
            logger.warning("SUBMISSION: could not resolve plan for user %s: %s", user.id, exc)

        return {
            # `matched_account` distinguishes "they were signed in" from "we found them by email
            # afterwards" — the second is an inference, and an admin should know which they have.
            "type": "account" if user_id else "guest",
            "matched_account": True,
            "matched_by_email": user_id is None,
            "id": user.id,
            "uuid": user.uuid,
            "email": user.email,
            "username": user.username,
            "name": user.name,
            "is_active": user.is_active,
            "is_email_verified": user.is_email_verified,
            "created_at": _iso(user.created_at),
            "last_seen_at": _iso(getattr(user, "last_seen_at", None)),
            "deactivated_at": _iso(getattr(user, "deactivated_at", None)),
            "plan": plan,
            **await self._submission_counts(db, user.id),
        }

    @staticmethod
    async def resolve_submitters(
        db: AsyncSession, user_ids
    ) -> Dict[int, Dict[str, Any]]:
        """Thin submitter details for a whole PAGE of rows, in one query.

        The feedback list stores nothing but ``user_id``, so the admin table could only ever show a
        number — useless for deciding which row to open first. This resolves the page in a single
        round trip rather than N.

        Deliberately thinner than :meth:`submitter`: no plan, no submission counts. Those cost a
        query each and only matter once a row is actually opened.
        """
        ids = {int(i) for i in user_ids if i}
        if not ids:
            return {}
        try:
            rows = (await db.execute(select(User).where(User.id.in_(ids)))).scalars().all()
            return {
                u.id: {
                    "id": u.id,
                    "uuid": u.uuid,
                    "email": u.email,
                    "username": u.username,
                    "name": u.name,
                    "is_active": u.is_active,
                }
                for u in rows
            }
        except Exception as exc:  # noqa: BLE001 — a name column must never take the list down
            logger.warning("SUBMISSION: could not resolve submitters: %s", exc)
            return {}

    @staticmethod
    async def _submission_counts(db: AsyncSession, user_id: int) -> Dict[str, int]:
        """How much this person has written to us before.

        A fourth message in a fortnight reads very differently from a first one, and that context
        is invisible on a screen that shows a single row.
        """
        try:
            row = (
                await db.execute(
                    text(
                        "SELECT (SELECT COUNT(*) FROM contacts WHERE user_id = :uid) AS contacts, "
                        "       (SELECT COUNT(*) FROM feedbacks WHERE user_id = :uid) AS feedbacks"
                    ),
                    {"uid": user_id},
                )
            ).mappings().first()
            return {
                "total_contacts": int((row or {}).get("contacts") or 0),
                "total_feedbacks": int((row or {}).get("feedbacks") or 0),
            }
        except Exception as exc:  # noqa: BLE001
            logger.warning("SUBMISSION: counts unavailable for user %s: %s", user_id, exc)
            return {"total_contacts": -1, "total_feedbacks": -1}

    async def contact(self, db: AsyncSession, contact_id: int) -> Optional[Dict[str, Any]]:
        """One contact submission, in full."""
        from app.models.contact import Contact

        row = (
            await db.execute(select(Contact).where(Contact.id == contact_id))
        ).scalar_one_or_none()
        if row is None:
            return None

        return {
            "id": row.id,
            "status": row.status,
            "contact_type": row.contact_type,
            "submitted_at": _iso(row.submitted_at),
            # What they typed.
            "name": row.name,
            "email": row.email,
            "phone": row.phone,
            "subject": row.subject,
            "message": row.message,
            # The B2B block — only ever populated on a partner request, so the UI can hide it
            # entirely rather than showing six empty rows on a consumer enquiry.
            "business": {
                "company_name": row.company_name,
                "role": row.role,
                "partner_type": row.partner_type,
                "preferred_path": row.preferred_path,
                "catalog_context": row.catalog_context,
                "catalog_size": row.catalog_size,
                "estimated_calls": row.estimated_calls,
            },
            "request": {
                "client_ip": getattr(row, "client_ip", None),
                "user_agent": getattr(row, "user_agent", None),
            },
            "submitter": await self.submitter(db, user_id=row.user_id, fallback_email=row.email),
            "replies": await self._replies(db, "contact", row.id),
        }

    async def feedback(self, db: AsyncSession, feedback_id: int) -> Optional[Dict[str, Any]]:
        """One piece of feedback, in full."""
        from app.models.feedback import Feedback

        row = (
            await db.execute(select(Feedback).where(Feedback.id == feedback_id))
        ).scalar_one_or_none()
        if row is None:
            return None

        return {
            "id": row.id,
            "status": row.status,
            "category": row.category,
            "submitted_at": _iso(row.submitted_at),
            "message": row.message,
            # Two separate 1–10 scores. Labelled here so the UI never has to guess which is which.
            "satisfaction": row.satisfaction,
            "recommendation": row.recommendation,
            "request": {
                "client_ip": getattr(row, "client_ip", None),
                "user_agent": getattr(row, "user_agent", None),
            },
            # Feedback carries no email of its own, so there is nothing to match a guest on.
            "submitter": await self.submitter(db, user_id=row.user_id),
            "replies": await self._replies(db, "feedback", row.id),
        }

    @staticmethod
    async def _replies(db: AsyncSession, channel: str, source_id: int) -> list:
        """What we have already sent back — so nobody answers the same thread twice."""
        try:
            from app.services.user_message_service import UserMessageService

            rows = await UserMessageService.history(db, channel=channel, source_id=source_id)
            return [
                {
                    "id": r.id,
                    "subject": r.subject,
                    "body": r.body,
                    "recipient_email": r.recipient_email,
                    "status": r.status,
                    "created_at": _iso(r.created_at),
                }
                for r in rows
            ]
        except Exception as exc:  # noqa: BLE001
            logger.warning("SUBMISSION: replies unavailable for %s %s: %s", channel, source_id, exc)
            return []
