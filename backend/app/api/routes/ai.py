from fastapi import APIRouter, HTTPException
from app.schemas.ai import AiTemplateRequest
from app.services.ai_service import generate_followup_template

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.post("/generate-template")
async def generate_template_handler(payload: AiTemplateRequest):
    if not payload.name or not payload.service:
        raise HTTPException(status_code=400, detail={"message": "Lead name and service are required."})
    return await generate_followup_template(payload.name, payload.service)
