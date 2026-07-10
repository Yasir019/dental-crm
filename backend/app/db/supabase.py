import httpx
from fastapi import HTTPException
from app.core.config import settings


if not settings.supabase_url or not settings.supabase_service_role_key:
    raise RuntimeError("Supabase credentials are not configured.")


BASE_URL = f"{settings.supabase_url.rstrip('/')}/rest/v1"
HEADERS = {
    "apikey": settings.supabase_service_role_key,
    "Authorization": f"Bearer {settings.supabase_service_role_key}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}


async def supabase_request(method: str, path: str, *, params: dict | None = None, json: dict | list | None = None):
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.request(
            method,
            f"{BASE_URL}{path}",
            headers=HEADERS,
            params=params,
            json=json,
        )

    if response.status_code >= 400:
        try:
            detail = response.json()
        except ValueError:
            detail = response.text
        raise HTTPException(status_code=500, detail=detail)

    if response.status_code == 204 or not response.content:
        return None

    return response.json()
