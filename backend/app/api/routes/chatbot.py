from fastapi import APIRouter, HTTPException

from app.schemas.chatbot import ChatbotMessageRequest
from app.services.chatbot_service import send_chatbot_message

router = APIRouter(prefix="/api/chatbot", tags=["chatbot"])


@router.post("/message")
async def chatbot_message_handler(payload: ChatbotMessageRequest):
    if not payload.sessionId or not payload.message.strip():
        raise HTTPException(status_code=400, detail={"message": "Session ID and message are required."})

    return await send_chatbot_message(payload.model_dump())
