from pydantic import BaseModel


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatbotMessageRequest(BaseModel):
    sessionId: str
    message: str
    pageUrl: str | None = ""
    history: list[ChatMessage] = []
    serviceCatalog: list[dict] = []


class ChatbotAppointmentRequest(BaseModel):
    sessionId: str = ""
    name: str
    email: str
    phone: str
    service: str
    scheduledStart: str
    notes: str = ""


class ChatbotLeadCreate(BaseModel):
    sessionId: str | None = ""
    name: str
    phone: str
    email: str
    service: str
    notes: str | None = ""
    transcript: list[ChatMessage] = []
