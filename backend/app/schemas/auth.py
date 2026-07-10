from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str


class ProfileUpdate(BaseModel):
    displayName: str
    clinicName: str
    email: str | None = ""
    phone: str | None = ""


class PasswordUpdate(BaseModel):
    currentPassword: str
    newPassword: str
