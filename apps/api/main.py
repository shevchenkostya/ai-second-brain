from contextlib import asynccontextmanager

from alembic import command
from alembic.config import Config
from arq import create_pool
from arq.connections import RedisSettings
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routers import health, documents, chats, artifacts, auth, mcp, admin
from services.mcp.registry import registry
from services.mcp.google_drive import GoogleDriveClient


def run_migrations() -> None:
    alembic_cfg = Config("alembic.ini")
    command.upgrade(alembic_cfg, "head")


async def _bootstrap_admin() -> None:
    """Create first admin user on startup if none exist and env vars are set."""
    if not settings.first_admin_email or not settings.first_admin_password:
        return

    from sqlalchemy import select
    from database import AsyncSessionLocal
    from models.user import User, ROLE_ADMIN
    from services.auth import hash_password

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.role == ROLE_ADMIN).limit(1))
        if result.scalar_one_or_none() is not None:
            return

        existing = await db.execute(select(User).where(User.email == settings.first_admin_email))
        user = existing.scalar_one_or_none()
        if user:
            user.role = ROLE_ADMIN
        else:
            user = User(
                email=settings.first_admin_email,
                password_hash=hash_password(settings.first_admin_password),
                role=ROLE_ADMIN,
                email_verified=True,
            )
            db.add(user)
        await db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    run_migrations()
    await _bootstrap_admin()
    app.state.arq_pool = await create_pool(RedisSettings.from_dsn(settings.redis_url))
    if settings.google_client_id:
        registry.register(
            "google_drive",
            GoogleDriveClient(
                client_id=settings.google_client_id,
                client_secret=settings.google_client_secret,
                redirect_uri=settings.google_redirect_uri,
            ),
        )
    yield
    await app.state.arq_pool.aclose()


app = FastAPI(title="AI Second Brain API", version="0.3.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, tags=["health"])
app.include_router(documents.router)
app.include_router(auth.router)
app.include_router(chats.router)
app.include_router(artifacts.router)
app.include_router(mcp.router)
app.include_router(admin.router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.api_host, port=settings.api_port, reload=settings.debug)
