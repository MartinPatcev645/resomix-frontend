"""
Email Service
=============

Handles all email communications for authentication including verification,
password reset, 2FA codes, and welcome emails.

Version: 3.2.0
Author: Muhammad Usman Naeem
Date: October 23, 2025
"""

from typing import Optional
import os
from pathlib import Path
from jinja2 import Environment, FileSystemLoader
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from pydantic import EmailStr

from app.core.config import settings

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
            # Log error but don't expose details
            print(f"Error sending verification email: {e}")
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
            print(f"Error sending password reset email: {e}")
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
            print(f"Error sending 2FA code email: {e}")
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
            print(f"Error sending welcome email: {e}")
            return False
