import asyncio
import smtplib
from email.message import EmailMessage
from email.utils import formataddr, make_msgid

import httpx
from fastapi import HTTPException
from app.core.config import settings


def gmail_is_configured() -> bool:
    return bool(settings.gmail_user and settings.gmail_app_password)


def email_is_configured() -> bool:
    return gmail_is_configured() or bool(settings.email_api_key and settings.email_from)


async def send_email(to: str, subject: str, body: str):
    if not settings.email_api_key or not settings.email_from:
        raise HTTPException(status_code=500, detail={"message": "Email service is not configured."})

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.email_api_key}"},
            json={"from": settings.email_from, "to": [to], "subject": subject, "text": body},
        )

    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail={"message": "Email could not be sent."})
    return response.json()


def send_gmail_sync(to: str, subject: str, body: str) -> str:
    message = EmailMessage()
    message["From"] = formataddr((settings.dental_clinic_name, settings.gmail_user))
    message["To"] = to
    message["Subject"] = subject
    message["Message-ID"] = make_msgid()
    message.set_content(body)
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=30) as smtp:
        smtp.login(settings.gmail_user, settings.gmail_app_password.replace(" ", ""))
        smtp.send_message(message)
    return message["Message-ID"]


async def send_followup_email(to: str, subject: str, body: str):
    """Send through Gmail when configured, otherwise through the Resend API."""
    if not gmail_is_configured():
        return await send_email(to, subject, body)
    try:
        reference = await asyncio.to_thread(send_gmail_sync, to, subject, body)
    except (smtplib.SMTPException, OSError) as error:
        raise HTTPException(status_code=502, detail={"message": f"Gmail could not send the email: {error}"})
    return {"id": reference}
