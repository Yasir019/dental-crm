from fastapi import APIRouter, Depends, Header

from app.api.routes.integrations import require_integration_key
from app.core.security import require_auth
from app.schemas.appointments import AppointmentCreate, AppointmentUpdate, RetellAppointmentCreate
from app.services.appointments_service import create_appointment, get_appointments, update_appointment


router = APIRouter(prefix="/api/appointments", tags=["appointments"])
integration_router = APIRouter(prefix="/api/integrations/appointments", tags=["integrations"])


@router.get("")
async def appointments_handler(start: str | None = None, end: str | None = None, user=Depends(require_auth)):
    return {"appointments": await get_appointments(start, end)}


@router.post("", status_code=201)
async def create_appointment_handler(payload: AppointmentCreate, user=Depends(require_auth)):
    appointment = await create_appointment(payload.model_dump())
    return {"message": "Appointment booked successfully.", "appointment": appointment}


@router.patch("/{appointment_id}")
async def update_appointment_handler(appointment_id: str, payload: AppointmentUpdate, user=Depends(require_auth)):
    appointment = await update_appointment(appointment_id, payload.model_dump())
    return {"message": "Appointment updated successfully.", "appointment": appointment}


@integration_router.post("/book", status_code=201)
async def retell_book_appointment_handler(payload: RetellAppointmentCreate, x_integration_key: str | None = Header(default=None)):
    require_integration_key(x_integration_key)
    data = payload.model_dump()
    data["source"] = "AI Callback"
    appointment = await create_appointment(data)
    return {
        "success": True,
        "message": "Appointment booked successfully.",
        "appointment": appointment,
    }
