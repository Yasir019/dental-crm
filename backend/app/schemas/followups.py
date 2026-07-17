from typing import Literal

from pydantic import BaseModel


class FollowupSettingsUpdate(BaseModel):
    automaticEmailEnabled: bool
    automaticCallbackEnabled: bool


class LeadEmailRequest(BaseModel):
    subject: str
    body: str


class AutomaticLeadEmailRequest(LeadEmailRequest):
    leadId: str
    mode: str = "automatic"


class AutomaticLeadCallbackRequest(BaseModel):
    leadId: str
    mode: str = "automatic"


class EmailDeliveryStatusRequest(BaseModel):
    leadId: str
    subject: str = ""
    body: str = ""
    mode: str = "automatic"
    status: Literal["sent", "failed"]
    providerReference: str = ""
    errorMessage: str = ""
