from pydantic import BaseModel


class AiTemplateRequest(BaseModel):
    name: str
    service: str
