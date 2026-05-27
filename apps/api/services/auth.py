import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from models.email_token import EmailToken, EMAIL_TOKEN_RESET
from models.refresh_token import RefreshToken
from models.user import User, ROLE_ADMIN

ALGORITHM = "HS256"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(dt: datetime) -> datetime:
    """Ensure dt is timezone-aware UTC. SQLite returns naive datetimes."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ── Access token ──────────────────────────────────────────────────────────────

def create_access_token(user_id: uuid.UUID) -> str:
    expire = _utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    return jwt.encode(
        {"sub": str(user_id), "exp": expire},
        settings.secret_key,
        algorithm=ALGORITHM,
    )


# ── Refresh token ─────────────────────────────────────────────────────────────

async def create_refresh_token(user_id: uuid.UUID, db: AsyncSession) -> str:
    raw = secrets.token_urlsafe(48)
    token_hash = _hash_token(raw)
    expires_at = _utcnow() + timedelta(days=settings.refresh_token_expire_days)
    db.add(RefreshToken(user_id=user_id, token_hash=token_hash, expires_at=expires_at))
    await db.commit()
    return raw


async def rotate_refresh_token(raw: str, db: AsyncSession) -> tuple[str, str]:
    """Exchange a valid refresh token for a new access + refresh token pair."""
    token_hash = _hash_token(raw)
    result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    stored = result.scalar_one_or_none()

    if stored is None or stored.revoked or _as_utc(stored.expires_at) < _utcnow():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")

    stored.revoked = True
    await db.flush()

    user = await db.get(User, stored.user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    access_token = create_access_token(user.id)
    new_refresh = await create_refresh_token(user.id, db)
    return access_token, new_refresh


async def revoke_refresh_token(raw: str, db: AsyncSession) -> None:
    token_hash = _hash_token(raw)
    result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    stored = result.scalar_one_or_none()
    if stored and not stored.revoked:
        stored.revoked = True
        await db.commit()


# ── Email tokens ──────────────────────────────────────────────────────────────

async def create_email_token(user_id: uuid.UUID, token_type: str, db: AsyncSession) -> str:
    raw = secrets.token_urlsafe(32)
    token_hash = _hash_token(raw)
    expires_at = _utcnow() + timedelta(hours=settings.email_token_expire_hours)
    db.add(EmailToken(user_id=user_id, token_hash=token_hash, type=token_type, expires_at=expires_at))
    await db.commit()
    return raw


async def consume_email_token(raw: str, token_type: str, db: AsyncSession) -> User:
    token_hash = _hash_token(raw)
    result = await db.execute(select(EmailToken).where(EmailToken.token_hash == token_hash))
    stored = result.scalar_one_or_none()

    if stored is None or stored.type != token_type:
        raise HTTPException(status_code=400, detail="Invalid token")
    if stored.used_at is not None:
        raise HTTPException(status_code=400, detail="Token already used")
    if _as_utc(stored.expires_at) < _utcnow():
        raise HTTPException(status_code=400, detail="Token expired")

    stored.used_at = _utcnow()

    user = await db.get(User, stored.user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    await db.flush()
    return user


# ── User operations ───────────────────────────────────────────────────────────

async def register_user(email: str, password: str, db: AsyncSession) -> User:
    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(email=email, password_hash=hash_password(password))
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def authenticate_user(email: str, password: str, db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")
    return user


async def change_password(user: User, old_password: str, new_password: str, db: AsyncSession) -> None:
    if not verify_password(old_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    user.password_hash = hash_password(new_password)
    await db.commit()


async def reset_password(raw_token: str, new_password: str, db: AsyncSession) -> None:
    user = await consume_email_token(raw_token, EMAIL_TOKEN_RESET, db)
    user.password_hash = hash_password(new_password)
    await db.commit()


# ── Dependencies ──────────────────────────────────────────────────────────────

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = await db.get(User, uuid.UUID(user_id))
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")
    return user


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != ROLE_ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user
