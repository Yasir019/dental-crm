from pydantic import BaseModel


class LeadCreate(BaseModel):
    name: str
    phone: str
    email: str
    service: str
    source: str | None = None
    sourceDetail: str | None = None
    source_detail: str | None = None
    notes: str | None = ""


class StatusUpdate(BaseModel):
    id: str
    status: str


class FollowupUpdate(BaseModel):
    id: str
    followup: str


class LeadUpdate(BaseModel):
    name: str
    phone: str
    email: str
    service: str
    notes: str | None = ""


class ArchiveUpdate(BaseModel):
    id: str
    archived: bool = True
