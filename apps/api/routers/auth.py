from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.email_token import EMAIL_TOKEN_VERIFY, EMAIL_TOKEN_RESET
from models.user import User
from services.auth import (
    register_user, authenticate_user, create_access_token,
    create_refresh_token, rotate_refresh_token, revoke_refresh_token,
    create_email_token, consume_email_token,
    change_password, reset_password,
    get_current_user,
)
from services.email import send_verification_email, send_password_reset_email

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class AuthIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshIn(BaseModel):
    refresh_token: str


class UserOut(BaseModel):
    id: str
    email: str
    role: str
    is_active: bool
    email_verified: bool


class VerifyEmailIn(BaseModel):
    token: str


class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ResetPasswordIn(BaseModel):
    token: str
    new_password: str


class ChangePasswordIn(BaseModel):
    old_password: str
    new_password: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/register", response_model=TokenOut, status_code=201)
async def register(body: AuthIn, db: AsyncSession = Depends(get_db)):
    user = await register_user(body.email, body.password, db)
    verify_token = await create_email_token(user.id, EMAIL_TOKEN_VERIFY, db)
    send_verification_email(user.email, verify_token)
    access_token = create_access_token(user.id)
    refresh_token = await create_refresh_token(user.id, db)
    return TokenOut(access_token=access_token, refresh_token=refresh_token)


@router.post("/login", response_model=TokenOut)
async def login(body: AuthIn, db: AsyncSession = Depends(get_db)):
    user = await authenticate_user(body.email, body.password, db)
    access_token = create_access_token(user.id)
    refresh_token = await create_refresh_token(user.id, db)
    return TokenOut(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenOut)
async def refresh(body: RefreshIn, db: AsyncSession = Depends(get_db)):
    access_token, new_refresh = await rotate_refresh_token(body.refresh_token, db)
    return TokenOut(access_token=access_token, refresh_token=new_refresh)


@router.post("/logout", status_code=204)
async def logout(body: RefreshIn, db: AsyncSession = Depends(get_db)):
    await revoke_refresh_token(body.refresh_token, db)


@router.post("/verify-email", status_code=200)
async def verify_email(body: VerifyEmailIn, db: AsyncSession = Depends(get_db)):
    from datetime import timezone
    from datetime import datetime
    user = await consume_email_token(body.token, EMAIL_TOKEN_VERIFY, db)
    user.email_verified = True
    user.email_verified_at = datetime.now(timezone.utc)
    await db.commit()
    return {"detail": "Email verified"}


@router.post("/resend-verification", status_code=200)
async def resend_verification(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.email_verified:
        return {"detail": "Email already verified"}
    verify_token = await create_email_token(current_user.id, EMAIL_TOKEN_VERIFY, db)
    send_verification_email(current_user.email, verify_token)
    return {"detail": "Verification email sent"}


@router.post("/forgot-password", status_code=200)
async def forgot_password(body: ForgotPasswordIn, db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select
    from models.user import User as UserModel
    result = await db.execute(select(UserModel).where(UserModel.email == body.email))
    user = result.scalar_one_or_none()
    # Always return 200 — don't leak whether email exists
    if user and user.is_active:
        reset_token = await create_email_token(user.id, EMAIL_TOKEN_RESET, db)
        send_password_reset_email(user.email, reset_token)
    return {"detail": "If that email exists, a reset link has been sent"}


@router.post("/reset-password", status_code=200)
async def reset_password_endpoint(body: ResetPasswordIn, db: AsyncSession = Depends(get_db)):
    await reset_password(body.token, body.new_password, db)
    return {"detail": "Password updated"}


@router.post("/change-password", status_code=200)
async def change_password_endpoint(
    body: ChangePasswordIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await change_password(current_user, body.old_password, body.new_password, db)
    return {"detail": "Password changed"}


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return UserOut(
        id=str(current_user.id),
        email=current_user.email,
        role=current_user.role,
        is_active=current_user.is_active,
        email_verified=current_user.email_verified,
    )
