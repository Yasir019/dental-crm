from fastapi import Depends, Header, HTTPException
from app.services.auth_service import get_user_by_id, verify_token


async def require_auth(authorization: str | None = Header(default=None)):
    token = authorization.removeprefix("Bearer ").strip() if authorization else ""
    user_id = verify_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail={"message": "Authentication required."})
    return await get_user_by_id(user_id)
