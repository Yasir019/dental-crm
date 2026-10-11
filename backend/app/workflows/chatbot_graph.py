"""Website chatbot lead capture (replaces the n8n "Website Chatbot — New Lead Capture" branch)."""

import re
from typing import TypedDict

import httpx
from fastapi import HTTPException
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph

from app.ai.prompts import CLINIC_CONTEXT
from app.core.config import settings
from app.services.leads_service import create_lead, create_lead_chat_messages
from app.utils.service_catalog import service_catalog_text
from app.utils.validation import EMAIL_RE, SERVICES
from app.workflows.llm import LLMError, chat_completion, parse_json_object


REQUIRED_FIELDS = ["service", "name", "email", "phone"]
FIELD_QUESTIONS = {
    "service": "What service are you looking for?",
    "name": "May I have your full name, please?",
    "email": "Could you share your email address?",
    "phone": "Lastly, could you share your phone number?",
}
MESSAGE_PATTERNS = {
    "email": re.compile(r"[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+"),
    "phone": re.compile(r"\+?\d[\d\s().-]{6,18}\d"),
}
CAPTURED_REPLY ="Thank you. Our team will follow back soon."
SAVE_FAILED_REPLY = (
    "Thank you. I have your details, but I could not save them right now. "
    "Please try again in a moment or use the consultation form on this page."
)


class ChatbotState(TypedDict, total=False):
    sessionId: str
    message: str
    pageUrl: str
    history: list[dict]
    agentInput: str
    agentOutput: str
    # known and savedLead persist per session through the checkpointer (n8n "Chat Memory").
    known: dict
    savedLead: dict | None
    reply: str
    lead: dict
    transcript: list[dict]
    leadComplete: bool
    leadCaptured: bool
    newLeadCreated: bool
    missingFields: list[str]


def match_service(value: str) -> str:
    normalized = (value or "").strip().lower()
    return next((service for service in SERVICES if service.lower() == normalized), "")


def clean_lead_fields(lead: dict) -> dict:
    email = str(lead.get("email") or "").strip()
    phone = str(lead.get("phone") or "").strip()
    return {
        "service": match_service(str(lead.get("service") or "")),
        "name": str(lead.get("name") or "").strip(),
        "email": email if EMAIL_RE.match(email) else "",
        "phone": phone if len(re.sub(r"\D", "", phone)) >= 7 else "",
    }


async def normalize_incoming(state: ChatbotState):
    history = [
        {"role": item.get("role"), "content": (item.get("content") or "").strip()}
        for item in (state.get("history") or [])
        if isinstance(item, dict) and item.get("role") in {"user", "assistant"} and (item.get("content") or "").strip()
    ]
    return {
        "sessionId": state.get("sessionId") or "anonymous",
        "message": (state.get("message") or "").strip(),
        "pageUrl": state.get("pageUrl") or "",
        "history": history,
        "known": state.get("known") or {},
    }


async def prepare_agent_input(state: ChatbotState):
    history_text = "\n".join(f"{item['role']}: {item['content']}" for item in state["history"][-12:])
    known = state["known"]
    known_text = "\n".join(f"- {field}: {known.get(field) or '(missing)'}" for field in REQUIRED_FIELDS)
    agent_input = (
        f"Current visitor message: {state['message']}\n"
        f"Page URL: {state['pageUrl']}\n"
        f"Session ID: {state['sessionId']}\n"
        f"Conversation history:\n{history_text}\n\n"
        f"Lead fields collected so far:\n{known_text}\n\n"
        "Required lead fields in this exact order: service, name, email, phone.\n"
        "Conversation rules:\n"
        "1. If user sends a normal greeting or general message, reply with a greeting/answer and end with: What service are you looking for?\n"
        "2. Collect only one missing field at a time. Do not ask for name, email, and phone in one message.\n"
        "3. First identify service. Then ask name. After name ask email. After email ask phone number.\n"
        "4. When service, name, email, and phone are all known, say: Our team will follow back soon.\n"
        "5. In \"lead\", always fill every field the visitor has already given anywhere in the conversation history "
        "or in the collected fields. Map what they describe to the closest exact service name "
        "(for example a cavity or filling is Dental Fillings, braces is Orthodontics).\n"
        "6. Never invent a name, email, or phone. Leave a field empty only when the visitor has not provided it.\n"
        "7. Ask only for the first field that is still missing. Never ask again for a field you already have.\n"
        "8. Return ONLY valid JSON text. Do not use markdown. Do not wrap in code fences.\n"
        'JSON shape: {"reply":"string","lead":{"name":"","phone":"","email":"","service":"","notes":""},'
        '"leadComplete":false,"missingFields":["service","name","email","phone"]}'
    )
    return {"agentInput": agent_input}


async def dental_lead_agent(state: ChatbotState):
    # Deliberately compact: free AI tiers limit tokens per minute across all visitors.
    system = (
        f"You are the {settings.dental_clinic_name} website AI agent. Return only valid JSON text. "
        "Collect service, then name, then email, then phone one at a time. If normal greeting, greet and ask "
        "what service they are looking for. When all fields are collected, reply that our team will follow back soon.\n"
        f"{CLINIC_CONTEXT}"
        "Services (the lead service must be one of these exact names):\n"
        f"{service_catalog_text()}\n"
        "Be warm and concise. Never diagnose, quote prices, or claim an appointment is booked. For severe pain, "
        "swelling, bleeding, trauma, fever, or breathing difficulty, advise urgent local care."
    )
    try:
        output = await chat_completion(system, state["agentInput"], max_tokens=1200, temperature=0.2, json_mode=True, reasoning_effort="medium")
    except LLMError as error:
        print(f"Chatbot agent failed: {error}")
        output = ""
    return {"agentOutput": output}


async def normalize_agent_output(state: ChatbotState):
    output = parse_json_object(state.get("agentOutput") or "")
    extracted = clean_lead_fields(output.get("lead") if isinstance(output.get("lead"), dict) else {})
    known = {field: extracted[field] or state["known"].get(field) or "" for field in REQUIRED_FIELDS}
    # Email and phone are recognisable without the agent, so capture still progresses if the AI call fails.
    for field, pattern in MESSAGE_PATTERNS.items():
        found = pattern.search(state["message"])
        if not known[field] and found:
            known[field] = clean_lead_fields({field: found.group(0)})[field]
    missing_fields = [field for field in REQUIRED_FIELDS if not known[field]]

    reply = str(output.get("reply") or "").strip()
    if missing_fields and (not reply or output.get("leadComplete")):
        # The agent failed or claimed completion while a required field is still missing or invalid.
        reply = FIELD_QUESTIONS[missing_fields[0]]
    elif not reply:
        reply = CAPTURED_REPLY

    transcript = list(state["history"])
    if not transcript or transcript[-1] != {"role": "user", "content": state["message"]}:
        transcript.append({"role": "user", "content": state["message"]})
    transcript.append({"role": "assistant", "content": reply})

    notes = ""
    if isinstance(output.get("lead"), dict):
        notes = str(output["lead"].get("notes") or "").strip()

    return {
        "known": known,
        "reply": reply,
        "lead": {**known, "notes": notes or f"Website chatbot session {state['sessionId']}"},
        "transcript": transcript,
        "leadComplete": not missing_fields,
        "missingFields": missing_fields,
    }


def has_complete_lead(state: ChatbotState):
    if state["leadComplete"] and not state.get("savedLead"):
        return "create_crm_lead"
    return "return_chat_reply"


async def create_crm_lead(state: ChatbotState):
    lead_data = state["lead"]
    transcript_text = "\n".join(f"{item['role']}: {item['content']}" for item in state["transcript"][-12:])
    try:
        lead = await create_lead(
            {
                "name": lead_data["name"],
                "phone": lead_data["phone"],
                "email": lead_data["email"],
                "service": lead_data["service"],
                "source": "AI Chatbot",
                "sourceDetail": "Website AI chatbot via LangGraph",
                "notes": f"{lead_data['notes']}\n\nChat transcript:\n{transcript_text}".strip(),
            }
        )
    except (HTTPException, httpx.HTTPError) as error:
        print(f"Chatbot lead could not be saved: {getattr(error, 'detail', error)}")
        return {"reply": SAVE_FAILED_REPLY, "leadCaptured": False, "savedLead": None, "newLeadCreated": False}

    try:
        await create_lead_chat_messages(lead["id"], state["transcript"], state["sessionId"])
    except (HTTPException, httpx.HTTPError) as error:
        print(f"Chatbot transcript could not be saved: {getattr(error, 'detail', error)}")

    return {"reply": CAPTURED_REPLY, "leadCaptured": True, "savedLead": lead, "newLeadCreated": True, "missingFields": []}


async def return_chat_reply(state: ChatbotState):
    # A session that already produced a lead keeps reporting it instead of creating a duplicate.
    return {"leadCaptured": bool(state.get("savedLead")), "newLeadCreated": False}


builder = StateGraph(ChatbotState)
builder.add_node("normalize_incoming", normalize_incoming)
builder.add_node("prepare_agent_input", prepare_agent_input)
builder.add_node("dental_lead_agent", dental_lead_agent)
builder.add_node("normalize_agent_output", normalize_agent_output)
builder.add_node("create_crm_lead", create_crm_lead)
builder.add_node("return_chat_reply", return_chat_reply)
builder.add_edge(START, "normalize_incoming")
builder.add_edge("normalize_incoming", "prepare_agent_input")
builder.add_edge("prepare_agent_input", "dental_lead_agent")
builder.add_edge("dental_lead_agent", "normalize_agent_output")
builder.add_conditional_edges("normalize_agent_output", has_complete_lead, ["create_crm_lead", "return_chat_reply"])
builder.add_edge("create_crm_lead", END)
builder.add_edge("return_chat_reply", END)

chatbot_graph = builder.compile(checkpointer=InMemorySaver())


async def run_chatbot_turn(payload: dict) -> dict:
    session_id = payload.get("sessionId") or "anonymous"
    state = await chatbot_graph.ainvoke(
        {
            "sessionId": session_id,
            "message": payload.get("message") or "",
            "pageUrl": payload.get("pageUrl") or "",
            "history": payload.get("history") or [],
        },
        config={"configurable": {"thread_id": session_id}},
    )
    return {
        "reply": state["reply"],
        "leadCaptured": state["leadCaptured"],
        "lead": state.get("savedLead") if state["leadCaptured"] else None,
        "missingFields": state.get("missingFields") or [],
        "newLeadCreated": state.get("newLeadCreated", False),
    }
