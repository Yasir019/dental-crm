"""Email follow-up for an existing lead (replaces the n8n "Email Follow-up — Existing Lead" branch)."""

from typing import TypedDict

from fastapi import HTTPException
from langgraph.graph import END, START, StateGraph

from app.core.config import settings
from app.services.email_service import send_followup_email
from app.services.email_templates import fallback_template
from app.workflows.llm import LLMError, chat_completion


class EmailState(TypedDict, total=False):
    leadId: str
    name: str
    email: str
    service: str
    subject: str
    body: str
    mode: str
    draft: str
    providerReference: str
    errorMessage: str
    result: dict


async def normalize_email_request(state: EmailState):
    return {
        "leadId": state.get("leadId") or "",
        "name": (state.get("name") or "").strip(),
        "email": (state.get("email") or "").strip(),
        "service": (state.get("service") or "").strip(),
        "subject": (state.get("subject") or "").strip(),
        "body": (state.get("body") or "").strip(),
        "mode": state.get("mode") if state.get("mode") in ["automatic", "manual"] else "automatic",
        "errorMessage": "",
    }


def needs_ai_email(state: EmailState):
    return "followup_email_agent" if not state["subject"] or not state["body"] else "send_followup"


async def followup_email_agent(state: EmailState):
    system = (
        f"You write friendly patient follow-up emails for {settings.dental_clinic_name}. Do not diagnose or give medical advice. "
        "Thank the patient, mention their requested dental service, explain that the clinic is open Monday to Friday "
        "from 9 AM to 5 PM, and ask for a preferred appointment time. "
        f"Sign off as the {settings.dental_clinic_name} team and never leave placeholders such as [Your Name]. "
        "Return only the email body."
    )
    prompt = f"Write a short professional dental clinic follow-up email for {state['name']} about {state['service']}."
    try:
        draft = await chat_completion(system, prompt, max_tokens=800, temperature=0.3)
    except LLMError as error:
        print(f"Follow-up email agent failed: {error}")
        draft = fallback_template(state["name"], state["service"])["body"]
    return {"draft": draft}


async def prepare_ai_email(state: EmailState):
    return {"subject": f"Following up about your {state['service']} inquiry", "body": state["draft"]}


async def send_followup(state: EmailState):
    try:
        result = await send_followup_email(state["email"], state["subject"], state["body"])
    except HTTPException as error:
        detail = error.detail
        return {"errorMessage": detail.get("message") if isinstance(detail, dict) else str(detail)}
    return {"providerReference": str(result.get("id") or "")}


def delivery_outcome(state: EmailState):
    return "record_failure" if state["errorMessage"] else "record_delivery"


async def record_status(state: EmailState, status: str):
    from app.services.followup_service import record_lead_email_delivery

    return await record_lead_email_delivery(
        state["leadId"],
        state["subject"],
        state["body"],
        state["mode"],
        status,
        state.get("providerReference") or "",
        state["errorMessage"],
    )


async def record_delivery(state: EmailState):
    return {"result": await record_status(state, "sent")}


async def record_failure(state: EmailState):
    await record_status(state, "failed")
    raise HTTPException(
        status_code=502,
        detail={"message": f"Email follow-up could not be sent: {state['errorMessage']} The failure was recorded in CRM."},
    )


builder = StateGraph(EmailState)
builder.add_node("normalize_email_request", normalize_email_request)
builder.add_node("followup_email_agent", followup_email_agent)
builder.add_node("prepare_ai_email", prepare_ai_email)
builder.add_node("send_followup", send_followup)
builder.add_node("record_delivery", record_delivery)
builder.add_node("record_failure", record_failure)
builder.add_edge(START, "normalize_email_request")
builder.add_conditional_edges("normalize_email_request", needs_ai_email, ["followup_email_agent", "send_followup"])
builder.add_edge("followup_email_agent", "prepare_ai_email")
builder.add_edge("prepare_ai_email", "send_followup")
builder.add_conditional_edges("send_followup", delivery_outcome, ["record_delivery", "record_failure"])
builder.add_edge("record_delivery", END)
builder.add_edge("record_failure", END)

email_graph = builder.compile()


async def run_email_followup(request: dict) -> dict:
    state = await email_graph.ainvoke(request)
    return state["result"]
