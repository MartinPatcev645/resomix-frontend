"""
Admin → user messaging
======================

Reply to a contact submission, reply to feedback, or message a user directly — and preview any of
them before sending.

All four routes go through one service and one renderer. The preview is not a separate rendering
path: an admin approves exactly the bytes that will be delivered, because a preview that can drift
from the send is worse than none.

Every send is recorded in ``user_messages`` and written to the admin operation log.
"""

import logging

from fastapi import APIRouter, Depends, Path, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import require_admin, require_permission
from app.api.dependencies.database import get_database_session
from app.models.user import User
from app.models.user_message import MessageChannel
from app.schemas.admin_user import AdminMessagePreviewRequest, AdminMessageRequest
from app.services.admin_operation_log_service import AdminOperationLogService
from app.services.logging_service import LoggingService
from app.services.user_message_service import UserMessageService
from app.utils.response_utils import format_response

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/admin/messages",
    tags=["Admin Messaging"],
    dependencies=[Depends(require_admin)],
)

service = UserMessageService()
admin_log = AdminOperationLogService()
logging_service = LoggingService()


def _client_ip(request: Request) -> str | None:
    return request.client.host if request and request.client else None


async def _log_failure(db: AsyncSession, request: Request, action: str, message: str, error: Exception, **meta):
    """Failures land in ``system_logs`` with a stack trace, not just the process log — otherwise a
    500 here is a dead end for whoever has to explain it."""
    try:
        logging_service.log(
            async_db=db, level="ERROR", category="ADMIN_MESSAGE", action=action,
            message=message, request=request, status_code=500, metadata=meta or None, error=error,
        )
    except Exception:  # noqa: BLE001
        logger.exception("Could not write the admin message error log for %s", action)
    logger.exception("%s: %s", action, message)


async def _send(
    db: AsyncSession,
    request: Request,
    current_admin: User,
    *,
    channel: str,
    body: str,
    subject: str | None,
    source_id: int | None = None,
    user_uuid: str | None = None,
) -> JSONResponse:
    """Shared send path for all three channels."""
    from fastapi import status as http_status

    try:
        result = await service.send(
            db, channel=channel, body=body, subject=subject,
            admin_user_id=current_admin.id, source_id=source_id, user_uuid=user_uuid,
        )

        await admin_log.log_operation(
            db=db,
            admin_user_id=current_admin.id,
            action=f"message.{channel}",
            target_type="user_message",
            target_id=str(source_id or user_uuid or ""),
            before_state=None,
            after_state={"to": result["recipient_email"], "subject": result["subject"]},
            ip_address=_client_ip(request),
        )
        await db.commit()

        if not result["sent"]:
            # Recorded as failed, so a second admin can see it was attempted. Reported honestly
            # rather than as a success the customer never received.
            return JSONResponse(
                status_code=http_status.HTTP_502_BAD_GATEWAY,
                content=format_response(
                    success=False,
                    error="The message could not be delivered. It is recorded as failed — check "
                          "the mail settings before retrying.",
                ),
            )

        return JSONResponse(
            status_code=http_status.HTTP_200_OK,
            content=format_response(
                success=True,
                data={"recipient_email": result["recipient_email"], "subject": result["subject"]},
                message=f"Sent to {result['recipient_email']}",
            ),
        )
    except ValueError as e:
        return JSONResponse(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            content=format_response(success=False, error=str(e)),
        )
    except Exception as e:
        await _log_failure(db, request, f"message_{channel}_failed", f"Failed to send a {channel} message", e,
                           source_id=source_id, user_uuid=user_uuid)
        return JSONResponse(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=format_response(success=False, error="Failed to send the message"),
        )


@router.post("/preview", dependencies=[Depends(require_permission("user:message"))])
async def preview_message(
    payload: AdminMessagePreviewRequest,
    db: AsyncSession = Depends(get_database_session),
    request: Request = None,
    current_admin: User = Depends(require_admin),
):
    """Render a message without sending it.

    Returns the finished HTML, the resolved subject and the recipient. `can_send` is false when
    there is no address to send to — the UI uses it to refuse *before* the admin writes a reply,
    rather than failing after they press Send.
    """
    from fastapi import status as http_status

    try:
        data = await service.preview(
            db,
            channel=payload.channel,
            body=payload.body,
            subject=payload.subject,
            source_id=payload.source_id,
            user_uuid=payload.user_uuid,
        )
        return JSONResponse(
            status_code=http_status.HTTP_200_OK,
            content=format_response(success=True, data=data),
        )
    except Exception as e:
        await _log_failure(db, request, "message_preview_failed", "Failed to render a preview", e,
                           channel=payload.channel, source_id=payload.source_id)
        return JSONResponse(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=format_response(success=False, error="Failed to render the preview"),
        )


@router.post("/contact/{contact_id}", dependencies=[Depends(require_permission("user:message"))])
async def reply_to_contact(
    payload: AdminMessageRequest,
    contact_id: int = Path(..., ge=1),
    db: AsyncSession = Depends(get_database_session),
    request: Request = None,
    current_admin: User = Depends(require_admin),
):
    """Reply to a contact submission, quoting the original and its UTC timestamp."""
    return await _send(
        db, request, current_admin, channel=MessageChannel.CONTACT,
        body=payload.body, subject=payload.subject, source_id=contact_id,
    )


@router.post("/feedback/{feedback_id}", dependencies=[Depends(require_permission("user:message"))])
async def reply_to_feedback(
    payload: AdminMessageRequest,
    feedback_id: int = Path(..., ge=1),
    db: AsyncSession = Depends(get_database_session),
    request: Request = None,
    current_admin: User = Depends(require_admin),
):
    """Reply to submitted feedback, quoting it along with its category and rating."""
    return await _send(
        db, request, current_admin, channel=MessageChannel.FEEDBACK,
        body=payload.body, subject=payload.subject, source_id=feedback_id,
    )


@router.post("/user/{user_uuid}", dependencies=[Depends(require_permission("user:message"))])
async def message_user(
    payload: AdminMessageRequest,
    user_uuid: str = Path(...),
    db: AsyncSession = Depends(get_database_session),
    request: Request = None,
    current_admin: User = Depends(require_admin),
):
    """Message a user directly. Nothing is quoted — this answers nothing."""
    return await _send(
        db, request, current_admin, channel=MessageChannel.DIRECT,
        body=payload.body, subject=payload.subject, user_uuid=user_uuid,
    )


@router.get("/{channel}/{source_id}/history", dependencies=[Depends(require_permission("user:read"))])
async def message_history(
    channel: str = Path(..., description="contact | feedback"),
    source_id: int = Path(..., ge=1),
    db: AsyncSession = Depends(get_database_session),
):
    """Replies already sent for this contact or feedback.

    So a second admin can see the thread has been answered — the thing that stops two people
    replying to the same customer.
    """
    from fastapi import status as http_status

    rows = await service.history(db, channel=channel, source_id=source_id)
    return JSONResponse(
        status_code=http_status.HTTP_200_OK,
        content=format_response(
            success=True,
            data=[
                {
                    "id": r.id,
                    "subject": r.subject,
                    "body": r.body,
                    "recipient_email": r.recipient_email,
                    "status": r.status,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                }
                for r in rows
            ],
        ),
    )
