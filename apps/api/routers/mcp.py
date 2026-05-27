import hashlib
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from models.mcp_token import MCPToken
from models.user import User
from services.auth import get_current_user, ALGORITHM
from services.document import UPLOAD_DIR, get_or_create_default_workspace
from models.document import Document
from services.mcp.google_drive import GoogleDriveClient

router = APIRouter(prefix="/api/mcp", tags=["mcp"])

PROVIDER = "google_drive"

FRONTEND_REDIRECT = "/documents?mcp=connected"


def _make_drive_client() -> GoogleDriveClient:
    return GoogleDriveClient(
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        redirect_uri=settings.google_redirect_uri,
    )


def _encode_state(user_id: uuid.UUID) -> str:
    return jwt.encode({"sub": str(user_id)}, settings.secret_key, algorithm=ALGORITHM)


def _decode_state(state: str) -> uuid.UUID:
    try:
        payload = jwt.decode(state, settings.secret_key, algorithms=[ALGORITHM])
        return uuid.UUID(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid OAuth state")


# ── Status ────────────────────────────────────────────────────────────────────

@router.get("/google/status")
async def google_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(MCPToken).where(MCPToken.user_id == current_user.id, MCPToken.provider == PROVIDER)
    )
    token = result.scalar_one_or_none()
    return {"connected": token is not None}


# ── OAuth flow ────────────────────────────────────────────────────────────────

@router.get("/google/auth")
async def google_auth(current_user: User = Depends(get_current_user)):
    if not settings.google_client_id:
        raise HTTPException(status_code=503, detail="Google Drive integration is not configured")
    client = _make_drive_client()
    state = _encode_state(current_user.id)
    auth_url = await client.get_auth_url(state)
    return {"auth_url": auth_url}


@router.get("/google/callback")
async def google_callback(
    code: str,
    state: str,
    db: AsyncSession = Depends(get_db),
):
    user_id = _decode_state(state)
    client = _make_drive_client()

    try:
        token_data = await client.exchange_code(code)
    except Exception:
        raise HTTPException(status_code=400, detail="Failed to exchange OAuth code")

    expires_at: datetime | None = None
    if "expires_in" in token_data:
        expires_at = datetime.now(timezone.utc).replace(microsecond=0)
        from datetime import timedelta
        expires_at = expires_at + timedelta(seconds=int(token_data["expires_in"]))

    result = await db.execute(
        select(MCPToken).where(MCPToken.user_id == user_id, MCPToken.provider == PROVIDER)
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.access_token = token_data["access_token"]
        existing.refresh_token = token_data.get("refresh_token") or existing.refresh_token
        existing.expires_at = expires_at
    else:
        db.add(MCPToken(
            user_id=user_id,
            provider=PROVIDER,
            access_token=token_data["access_token"],
            refresh_token=token_data.get("refresh_token"),
            expires_at=expires_at,
        ))

    await db.commit()

    # Detect the origin to redirect to the correct frontend
    return RedirectResponse(url=FRONTEND_REDIRECT)


# ── Sources list ──────────────────────────────────────────────────────────────

@router.get("/google/sources")
async def google_sources(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    token = await _require_token(current_user.id, db)
    client = _make_drive_client()
    try:
        sources = await client.list_sources({"access_token": token.access_token})
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Google Drive error: {exc}")
    return {"sources": [s.model_dump() for s in sources]}


# ── Ingest ────────────────────────────────────────────────────────────────────

class IngestRequest(BaseModel):
    file_id: str


@router.post("/google/ingest", status_code=201)
async def google_ingest(
    body: IngestRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    token = await _require_token(current_user.id, db)
    client = _make_drive_client()

    try:
        content = await client.fetch_content({"access_token": token.access_token}, body.file_id)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Google Drive fetch error: {exc}")

    checksum = hashlib.sha256(content.data).hexdigest()
    file_id = uuid.uuid4()
    suffix = Path(content.filename).suffix or ".txt"
    file_path = UPLOAD_DIR / f"{file_id}{suffix}"
    file_path.write_bytes(content.data)

    workspace = await get_or_create_default_workspace(db, current_user.id)
    ext = suffix.lstrip(".").lower()

    document = Document(
        workspace_id=workspace.id,
        title=content.filename,
        source_type=ext if ext else "unknown",
        mime_type=content.mime_type,
        file_path=str(file_path),
        checksum=checksum,
        status="queued",
    )
    db.add(document)
    await db.commit()
    await db.refresh(document)

    await request.app.state.arq_pool.enqueue_job("index_document", str(document.id))

    return {"document_id": str(document.id), "title": document.title, "status": document.status}


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _require_token(user_id: uuid.UUID, db: AsyncSession) -> MCPToken:
    result = await db.execute(
        select(MCPToken).where(MCPToken.user_id == user_id, MCPToken.provider == PROVIDER)
    )
    token = result.scalar_one_or_none()
    if token is None:
        raise HTTPException(status_code=403, detail="Google Drive not connected. Authorize first.")
    return token
