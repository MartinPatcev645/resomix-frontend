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
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from pydantic import EmailStr

from app.core.config import settings


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
            f"{settings.frontend_url}/verify-email?token={verification_token}"
        )

        html = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #4CAF50;">Welcome to ResomiX!</h2>
                    <p>Hi {username},</p>
                    <p>Thank you for registering with ResomiX. Please verify your email address by clicking the button below:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{verification_url}" 
                           style="background-color: #4CAF50; color: white; padding: 12px 30px; 
                                  text-decoration: none; border-radius: 5px; display: inline-block;">
                            Verify Email Address
                        </a>
                    </div>
                    <p>Or copy and paste this link into your browser:</p>
                    <p style="word-break: break-all; color: #666;">{verification_url}</p>
                    <p style="margin-top: 30px; color: #666; font-size: 14px;">
                        This link will expire in {settings.email_verification_token_expire_hours} hours.
                    </p>
                    <p style="margin-top: 30px; color: #666; font-size: 14px;">
                        If you didn't create an account with ResomiX, please ignore this email.
                    </p>
                    <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;">
                    <p style="color: #999; font-size: 12px;">
                        © 2025 ResomiX. All rights reserved.
                    </p>
                </div>
            </body>
        </html>
        """

        message = MessageSchema(
            subject="Verify your ResomiX email address",
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
        reset_url = f"{settings.frontend_url}/reset-password?token={reset_token}"

        html = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #FF9800;">Password Reset Request</h2>
                    <p>Hi {username},</p>
                    <p>We received a request to reset your ResomiX account password. Click the button below to reset it:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{reset_url}" 
                           style="background-color: #FF9800; color: white; padding: 12px 30px; 
                                  text-decoration: none; border-radius: 5px; display: inline-block;">
                            Reset Password
                        </a>
                    </div>
                    <p>Or copy and paste this link into your browser:</p>
                    <p style="word-break: break-all; color: #666;">{reset_url}</p>
                    <p style="margin-top: 30px; color: #666; font-size: 14px;">
                        This link will expire in {settings.password_reset_token_expire_hours} hour(s).
                    </p>
                    <p style="margin-top: 20px; padding: 15px; background-color: #fff3cd; border-left: 4px solid #FF9800;">
                        <strong>Important:</strong> If you didn't request a password reset, please ignore this email. 
                        Your password will remain unchanged.
                    </p>
                    <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;">
                    <p style="color: #999; font-size: 12px;">
                        © 2025 ResomiX. All rights reserved.
                    </p>
                </div>
            </body>
        </html>
        """

        message = MessageSchema(
            subject="Reset your ResomiX password",
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

        html = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #2196F3;">Your ResomiX Verification Code</h2>
                    <p>Hi {username},</p>
                    <p>You are attempting to {purpose_text} your ResomiX account. Please use the verification code below:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; 
                                    display: inline-block; border: 2px dashed #2196F3;">
                            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #2196F3;">
                                {code}
                            </span>
                        </div>
                    </div>
                    <p style="text-align: center; color: #666; font-size: 14px;">
                        This code will expire in {settings.two_factor_code_expire_minutes} minutes.
                    </p>
                    <p style="margin-top: 30px; padding: 15px; background-color: #ffebee; border-left: 4px solid #f44336;">
                        <strong>Security Notice:</strong> If you didn't request this code, please secure your account immediately 
                        by changing your password.
                    </p>
                    <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;">
                    <p style="color: #999; font-size: 12px;">
                        © 2025 ResomiX. All rights reserved.
                    </p>
                </div>
            </body>
        </html>
        """

        message = MessageSchema(
            subject="Your ResomiX verification code",
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
        html = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #4CAF50;">Welcome to ResomiX! 🎵</h2>
                    <p>Hi {username},</p>
                    <p>Your email has been successfully verified! You now have full access to all ResomiX features.</p>
                    <h3 style="color: #555;">What you can do now:</h3>
                    <ul style="color: #666;">
                        <li>Discover similar tracks using our advanced audio similarity engine</li>
                        <li>Create and manage custom playlists</li>
                        <li>Rate and organize your favorite tracks</li>
                        <li>Export playlists to Spotify, Tidal, and other platforms</li>
                        <li>Save your preferences and history across devices</li>
                    </ul>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{settings.frontend_url}" 
                           style="background-color: #4CAF50; color: white; padding: 12px 30px; 
                                  text-decoration: none; border-radius: 5px; display: inline-block;">
                            Start Exploring
                        </a>
                    </div>
                    <p style="margin-top: 30px; color: #666; font-size: 14px;">
                        Need help getting started? Check out our 
                        <a href="{settings.frontend_url}/help" style="color: #4CAF50;">help center</a> 
                        or contact our support team.
                    </p>
                    <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;">
                    <p style="color: #999; font-size: 12px;">
                        © 2025 ResomiX. All rights reserved.
                    </p>
                </div>
            </body>
        </html>
        """

        message = MessageSchema(
            subject="Welcome to ResomiX!",
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
