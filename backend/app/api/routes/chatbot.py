from fastapi import APIRouter, HTTPException

from app.schemas.chatbot import ChatbotAppointmentRequest, ChatbotMessageRequest
from app.services.appointments_service import create_appointment
from app.services.chatbot_service import send_chatbot_message
from app.services.leads_service import create_lead

router = APIRouter(prefix="/api/chatbot", tags=["chatbot"])


@router.post("/message")
async def chatbot_message_handler(payload: ChatbotMessageRequest):
    if not payload.sessionId or not payload.message.strip():
        raise HTTPException(status_code=400, detail={"message": "Session ID and message are required."})

    return await send_chatbot_message(payload.model_dump())


@router.post("/appointment", status_code=201)
async def chatbot_appointment_handler(payload: ChatbotAppointmentRequest):
    lead = await create_lead(
        {
            "name": payload.name,
            "email": payload.email,
            "phone": payload.phone,
            "service": payload.service,
            "source": "AI Chatbot",
            "sourceDetail": "Website chatbot appointment booking",
            "notes": payload.notes or f"Chatbot session: {payload.sessionId}",
        }
    )
    appointment = await create_appointment(
        {
            "leadId": lead["id"],
            "scheduledStart": payload.scheduledStart,
            "durationMinutes": 30,
            "source": "AI Chatbot",
            "notes": payload.notes,
        }
    )
    return {
        "message": "Your appointment is booked successfully.",
        "lead": lead,
        "appointment": appointment,
    }
