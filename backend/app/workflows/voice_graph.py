"""Retell call analysis (replaces the n8n "Retell Voice Call Analysis" branch).

Inbound website voice calls can create a new lead. Outbound appointment callback
analyses are saved against the existing lead and never create a new one.
"""

import json
import re
from datetime import datetime, timezone
from typing import Any, TypedDict

from fastapi import HTTPException
from langgraph.graph import END, START, StateGraph

from app.core.config import settings
from app.db.supabase import supabase_request
from app.services.leads_service import create_lead, create_lead_voice_call, get_lead
from app.utils.service_catalog import service_names_text
from app.utils.validation import EMAIL_RE
from app.workflows.chatbot_graph import match_service
from app.workflows.llm import LLMError, chat_completion, parse_json_object


REQUIRED_FIELDS = ["name", "phone", "email", "service"]


class VoiceState(TypedDict, total=False):
    payload: dict
    shouldSkipVoiceLead: bool
    agentInput: str
    agentOutput: str
    call: dict
    leadId: str
    lead: dict
    callSummary: str
    leadComplete: bool
    missingFields: list[str]
    newLeadCreated: bool
    savedLead: dict | None
    response: dict


def unwrap_candidates(payload: dict) -> list[dict]:
    candidates, seen, queue = [], set(), [payload]
    while queue:
        value = queue.pop(0)
        if not isinstance(value, dict) or id(value) in seen:
            continue
        seen.add(id(value))
        candidates.append(value)
        queue.extend(value[key] for key in ("body", "data", "call") if isinstance(value.get(key), dict))
    return candidates


def first_value(keys: list[str], sources: list[dict]) -> Any:
    for key in keys:
        for source in sources:
            value = source.get(key)
            if value not in (None, ""):
                return value
    return None


def to_iso(value: Any) -> str | None:
    if value in (None, ""):
        return None
    if isinstance(value, (int, float)) or re.fullmatch(r"\d+(\.\d+)?", str(value)):
        number = float(value)
        seconds = number if number < 100000000000 else number / 1000
        try:
            return datetime.fromtimestamp(seconds, timezone.utc).isoformat()
        except (OverflowError, OSError, ValueError):
            return None
    return str(value)


def extract_call_details(payload: dict) -> dict:
    candidates = unwrap_candidates(payload)
    metadata = [value["metadata"] for value in candidates if isinstance(value.get("metadata"), dict)]
    analysis = [
        value.get("call_analysis") or value.get("callAnalysis")
        for value in candidates
        if isinstance(value.get("call_analysis") or value.get("callAnalysis"), dict)
    ]
    custom = [
        value.get("custom_analysis_data") or value.get("customAnalysisData")
        for value in [*analysis, *candidates]
        if isinstance(value.get("custom_analysis_data") or value.get("customAnalysisData"), dict)
    ]

    started_raw = first_value(["start_timestamp", "startTimestamp", "started_at", "startedAt"], candidates)
    ended_raw = first_value(["end_timestamp", "endTimestamp", "ended_at", "endedAt"], candidates)
    started_at, ended_at = to_iso(started_raw), to_iso(ended_raw)

    duration_seconds = None
    explicit_seconds = first_value(["duration_seconds", "durationSeconds"], candidates)
    duration_ms = first_value(["duration_ms", "durationMs"], candidates)
    try:
        if explicit_seconds is not None:
            duration_seconds = round(float(explicit_seconds))
        elif duration_ms is not None:
            duration_seconds = round(float(duration_ms) / 1000)
        elif started_at and ended_at:
            delta = (datetime.fromisoformat(ended_at.replace("Z", "+00:00")) - datetime.fromisoformat(started_at.replace("Z", "+00:00"))).total_seconds()
            duration_seconds = round(delta) if delta >= 0 else None
    except (TypeError, ValueError):
        duration_seconds = None

    successful = first_value(["call_successful", "callSuccessful"], [*analysis, *candidates])
    if isinstance(successful, str):
        successful = {"true": True, "false": False}.get(successful.lower())

    summary = first_value(["call_summary", "callSummary"], [*analysis, *candidates])
    sentiment = first_value(["user_sentiment", "userSentiment"], [*analysis, *candidates])

    return {
        "metadata": metadata,
        "custom": custom,
        "callId": str(first_value(["call_id", "callId"], candidates) or ""),
        "fromNumber": str(first_value(["from_number", "fromNumber"], candidates) or ""),
        "toNumber": str(first_value(["to_number", "toNumber"], candidates) or ""),
        "callStatus": str(first_value(["call_status", "callStatus", "event"], candidates) or ""),
        "transcript": str(first_value(["transcript"], candidates) or ""),
        "callSummary": str(summary or ""),
        "recordingUrl": str(first_value(["recording_url", "recordingUrl"], candidates) or ""),
        "startedAt": started_at,
        "endedAt": ended_at,
        "durationSeconds": duration_seconds,
        "userSentiment": str(sentiment or ""),
        "callSuccessful": successful if isinstance(successful, bool) else None,
        "customAnalysisData": custom[0] if custom else {},
        "rawPayload": payload,
    }


async def prepare_voice_agent_input(state: VoiceState):
    call = extract_call_details(state["payload"])
    metadata, custom = call.pop("metadata"), call.pop("custom")

    call_purpose = str(first_value(["call_purpose"], metadata) or "").strip()
    metadata_source = str(first_value(["source"], metadata) or "").strip()
    should_skip = call_purpose == "appointment_booking_callback" or metadata_source == "crm_followup_callback"

    known = {
        "name": first_value(["patient_name", "name"], custom) or "",
        "phone": first_value(["patient_phone", "phone"], custom) or call["fromNumber"],
        "email": first_value(["patient_email", "email"], custom) or "",
        "service": first_value(["service", "dental_service"], custom) or "",
    }
    agent_input = (
        "Extract one dental lead from this Retell voice call. Return ONLY valid JSON text with no markdown. "
        "If email is missing, leadComplete must be false and missingFields must include email.\n"
        "Callers spell emails and say phone numbers aloud, so rebuild the written value: join spelled letters, "
        "\"double t\" is tt, number words become digits, \"at\" is @, \"dot\" is a full stop, and filler words are dropped. "
        "When the agent read a value back and the caller confirmed it, use that confirmed value over the caller's first attempt. "
        "Write the phone as digits only, with a leading + if the caller gave a country code.\n\n"
        f"Allowed service values (use the exact name):\n{service_names_text()}\n\n"
        f"Known structured data:\n{json.dumps(known)}\n\n"
        f"Call summary:\n{call['callSummary']}\n\n"
        f"Transcript:\n{call['transcript']}\n\n"
        f"Clinic name: {settings.dental_clinic_name}. Goal: extract dental lead data from a Retell AI voice call. "
        "Required lead fields: name, email, phone, service. Do not save a lead without email.\n\n"
        'JSON shape: {"lead":{"name":"","phone":"","email":"","service":"","notes":""},"callSummary":"","leadComplete":false,"missingFields":["email"]}'
    )
    return {
        "call": call,
        "lead": known,
        "shouldSkipVoiceLead": should_skip,
        "leadId": str(first_value(["lead_id", "leadId"], metadata) or ""),
        "agentInput": agent_input,
        "newLeadCreated": False,
        "savedLead": None,
    }


def is_new_voice_lead_call(state: VoiceState):
    return "save_followup_call" if state["shouldSkipVoiceLead"] else "voice_lead_agent"


async def save_followup_call(state: VoiceState):
    call, lead_id = state["call"], state["leadId"]
    if not lead_id:
        return {"response": {"received": True, "saved": False, "message": "Callback analysis has no lead_id metadata.", "callId": call["callId"]}}
    try:
        await get_lead(lead_id)
    except HTTPException as error:
        if error.status_code != 404:
            raise
        return {"response": {"received": True, "saved": False, "message": "Lead not found.", "leadId": lead_id, "callId": call["callId"]}}

    await create_lead_voice_call(lead_id, {**call, "phone": call["toNumber"] or call["fromNumber"]}, "followup")
    return {"response": {"received": True, "saved": True, "leadId": lead_id, "callId": call["callId"]}}


async def voice_lead_agent(state: VoiceState):
    system = (
        f"You are the {settings.dental_clinic_name} Retell voice lead extraction agent. Return only valid JSON text. "
        "Extract name, email, phone, and one allowed dental service from the call. Email is mandatory. "
        "If email is missing, leadComplete=false. Never invent email, phone, or service."
    )
    try:
        output = await chat_completion(system, state["agentInput"], max_tokens=1000, temperature=0.2, json_mode=True)
    except LLMError as error:
        print(f"Voice lead agent failed: {error}")
        output = ""
    return {"agentOutput": output}


async def normalize_voice_agent_output(state: VoiceState):
    output = parse_json_object(state.get("agentOutput") or "")
    extracted = output.get("lead") if isinstance(output.get("lead"), dict) else {}
    known, call = state["lead"], state["call"]

    email = str(extracted.get("email") or known.get("email") or "").strip()
    lead = {
        "name": str(extracted.get("name") or known.get("name") or "").strip(),
        "phone": str(extracted.get("phone") or known.get("phone") or call["fromNumber"] or "").strip(),
        "email": email if EMAIL_RE.match(email) else "",
        "service": match_service(str(extracted.get("service") or "")) or match_service(str(known.get("service") or "")),
        "notes": str(extracted.get("notes") or "").strip() or f"Retell voice call {call['callId']}".strip(),
    }
    missing_fields = [field for field in REQUIRED_FIELDS if not lead[field]]
    return {
        "lead": lead,
        "callSummary": str(output.get("callSummary") or call["callSummary"] or ""),
        "leadComplete": not missing_fields,
        "missingFields": missing_fields,
    }


def has_voice_lead_email(state: VoiceState):
    return "create_crm_voice_lead" if state["leadComplete"] and state["lead"]["email"] else "return_voice_lead_not_saved"


async def create_crm_voice_lead(state: VoiceState):
    lead_data, call = state["lead"], {**state["call"], "callSummary": state["callSummary"]}

    # Retell retries webhooks; a call that already has a record must not create a second lead.
    if call["callId"]:
        existing = await supabase_request(
            "GET",
            "/lead_voice_calls",
            params={"select": "id,lead_id", "retell_call_id": f"eq.{call['callId']}", "limit": "1"},
        )
        if existing:
            return {"response": {"ok": True, "leadSaved": False, "message": "This call was already processed.", "leadId": existing[0].get("lead_id")}}

    notes_parts = [lead_data["notes"]]
    if call["callSummary"]:
        notes_parts.append(f"Call summary:\n{call['callSummary']}")
    if call["transcript"]:
        notes_parts.append(f"Voice transcript:\n{call['transcript']}")

    lead = await create_lead(
        {
            "name": lead_data["name"],
            "phone": lead_data["phone"],
            "email": lead_data["email"],
            "service": lead_data["service"],
            "source": "AI Voice Agent",
            "sourceDetail": "Retell AI voice agent via LangGraph",
            "notes": "\n\n".join(part for part in notes_parts if part).strip(),
        }
    )
    await create_lead_voice_call(lead["id"], {**call, "phone": lead_data["phone"]})
    return {
        "savedLead": lead,
        "newLeadCreated": True,
        "response": {"ok": True, "leadSaved": True, "message": "AI voice lead saved to CRM.", "lead": lead},
    }


async def return_voice_lead_not_saved(state: VoiceState):
    missing_fields = state["missingFields"] or ["email"]
    return {
        "response": {
            "ok": True,
            "leadSaved": False,
            "message": f"Voice lead was not saved because these fields are missing: {', '.join(missing_fields)}.",
            "missingFields": missing_fields,
        }
    }


builder = StateGraph(VoiceState)
builder.add_node("prepare_voice_agent_input", prepare_voice_agent_input)
builder.add_node("save_followup_call", save_followup_call)
builder.add_node("voice_lead_agent", voice_lead_agent)
builder.add_node("normalize_voice_agent_output", normalize_voice_agent_output)
builder.add_node("create_crm_voice_lead", create_crm_voice_lead)
builder.add_node("return_voice_lead_not_saved", return_voice_lead_not_saved)
builder.add_edge(START, "prepare_voice_agent_input")
builder.add_conditional_edges("prepare_voice_agent_input", is_new_voice_lead_call, ["save_followup_call", "voice_lead_agent"])
builder.add_edge("save_followup_call", END)
builder.add_edge("voice_lead_agent", "normalize_voice_agent_output")
builder.add_conditional_edges("normalize_voice_agent_output", has_voice_lead_email, ["create_crm_voice_lead", "return_voice_lead_not_saved"])
builder.add_edge("create_crm_voice_lead", END)
builder.add_edge("return_voice_lead_not_saved", END)

voice_graph = builder.compile()


async def run_voice_call_analysis(payload: dict) -> dict:
    state = await voice_graph.ainvoke({"payload": payload})
    return {**state["response"], "newLeadCreated": state.get("newLeadCreated", False), "savedLead": state.get("savedLead")}
