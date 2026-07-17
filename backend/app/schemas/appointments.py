from pydantic import BaseModel, Field


class AppointmentCreate(BaseModel):
    leadId: str
    scheduledStart: str
    durationMinutes: int = Field(default=30, ge=15, le=120)
    notes: str = ""
    source: str = "Manual"
    retellCallId: str = ""


class AppointmentUpdate(BaseModel):
    scheduledStart: str | None = None
    durationMinutes: int | None = Field(default=None, ge=15, le=120)
    status: str | None = None
    notes: str | None = None


class RetellAppointmentCreate(BaseModel):
    leadId: str
    scheduledStart: str
    durationMinutes: int = Field(default=30, ge=15, le=120)
    notes: str | None = None
    retellCallId: str | None = None
    isEmergency: bool = False
    emergencySummary: str | None = None
