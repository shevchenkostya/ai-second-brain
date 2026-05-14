from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.user import User
from services.auth import register_user, authenticate_user, create_access_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


class AuthIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: str
    email: str


@router.post("/register", response_model=TokenOut, status_code=201)
async def register(body: AuthIn, db: AsyncSession = Depends(get_db)):
    user = await register_user(body.email, body.password, db)
    return TokenOut(access_token=create_access_token(user.id))


@router.post("/login", response_model=TokenOut)
async def login(body: AuthIn, db: AsyncSession = Depends(get_db)):
    user = await authenticate_user(body.email, body.password, db)
    return TokenOut(access_token=create_access_token(user.id))


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return UserOut(id=str(current_user.id), email=current_user.email)
