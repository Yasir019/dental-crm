from fastapi import APIRouter, Depends, HTTPException
from app.core.security import require_auth
from app.schemas.auth import LoginRequest, PasswordUpdate, ProfileUpdate
from app.services.auth_service import get_user_by_id, login_user, update_user_password, update_user_profile

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login")
async def login_handler(payload: LoginRequest):
    if not payload.username or not payload.password:
        raise HTTPException(status_code=400, detail={"message": "Username and password are required."})
    return await login_user(payload.username, payload.password)


@router.get("/me")
async def me_handler(user=Depends(require_auth)):
    return {"user": await get_user_by_id(user["id"])}


@router.patch("/profile")
async def update_profile_handler(payload: ProfileUpdate, user=Depends(require_auth)):
    if not payload.displayName or not payload.clinicName:
        raise HTTPException(status_code=400, detail={"message": "Display name and clinic name are required."})
    updated = await update_user_profile(user["id"], payload.model_dump())
    return {"message": "Profile updated.", "user": updated}


@router.patch("/password")
async def update_password_handler(payload: PasswordUpdate, user=Depends(require_auth)):
    if not payload.currentPassword or not payload.newPassword:
        raise HTTPException(status_code=400, detail={"message": "Current password and new password are required."})
    if len(payload.newPassword) < 8:
        raise HTTPException(status_code=400, detail={"message": "New password must be at least 8 characters."})
    await update_user_password(user["id"], payload.currentPassword, payload.newPassword)
    return {"message": "Password updated."}
