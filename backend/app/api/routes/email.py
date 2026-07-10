from fastapi import APIRouter, HTTPException
from app.schemas.email import EmailSendRequest
from app.services.email_service import send_email

router = APIRouter(prefix="/api/email", tags=["email"])


@router.post("/send")
async def send_email_handler(payload: EmailSendRequest):
    if not payload.to or not payload.subject or not payload.body:
        raise HTTPException(status_code=400, detail={"message": "Recipient, subject, and body are required."})
    email = await send_email(payload.to, payload.subject, payload.body)
    return {"message": "Email sent successfully.", "email": email}
