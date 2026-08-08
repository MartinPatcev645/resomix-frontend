"""
Admin → user messaging
======================

One place that renders and sends everything an admin writes to a user: a reply to a contact form,
a reply to feedback, or a direct message.

PREVIEW AND SEND SHARE ONE RENDERER

``render`` builds the HTML; ``send`` calls ``render`` and posts it. There is no second path. A
preview that can differ from what is actually sent is worse than no preview at all — it invites an
admin to approve one thing and deliver another, and the difference only ever surfaces in front of
a customer.

WHY THE ORIGINAL IS QUOTED

Someone who wrote in three weeks ago has no idea what "yes, that's fixed" refers to. The quoted
message and its UTC timestamp make the reply legible on its own, which is the difference between a
support email and a puzzle.

EVERY SEND IS RECORDED

A ``user_messages`` row per email. "Did anyone reply to this?" is the first question on any support
thread, and without the row the answer lives in one person's sent folder — so two admins can answer
the same contact, and neither knows.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.user_message import MessageChannel, UserMessage
from app.services.email_service import EmailService, jinja_env

logger = logging.getLogger(__name__)

TEMPLATE = "admin_message.html"

# What the customer sees in the subject line and the heading, per channel. Kept together so the
# whole outbound voice is readable at a glance rather than reconstructed from three call sites.
_CHANNEL_COPY: Dict[str, Dict[str, str]] = {
    MessageChannel.CONTACT: {
        "subject": "Re: your message to Resomix",
        "heading": "About your message",
        "quoted_label": "You wrote",
    },
    MessageChannel.FEEDBACK: {
        "subject": "Re: your feedback — Resomix",
        "heading": "About your feedback",
        "quoted_label": "Your feedback",
    },
    MessageChannel.DIRECT: {
        "subject": "A message from Resomix",
        "heading": "A message from Resomix",
        "quoted_label": "",
    },
}


def _paragraphs(text: Optional[str]) -> List[str]:
    """Split typed text into paragraphs, preserving the author's line breaks.

    Rendering the raw string into one `<p>` collapses every break, which on a support reply reads
    as carelessness. Blank lines separate paragraphs; single breaks stay within one.
    """
    if not text:
        return []
    blocks = [b.strip() for b in text.replace("\r\n", "\n").split("\n\n")]
    return [b for b in blocks if b]


class UserMessageService:
    """Renders, previews, sends and records admin messages."""

    def __init__(self) -> None:
        self.email_service = EmailService()

    # ------------------------------------------------------------------ #
    # Source lookup
    # ------------------------------------------------------------------ #
    async def load_source(
        self, db: AsyncSession, channel: str, source_id: Optional[int]
    ) -> Tuple[Optional[Dict[str, Any]], Optional[str], Optional[int]]:
        """The thing being answered, plus the recipient's address and user id.

        A contact or feedback row carries its own email, which may be the ONLY address available:
        both can be submitted by someone who is not signed in, so `user_id` is nullable on each.
        Falling back to the account would mean refusing to answer an anonymous enquiry.
        """
        if channel == MessageChannel.DIRECT or not source_id:
            return None, None, None

        if channel == MessageChannel.CONTACT:
            from app.models.contact import Contact

            row = (await db.execute(select(Contact).where(Contact.id == source_id))).scalar_one_or_none()
            if row is None:
                return None, None, None
            return (
                {
                    "quoted": _paragraphs(row.message),
                    "quoted_at": row.submitted_at.strftime("%-d %B %Y at %H:%M") if row.submitted_at else "—",
                    "quoted_meta": row.subject or None,
                    "name": row.name,
                },
                row.email,
                row.user_id,
            )

        if channel == MessageChannel.FEEDBACK:
            from app.models.feedback import Feedback

            row = (await db.execute(select(Feedback).where(Feedback.id == source_id))).scalar_one_or_none()
            if row is None:
                return None, None, None
            meta = " · ".join(
                p for p in (row.category, f"{row.satisfaction}/5" if row.satisfaction is not None else None) if p
            )
            # Feedback carries no email of its own — it is always tied to an account.
            email = None
            if row.user_id:
                user = (await db.execute(select(User).where(User.id == row.user_id))).scalar_one_or_none()
                email = user.email if user else None
            return (
                {
                    "quoted": _paragraphs(row.message),
                    "quoted_at": row.submitted_at.strftime("%-d %B %Y at %H:%M") if row.submitted_at else "—",
                    "quoted_meta": meta or None,
                    "name": None,
                },
                email,
                row.user_id,
            )

        return None, None, None

    # ------------------------------------------------------------------ #
    # Render — the single source of truth for both preview and send
    # ------------------------------------------------------------------ #
    def render(
        self,
        *,
        channel: str,
        body: str,
        recipient_name: Optional[str],
        source: Optional[Dict[str, Any]] = None,
        subject: Optional[str] = None,
    ) -> Tuple[str, str]:
        """Build the email. Returns ``(subject, html)``.

        Called by BOTH `preview` and `send`, which is the whole point: an admin approves exactly
        the bytes that go out.
        """
        from app.core.config import settings

        copy = _CHANNEL_COPY.get(channel, _CHANNEL_COPY[MessageChannel.DIRECT])
        resolved_subject = (subject or "").strip() or copy["subject"]

        context = {
            "subject": resolved_subject,
            "heading": copy["heading"],
            "name": recipient_name or "there",
            "body_paragraphs": _paragraphs(body),
            "app_url": settings.app_url,
            "quoted": (source or {}).get("quoted") or None,
            "quoted_label": copy["quoted_label"],
            "quoted_at": (source or {}).get("quoted_at"),
            "quoted_meta": (source or {}).get("quoted_meta"),
        }
        html = jinja_env.get_template(TEMPLATE).render(**context)
        return resolved_subject, html

    async def preview(
        self,
        db: AsyncSession,
        *,
        channel: str,
        body: str,
        source_id: Optional[int] = None,
        user_uuid: Optional[str] = None,
        subject: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Render without sending. Same code path as `send`, deliberately."""
        source, source_email, source_user_id = await self.load_source(db, channel, source_id)
        recipient, name = await self._resolve_recipient(db, source_email, source_user_id, user_uuid, source)
        resolved_subject, html = self.render(
            channel=channel, body=body, recipient_name=name, source=source, subject=subject
        )
        return {
            "subject": resolved_subject,
            "html": html,
            "recipient_email": recipient,
            "recipient_name": name,
            # Surfaced so the UI can refuse to send rather than failing after the admin hits Send.
            "can_send": bool(recipient),
        }

    async def _resolve_recipient(
        self,
        db: AsyncSession,
        source_email: Optional[str],
        source_user_id: Optional[int],
        user_uuid: Optional[str],
        source: Optional[Dict[str, Any]],
    ) -> Tuple[Optional[str], Optional[str]]:
        """Who this goes to, and what to call them.

        The source's own address wins: a contact form can be submitted by someone with no account,
        and that address is then the only way to answer them.
        """
        name = (source or {}).get("name")
        if source_email:
            if not name and source_user_id:
                user = (await db.execute(select(User).where(User.id == source_user_id))).scalar_one_or_none()
                name = (user.name or user.username) if user else None
            return source_email, name

        user = None
        if source_user_id:
            user = (await db.execute(select(User).where(User.id == source_user_id))).scalar_one_or_none()
        elif user_uuid:
            user = (await db.execute(select(User).where(User.uuid == user_uuid))).scalar_one_or_none()
        if user is None:
            return None, name
        return user.email, name or user.name or user.username

    # ------------------------------------------------------------------ #
    # Send
    # ------------------------------------------------------------------ #
    async def send(
        self,
        db: AsyncSession,
        *,
        channel: str,
        body: str,
        admin_user_id: int,
        source_id: Optional[int] = None,
        user_uuid: Optional[str] = None,
        subject: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Render, send, and record. Raises ValueError when there is nobody to send to."""
        if channel not in MessageChannel.ALL:
            raise ValueError(f"Unknown channel {channel!r}")
        if not (body or "").strip():
            raise ValueError("The message is empty.")

        source, source_email, source_user_id = await self.load_source(db, channel, source_id)
        if channel != MessageChannel.DIRECT and source_id and source is None:
            raise ValueError("The message being replied to no longer exists.")

        recipient, name = await self._resolve_recipient(db, source_email, source_user_id, user_uuid, source)
        if not recipient:
            raise ValueError("No email address to send to.")

        resolved_subject, html = self.render(
            channel=channel, body=body, recipient_name=name, source=source, subject=subject
        )

        sent = await self.email_service.send_html(
            email=recipient, subject=resolved_subject, html=html
        )

        # Recorded either way. A failed send that leaves no trace is indistinguishable from one
        # that was never attempted, and the next admin would have no idea it had been tried.
        row = UserMessage(
            user_id=source_user_id or (await self._user_id_for_uuid(db, user_uuid)),
            admin_user_id=admin_user_id,
            channel=channel,
            source_id=source_id,
            subject=resolved_subject[:200],
            body=body,
            recipient_email=recipient,
            status="sent" if sent else "failed",
        )
        db.add(row)
        await db.commit()

        logger.info(
            "MESSAGE: admin %s sent a %s message to %s (%s)",
            admin_user_id, channel, recipient, row.status,
        )
        return {"sent": bool(sent), "recipient_email": recipient, "subject": resolved_subject}

    @staticmethod
    async def _user_id_for_uuid(db: AsyncSession, user_uuid: Optional[str]) -> Optional[int]:
        if not user_uuid:
            return None
        user = (await db.execute(select(User).where(User.uuid == user_uuid))).scalar_one_or_none()
        return user.id if user else None

    @staticmethod
    async def history(
        db: AsyncSession, *, channel: str, source_id: int
    ) -> List[UserMessage]:
        """Replies already sent for this contact/feedback — so a second admin can see it is done."""
        return list(
            (
                await db.execute(
                    select(UserMessage)
                    .where(UserMessage.channel == channel, UserMessage.source_id == source_id)
                    .order_by(UserMessage.id.desc())
                )
            ).scalars().all()
        )
