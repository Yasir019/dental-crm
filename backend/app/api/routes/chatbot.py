from fastapi import APIRouter, BackgroundTasks, HTTPException

from app.schemas.chatbot import ChatbotAppointmentRequest, ChatbotMessageRequest
from app.services.appointments_service import create_appointment
from app.services.chatbot_service import send_chatbot_message
from app.services.leads_service import create_lead

router = APIRouter(prefix="/api/chatbot", tags=["chatbot"])


@router.post("/message")
async def chatbot_message_handler(payload: ChatbotMessageRequest, background_tasks: BackgroundTasks):
    if not payload.sessionId or not payload.message.strip():
        raise HTTPException(status_code=400, detail={"message": "Session ID and message are required."})

    return await send_chatbot_message(payload.model_dump(), background_tasks)


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
            # Existing production databases may still have the older appointment
            # source constraint. The lead keeps the AI Chatbot source; the
            # appointment remains compatible with both schemas until migration.
            "source": "Manual",
            "notes": payload.notes,
        }
    )
    return {
        "message": "Your appointment is booked successfully.",
        "lead": lead,
        "appointment": appointment,
    }
