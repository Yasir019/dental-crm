import re
from fastapi import HTTPException

SERVICES = [
    "Dental Fillings",
    "Root Canal",
    "Teeth Whitening",
    "Bonding",
    "Dental Implants",
    "Braces",
]

STATUSES = ["Pending", "Qualified", "Not Qualified"]
FOLLOWUP_STATUSES = ["Pending", "Email Sent", "Callback Started", "Email & Callback", "No Followup Needed"]
LEAD_SOURCES = ["Website Form", "Google Form", "AI Voice Agent", "AI Chatbot", "Website Chatbot", "Manual Entry"]

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def validate_lead(data: dict):
    errors = {}
    if not data.get("name", "").strip():
        errors["name"] = "Name is required."
    if not data.get("phone", "").strip():
        errors["phone"] = "Phone number is required."
    if not data.get("email", "").strip():
        errors["email"] = "Email is required."
    elif not EMAIL_RE.match(data["email"]):
        errors["email"] = "Enter a valid email address."
    if not data.get("service", "").strip():
        errors["service"] = "Service is required."
    elif data["service"] not in SERVICES:
        errors["service"] = "Choose a valid dental service."
    if data.get("source") and data["source"] not in LEAD_SOURCES:
        errors["source"] = "Choose a valid lead source."

    if errors:
        raise HTTPException(status_code=400, detail={"message": "Please fix the form errors.", "errors": errors})


def require_allowed(value: str, allowed: list[str], label: str):
    if value not in allowed:
        raise HTTPException(status_code=400, detail={"message": f"{label} must be one of: {', '.join(allowed)}."})
