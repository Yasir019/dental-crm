import hashlib
import hmac
import time
from secrets import token_hex
from fastapi import HTTPException
from .utils import pick_first
from app.core.config import settings
from app.db.supabase import supabase_request

TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60
USER_SELECT = "id,username,display_name,clinic_name,email,phone,password_salt,password_hash"
PUBLIC_USER_SELECT = "id,username,display_name,clinic_name,email,phone"


def hash_password(password: str, salt: str):
    return hashlib.sha256(f"{salt}{password}".encode()).hexdigest()


def sign(value: str):
    return hmac.new(settings.auth_secret.encode(), value.encode(), hashlib.sha256).hexdigest()


def create_token(user_id: str):
    expires_at = int(time.time()) + TOKEN_TTL_SECONDS
    payload = f"{user_id}.{expires_at}"
    return f"{payload}.{sign(payload)}"


def verify_token(token: str | None):
    if not token:
        return None
    parts = token.split(".")
    if len(parts) != 3:
        return None
    user_id, expires_at, signature = parts
    payload = f"{user_id}.{expires_at}"
    if not hmac.compare_digest(signature, sign(payload)):
        return None
    if int(expires_at) < int(time.time()):
        return None
    return user_id


def public_user(user: dict):
    return {
        "id": user["id"],
        "username": user["username"],
        "displayName": user["display_name"],
        "clinicName": user["clinic_name"],
        "email": user.get("email") or "",
        "phone": user.get("phone") or "",
    }


async def login_user(username: str, password: str):
    rows = await supabase_request(
        "GET",
        "/crm_users",
        params={"select": USER_SELECT, "username": f"eq.{username}", "limit": "1"},
    )
    user = rows[0] if rows else None
    if not user or hash_password(password, user["password_salt"]) != user["password_hash"]:
        raise HTTPException(status_code=401, detail={"message": "Invalid username or password."})
    return {"token": create_token(user["id"]), "user": public_user(user)}


async def get_user_by_id(user_id: str):
    rows = await supabase_request(
        "GET",
        "/crm_users",
        params={"select": PUBLIC_USER_SELECT, "id": f"eq.{user_id}", "limit": "1"},
    )
    return public_user(pick_first(rows, "User not found."))


async def get_user_auth_by_id(user_id: str):
    rows = await supabase_request(
        "GET",
        "/crm_users",
        params={"select": USER_SELECT, "id": f"eq.{user_id}", "limit": "1"},
    )
    return pick_first(rows, "User not found.")


async def update_user_profile(user_id: str, data: dict):
    rows = await supabase_request(
        "PATCH",
        "/crm_users",
        params={"id": f"eq.{user_id}", "select": PUBLIC_USER_SELECT},
        json={
            "display_name": data["displayName"],
            "clinic_name": data["clinicName"],
            "email": data.get("email") or "",
            "phone": data.get("phone") or "",
        },
    )
    return public_user(pick_first(rows, "Profile could not be updated."))


async def update_user_password(user_id: str, current_password: str, new_password: str):
    user = await get_user_auth_by_id(user_id)
    if hash_password(current_password, user["password_salt"]) != user["password_hash"]:
        raise HTTPException(status_code=400, detail={"message": "Current password is incorrect."})
    salt = token_hex(16)
    await supabase_request(
        "PATCH",
        "/crm_users",
        params={"id": f"eq.{user_id}"},
        json={"password_salt": salt, "password_hash": hash_password(new_password, salt)},
    )
