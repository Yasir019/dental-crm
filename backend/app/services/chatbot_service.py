import re

from fastapi import BackgroundTasks

from app.services.followup_service import dispatch_automatic_followup
from app.utils.service_catalog import service_names_text
from app.workflows.chatbot_graph import run_chatbot_turn


SERVICE_LIST_REQUEST = re.compile(
    r"\b(what services|which services|what type of services|what kind of services|services do you|services you provide|services you offer|do you offer|do you provide|what treatments|treatments do you offer|service list|available services)\b",
    re.IGNORECASE,
)
AVAILABILITY_REQUEST = re.compile(
    r"\b(working days|opening hours|open today|what hours|when are you open|available days|clinic hours|your hours|opening times|timings?)\b",
    re.IGNORECASE,
)


def is_service_list_request(message: str) -> bool:
    return bool(SERVICE_LIST_REQUEST.search(message or ""))


def service_list_reply() -> str:
    return (
        "We offer these dental services:\n\n"
        f"{service_names_text()}\n\n"
        "Which service are you looking for?"
    )


def availability_reply() -> str:
    return (
        "Our clinic hours are:\n\n"
        "- Monday to Friday: 9:00 AM to 5:00 PM\n"
        "- Saturday: Closed\n"
        "- Sunday: Closed\n\n"
        "What dental service are you looking for?"
    )


async def send_chatbot_message(payload: dict, background_tasks: BackgroundTasks | None = None):
    # Keep the hours and the service directory complete and predictable
    # regardless of what the AI agent would answer.
    message = payload.get("message", "")
    if AVAILABILITY_REQUEST.search(message or ""):
        return {
            "reply": availability_reply(),
            "leadCaptured": False,
            "lead": None,
            "missingFields": ["service"],
        }
    if is_service_list_request(message):
        return {
            "reply": service_list_reply(),
            "leadCaptured": False,
            "lead": None,
            "missingFields": ["service"],
        }

    result = await run_chatbot_turn(payload)
    if result.pop("newLeadCreated") and background_tasks is not None:
        background_tasks.add_task(dispatch_automatic_followup, result["lead"])
    return result
