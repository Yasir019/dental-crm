import asyncio
import base64
import hashlib
import hmac
import smtplib
import time
from email.message import EmailMessage
from email.utils import formataddr, make_msgid
from urllib.parse import urlencode

import httpx
from fastapi import HTTPException
from app.core.config import settings


GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"


GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send"
OAUTH_STATE_TTL_SECONDS = 10 * 60

# A token obtained through /gmail/connect is used straight away and handed over once
# so it can be saved as GMAIL_REFRESH_TOKEN; the environment value is used after a restart.
runtime_gmail = {"refresh_token": "", "pending": ""}


def gmail_refresh_token() -> str:
    return runtime_gmail["refresh_token"] or settings.gmail_refresh_token or ""


def gmail_api_is_configured() -> bool:
    return bool(settings.gmail_client_id and settings.gmail_client_secret and gmail_refresh_token())


def sign_oauth_state(timestamp: str) -> str:
    return hmac.new(settings.auth_secret.encode(), f"gmail-oauth.{timestamp}".encode(), hashlib.sha256).hexdigest()


def gmail_authorization_url(redirect_uri: str) -> str:
    if not settings.gmail_client_id or not settings.gmail_client_secret:
        raise HTTPException(status_code=500, detail={"message": "Add GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET to the backend environment first."})
    timestamp = str(int(time.time()))
    query = urlencode(
        {
            "client_id": settings.gmail_client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": GMAIL_SEND_SCOPE,
            "access_type": "offline",
            "prompt": "consent",
            "state": f"{timestamp}.{sign_oauth_state(timestamp)}",
        }
    )
    return f"{GOOGLE_AUTH_URL}?{query}"


def verify_oauth_state(state: str) -> bool:
    timestamp, _, signature = (state or "").partition(".")
    if not timestamp.isdigit() or abs(time.time() - int(timestamp)) > OAUTH_STATE_TTL_SECONDS:
        return False
    return hmac.compare_digest(signature, sign_oauth_state(timestamp))


async def connect_gmail(code: str, redirect_uri: str):
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "code": code,
                    "client_id": settings.gmail_client_id,
                    "client_secret": settings.gmail_client_secret,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code",
                },
            )
    except httpx.HTTPError as error:
        raise HTTPException(status_code=502, detail={"message": f"Could not reach Google: {error}"})

    data = response.json()
    if response.status_code >= 400 or not data.get("refresh_token"):
        reason = data.get("error_description") or data.get("error") or "no refresh token was returned"
        raise HTTPException(status_code=502, detail={"message": f"Google did not connect the Gmail account: {reason}"})
    runtime_gmail["refresh_token"] = runtime_gmail["pending"] = data["refresh_token"]


def take_pending_gmail_token() -> str:
    token, runtime_gmail["pending"] = runtime_gmail["pending"], ""
    return token


def gmail_is_configured() -> bool:
    return bool(settings.gmail_user and settings.gmail_app_password)


def email_is_configured() -> bool:
    return gmail_api_is_configured() or gmail_is_configured() or bool(settings.email_api_key and settings.email_from)


async def send_email(to: str, subject: str, body: str):
    if not settings.email_api_key or not settings.email_from:
        raise HTTPException(
            status_code=500,
            detail={"message": "No email account is connected. Connect Gmail through /api/integrations/gmail/connect."},
        )

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.email_api_key}"},
            json={"from": settings.email_from, "to": [to], "subject": subject, "text": body},
        )

    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail={"message": "Email could not be sent."})
    return response.json()


def build_message(to: str, subject: str, body: str) -> EmailMessage:
    message = EmailMessage()
    if settings.gmail_user:
        message["From"] = formataddr((settings.dental_clinic_name, settings.gmail_user))
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)
    return message


def send_gmail_sync(to: str, subject: str, body: str) -> str:
    message = build_message(to, subject, body)
    message["Message-ID"] = make_msgid()
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=30) as smtp:
        smtp.login(settings.gmail_user, settings.gmail_app_password.replace(" ", ""))
        smtp.send_message(message)
    return message["Message-ID"]


async def send_gmail_api(to: str, subject: str, body: str) -> str:
    """Send through the Gmail API over HTTPS, which works on hosts that block SMTP ports."""
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            token_response = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "client_id": settings.gmail_client_id,
                    "client_secret": settings.gmail_client_secret,
                    "refresh_token": gmail_refresh_token(),
                    "grant_type": "refresh_token",
                },
            )
            if token_response.status_code >= 400:
                reason = token_response.json().get("error_description") or token_response.json().get("error") or token_response.status_code
                raise HTTPException(status_code=502, detail={"message": f"Google rejected the Gmail credentials: {str(reason).rstrip('.')}."})

            raw = base64.urlsafe_b64encode(build_message(to, subject, body).as_bytes()).decode()
            response = await client.post(
                GMAIL_SEND_URL,
                headers={"Authorization": f"Bearer {token_response.json()['access_token']}"},
                json={"raw": raw},
            )
    except httpx.HTTPError as error:
        raise HTTPException(status_code=502, detail={"message": f"Could not reach Gmail: {error}"})

    if response.status_code >= 400:
        reason = (response.json().get("error") or {}).get("message") or response.status_code
        raise HTTPException(status_code=502, detail={"message": f"Gmail could not send the email: {reason}"})
    return response.json().get("id") or ""


async def send_followup_email(to: str, subject: str, body: str):
    """Send through the Gmail API, then Gmail SMTP, then the Resend API, whichever is configured first."""
    if gmail_api_is_configured():
        return {"id": await send_gmail_api(to, subject, body)}
    if not gmail_is_configured():
        return await send_email(to, subject, body)
    try:
        reference = await asyncio.to_thread(send_gmail_sync, to, subject, body)
    except (smtplib.SMTPException, OSError) as error:
        raise HTTPException(status_code=502, detail={"message": f"Gmail could not send the email: {error}"})
    return {"id": reference}
