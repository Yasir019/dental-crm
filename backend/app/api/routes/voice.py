from fastapi import APIRouter

from app.services.retell_service import create_retell_web_call

router = APIRouter(prefix="/api/voice", tags=["voice"])


@router.post("/web-call")
async def create_web_call_handler():
    return await create_retell_web_call()
