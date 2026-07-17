"""
Email Service
=============

Handles all email communications for authentication including verification,
password reset, 2FA codes, and welcome emails.

Version: 3.2.0
Author: Muhammad Usman Naeem
Date: October 23, 2025
"""

from pathlib import Path
from jinja2 import Environment, FileSystemLoader
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from pydantic import EmailStr

from app.core.config import settings
from app.services.logging_service import LoggingService

# Setup Jinja2 template environment
TEMPLATE_DIR = Path(__file__).parent.parent / "templates" / "emails"
jinja_env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)))


# Email configuration
email_conf = ConnectionConfig(
    MAIL_USERNAME=settings.smtp_user or "",
    MAIL_PASSWORD=settings.smtp_password or "",
    MAIL_FROM=settings.smtp_from_email,
    MAIL_PORT=settings.smtp_port,
    MAIL_SERVER=settings.smtp_host,
    MAIL_FROM_NAME=settings.smtp_from_name,
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=bool(settings.smtp_user and settings.smtp_password),
    VALIDATE_CERTS=True,
)


class EmailService:
    """Service for sending authentication-related emails"""

    def __init__(self):
        self.fast_mail = FastMail(email_conf)
        self.logging_service = LoggingService()

    async def send_verification_email(
        self, email: EmailStr, username: str, verification_token: str
    ) -> bool:
        """
        Send email verification email.

        Args:
            email: Recipient email address
            username: User's username
            verification_token: Verification token

        Returns:
            True if sent successfully
        """
        verification_url = (
            f"{settings.frontend_url}/auth/verify-email?token={verification_token}"
        )

        # Render template
        template = jinja_env.get_template("verification.html")
        html = template.render(
            username=username,
            verification_url=verification_url,
            expire_hours=settings.email_verification_token_expire_hours
        )

        message = MessageSchema(
            subject="Verify your Resomix email address",
            recipients=[email],
            body=html,
            subtype=MessageType.html,
        )

        try:
            await self.fast_mail.send_message(message)
            return True
        except Exception as e:
            self.logging_service.log(
                level="ERROR",
                category="EMAIL",
                action="verification_email_send_failed",
                message="Failed to send verification email",
                metadata={
                    "email": str(email),
                    "username": username,
                },
                error=e,
            )
            return False

    async def send_operation_notification(
        self, email: EmailStr, subject: str, context: dict
    ) -> bool:
        """Render + send a generic operation-outcome email (ingestion, embedding, …).

        ``context`` is the full template payload (status, title, summary, details,
        counts, reference_path, audience, partner_info, …). Generic by design so the
        same template serves every pipeline stage and both the partner and admin copy.
        Returns True on success; logs and returns False on SMTP failure (the caller
        still records the attempt).
        """
        ctx = {"subject": subject, "max_details": 25, **context}
        template = jinja_env.get_template("operation_notification.html")
        html = template.render(**ctx)

        message = MessageSchema(
            subject=subject,
            recipients=[email],
            body=html,
            subtype=MessageType.html,
        )
        try:
            await self.fast_mail.send_message(message)
            return True
        except Exception as e:
            self.logging_service.log(
                level="ERROR",
                category="EMAIL",
                action="operation_notification_send_failed",
                message="Failed to send operation notification email",
                metadata={"email": str(email), "subject": subject,
                          "event_type": context.get("event_type"),
                          "audience": context.get("audience")},
                error=e,
            )
            return False

    async def send_password_reset_email(
        self, email: EmailStr, username: str, reset_token: str
    ) -> bool:
        """
        Send password reset email.

        Args:
            email: Recipient email address
            username: User's username
            reset_token: Password reset token

        Returns:
            True if sent successfully
        """
        reset_url = f"{settings.frontend_url}/auth/reset-password?token={reset_token}"

        # Render template
        template = jinja_env.get_template("password_reset.html")
        html = template.render(
            username=username,
            reset_url=reset_url,
            expire_hours=settings.password_reset_token_expire_hours
        )

        message = MessageSchema(
            subject="Reset your Resomix password",
            recipients=[email],
            body=html,
            subtype=MessageType.html,
        )

        try:
            await self.fast_mail.send_message(message)
            return True
        except Exception as e:
            self.logging_service.log(
                level="ERROR",
                category="EMAIL",
                action="password_reset_email_send_failed",
                message="Failed to send password reset email",
                metadata={
                    "email": str(email),
                    "username": username,
                },
                error=e,
            )
            return False

    async def send_2fa_code_email(
        self, email: EmailStr, username: str, code: str, purpose: str = "login"
    ) -> bool:
        """
        Send 2FA code email.

        Args:
            email: Recipient email address
            username: User's username
            code: 2FA verification code
            purpose: Purpose of the code (login, password_change)

        Returns:
            True if sent successfully
        """
        purpose_text = (
            "sign in to" if purpose == "login" else "change your password for"
        )

        # Render template
        template = jinja_env.get_template("2fa_code.html")
        html = template.render(
            username=username,
            code=code,
            purpose_text=purpose_text,
            expire_minutes=settings.two_factor_code_expire_minutes
        )

        message = MessageSchema(
            subject="Your Resomix verification code",
            recipients=[email],
            body=html,
            subtype=MessageType.html,
        )

        try:
            await self.fast_mail.send_message(message)
            return True
        except Exception as e:
            self.logging_service.log(
                level="ERROR",
                category="EMAIL",
                action="two_factor_email_send_failed",
                message="Failed to send 2FA code email",
                metadata={
                    "email": str(email),
                    "username": username,
                    "purpose": purpose,
                },
                error=e,
            )
            return False

    async def send_welcome_email(self, email: EmailStr, username: str) -> bool:
        """
        Send welcome email after successful verification.

        Args:
            email: Recipient email address
            username: User's username

        Returns:
            True if sent successfully
        """
        # Render template
        template = jinja_env.get_template("welcome.html")
        html = template.render(
            username=username,
            frontend_url=settings.frontend_url
        )

        message = MessageSchema(
            subject="Welcome to Resomix!",
            recipients=[email],
            body=html,
            subtype=MessageType.html,
        )

        try:
            await self.fast_mail.send_message(message)
            return True
        except Exception as e:
            self.logging_service.log(
                level="ERROR",
                category="EMAIL",
                action="welcome_email_send_failed",
                message="Failed to send welcome email",
                metadata={
                    "email": str(email),
                    "username": username,
                },
                error=e,
            )
            return False

    async def send_contact_confirmation(
        self, email: EmailStr, name: str, contact_type: str = "consumer"
    ) -> bool:
        """Acknowledge a contact / B2B partner-request submission back to the person who submitted it.

        Confirms we received it, sets the 2–5 business-day expectation, and invites them to try the
        app (a few free playlists + uploads) at the canonical app URL (beta.resomix.com).
        """
        is_partner = contact_type == "partner"
        template = jinja_env.get_template("contact_confirmation.html")
        html = template.render(
            name=(name or "there"),
            is_partner=is_partner,
            app_url=settings.app_url,
        )

        message = MessageSchema(
            subject=(
                "We received your partner request — Resomix"
                if is_partner
                else "We received your message — Resomix"
            ),
            recipients=[email],
            body=html,
            subtype=MessageType.html,
        )

        try:
            await self.fast_mail.send_message(message)
            return True
        except Exception as e:
            self.logging_service.log(
                level="ERROR",
                category="EMAIL",
                action="contact_confirmation_send_failed",
                message="Failed to send contact confirmation email",
                metadata={
                    "email": str(email),
                    "contact_type": contact_type,
                },
                error=e,
            )
            return False

    async def send_contact_admin_notification(self, details: dict) -> bool:
        """Notify the admin inbox (``ADMIN_NOTIFICATION_EMAIL``) of a new contact / B2B partner
        submission, with the full form details + who submitted it (signed-in user or anonymous).

        No-op (returns False) if ``ADMIN_NOTIFICATION_EMAIL`` is not configured — the submitter still
        gets their acknowledgement regardless.
        """
        admin_email = settings.admin_notification_email
        if not admin_email:
            return False

        is_partner = details.get("contact_type") == "partner"
        template = jinja_env.get_template("contact_admin_notification.html")
        html = template.render(**details)

        message = MessageSchema(
            subject=(
                f"[Resomix] New {'partner request' if is_partner else 'contact'} "
                f"from {details.get('name') or 'someone'}"
            ),
            recipients=[admin_email],
            body=html,
            subtype=MessageType.html,
        )

        try:
            await self.fast_mail.send_message(message)
            return True
        except Exception as e:
            self.logging_service.log(
                level="ERROR",
                category="EMAIL",
                action="contact_admin_notification_send_failed",
                message="Failed to send contact admin notification email",
                metadata={
                    "admin_email": str(admin_email),
                    "contact_type": details.get("contact_type"),
                },
                error=e,
            )
            return False
