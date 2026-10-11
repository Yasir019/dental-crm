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
MAX_CHAT_HISTORY = 50
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


def clean_agent_reply(value: str) -> str:
    """Remove structured lead-state text that a model may append to its reply."""
    reply = (value or "").strip()
    if not reply:
        return ""

    # Some models follow the JSON contract but still include an internal
    # debugging section inside the user-facing reply string.
    markers = ("**lead state**", "lead state:", "lead_state:")
    lowered = reply.lower()
    cut_positions = [lowered.find(marker) for marker in markers if lowered.find(marker) >= 0]
    if cut_positions:
        reply = reply[: min(cut_positions)].rstrip()

    # Never show a raw JSON/code-fence payload if it is returned without a
    # recognizable marker.
    fence_position = reply.find("```json")
    if fence_position >= 0:
        reply = reply[:fence_position].rstrip()

    return reply


def infer_known_from_history(history: list[dict]) -> dict:
    """Recover deterministic fields when a session resumes after a process restart."""
    known = {field: "" for field in REQUIRED_FIELDS}
    for index, item in enumerate(history):
        content = str(item.get("content") or "").strip()
        if not content:
            continue
        if not known["service"]:
            known["service"] = match_service(content)
            if not known["service"]:
                for service in SERVICES:
                    if service.lower() in content.lower():
                        known["service"] = service
                        break
        if not known["email"]:
            email_match = MESSAGE_PATTERNS["email"].search(content)
            if email_match:
                known["email"] = email_match.group(0)
        if not known["phone"]:
            phone_match = MESSAGE_PATTERNS["phone"].search(content)
            if phone_match:
                known["phone"] = clean_lead_fields({"phone": phone_match.group(0)})["phone"]
        if not known["name"] and index > 0 and item.get("role") == "user":
            previous = str(history[index - 1].get("content") or "").lower()
            # Only a short, letters-only answer is taken as a name; anything else is left to the agent.
            if ("full name" in previous or "your name" in previous) and re.fullmatch(r"[A-Za-z][A-Za-z .'-]{1,58}", content) and len(content.split()) <= 4:
                known["name"] = content
    return known


async def normalize_incoming(state: ChatbotState):
    history = [
        {"role": item.get("role"), "content": (item.get("content") or "").strip()}
        for item in (state.get("history") or [])
        if isinstance(item, dict) and item.get("role") in {"user", "assistant"} and (item.get("content") or "").strip()
    ]
    remembered = infer_known_from_history(history)
    remembered.update({field: value for field, value in (state.get("known") or {}).items() if value})
    return {
        "sessionId": state.get("sessionId") or "anonymous",
        "message": (state.get("message") or "").strip(),
        "pageUrl": state.get("pageUrl") or "",
        "history": history,
        "known": remembered,
    }


async def prepare_agent_input(state: ChatbotState):
    history_text = "\n".join(f"{item['role']}: {item['content']}" for item in state["history"][-MAX_CHAT_HISTORY:])
    known = state["known"]
    known_text = "\n".join(f"- {field}: {known.get(field) or '(missing)'}" for field in REQUIRED_FIELDS)
    agent_input = (
        f"Current visitor message: {state['message']}\n"
        f"Page URL: {state['pageUrl']}\n"
        f"Session ID: {state['sessionId']}\n"
        f"Conversation history:\n{history_text}\n\n"
        f"Lead fields collected so far:\n{known_text}\n\n"
        f"Next detail to ask for (only if it fits naturally): {next((field for field in REQUIRED_FIELDS if not known.get(field)), 'none, all collected')}\n\n"
        'Return ONLY this JSON object: {"reply":"string","lead":{"name":"","phone":"","email":"","service":"","notes":""}}'
    )
    return {"agentInput": agent_input}


async def dental_lead_agent(state: ChatbotState):
    # Deliberately compact: free AI tiers limit tokens per minute across all visitors.
    system = (
        f"You are the front-desk assistant for {settings.dental_clinic_name}, chatting with a visitor on the clinic website. "
        "Sound like a friendly, capable receptionist, not a script.\n\n"
        "HOW TO REPLY\n"
        "- Answer the visitor's latest message first, directly, in one to three short sentences.\n"
        "- Then take one step toward a booking: ask for exactly one missing detail, in this order: the service they need, "
        "their full name, email, phone number. Never ask for two details at once, never ask for one you already have, "
        "and do not repeat the wording of your previous question or anything else you already said (express sympathy once only).\n"
        "- If the visitor asked something that deserves a full answer, the answer comes first and the question is a short add-on.\n"
        "- If they describe pain or an unclear problem, show a little empathy and suggest a General Dentistry check-up so a dentist "
        "can look at it; do not guess the treatment. For a clear wish (whiter teeth, braces, a missing tooth) name the matching service.\n"
        "- If they refuse to share a detail, accept it in one sentence, do not ask for anything else in that reply, and tell them "
        "they can use the Book an appointment button below the chat or the form on this page instead.\n"
        "- Plain text only: no markdown, no asterisks, no headings, no JSON or field names inside the reply. "
        "Use lines starting with \"- \" only when listing three or more items.\n"
        "- Reply in the visitor's language (English or Roman Urdu).\n\n"
        "FACTS\n"
        f"{CLINIC_CONTEXT}"
        "Services (the lead service must be one of these exact names):\n"
        f"{service_catalog_text()}\n"
        "You cannot book or confirm a time in chat. Once you have their details the clinic team calls to confirm an appointment; "
        "they can also pick a slot themselves with the Book an appointment button below the chat.\n"
        "You do not know prices, dentist names, the street address, or insurance details. Say the team will confirm those, never guess.\n\n"
        "SAFETY\n"
        "Never diagnose or give treatment instructions. For severe pain, facial swelling, uncontrolled bleeding, trauma, fever, "
        "or breathing difficulty, tell them to seek urgent care now, then offer to pass their details to the clinic.\n\n"
        "LEAD FIELDS\n"
        "In \"lead\", fill every field the visitor has given anywhere in the conversation or in the collected fields, and keep "
        "them once given. Map what they describe to the closest exact service name (a cavity or filling is Dental Fillings, "
        "braces is Orthodontics). Never invent a name, email, or phone; leave a field empty until the visitor provides it. "
        "When all four are known, thank them and say the team will be in touch."
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

    reply = clean_agent_reply(str(output.get("reply") or ""))
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
    transcript_text = "\n".join(f"{item['role']}: {item['content']}" for item in state["transcript"][-MAX_CHAT_HISTORY:])
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

    first_name = lead_data["name"].split()[0]
    reply = (
        f"Thank you, {first_name}. I've passed your {lead_data['service']} request to our team. "
        f"They will contact you on {lead_data['phone']} during clinic hours, Monday to Friday, 9 AM to 5 PM."
    )
    return {"reply": reply, "leadCaptured": True, "savedLead": lead, "newLeadCreated": True, "missingFields": []}


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
