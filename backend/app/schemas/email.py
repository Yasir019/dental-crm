from pydantic import BaseModel


class EmailSendRequest(BaseModel):
    to: str
    subject: str
    body: str
