from typing import Any

from pydantic import BaseModel


class VoiceCallAnalysis(BaseModel):
    callId: str | None = None
    notes: str | None = ""
    transcript: str | None = ""
    callSummary: str | None = ""
    recordingUrl: str | None = ""
    fromNumber: str | None = ""
    toNumber: str | None = ""
    callStatus: str | None = ""
    durationSeconds: int | None = None
    startedAt: str | None = None
    endedAt: str | None = None
    userSentiment: str | None = ""
    callSuccessful: bool | None = None
    customAnalysisData: dict[str, Any] | None = None
    rawPayload: dict[str, Any] | None = None


class VoiceLeadCreate(VoiceCallAnalysis):
    name: str
    phone: str
    email: str
    service: str


class FollowupVoiceCallCreate(VoiceCallAnalysis):
    leadId: str
    phone: str | None = ""
