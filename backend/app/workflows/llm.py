import asyncio
import json
import re

import httpx

from app.core.config import settings


MAX_RATE_LIMIT_WAIT_SECONDS = 8


class LLMError(Exception):
    pass


def retry_after_seconds(response: httpx.Response) -> float:
    try:
        return max(0.5, float(response.headers.get("retry-after", "1")))
    except ValueError:
        return 1.0


async def chat_completion(system: str, user: str, *, max_tokens: int = 1500, temperature: float = 0.2, json_mode: bool = False, reasoning_effort: str = "low") -> str:
    if not settings.ai_api_key:
        raise LLMError("AI_API_KEY is not configured.")

    body = {
        "model": settings.ai_model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if json_mode:
        body["response_format"] = {"type": "json_object"}
    if "gpt-oss" in settings.ai_model:
        # Reasoning tokens count against max_tokens and the provider's rate limit.
        body["reasoning_effort"] = reasoning_effort

    try:
        async with httpx.AsyncClient(timeout=45) as client:
            for attempt in range(3):
                response = await client.post(
                    f"{settings.ai_api_base_url.rstrip('/')}/chat/completions",
                    headers={"Authorization": f"Bearer {settings.ai_api_key}"},
                    json=body,
                )
                retry_after = retry_after_seconds(response)
                if response.status_code != 429 or attempt == 2 or retry_after > MAX_RATE_LIMIT_WAIT_SECONDS:
                    break
                await asyncio.sleep(retry_after)
    except httpx.HTTPError as error:
        raise LLMError(f"Could not reach the AI provider: {error}") from error

    if response.status_code >= 400:
        raise LLMError(f"AI provider returned HTTP {response.status_code}.")

    try:
        content = (response.json()["choices"][0]["message"]["content"] or "").strip()
    except (KeyError, IndexError, TypeError, ValueError) as error:
        raise LLMError("AI provider returned an unexpected response.") from error

    # Reasoning models return empty content when max_tokens is spent on reasoning.
    if not content:
        raise LLMError("AI provider returned an empty reply.")
    return content


def parse_json_object(raw: str) -> dict:
    cleaned = re.sub(r"```json|```", "", raw or "").strip()
    try:
        parsed = json.loads(cleaned)
    except ValueError:
        return {}
    return parsed if isinstance(parsed, dict) else {}
