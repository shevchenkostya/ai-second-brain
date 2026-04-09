from contextlib import asynccontextmanager

from alembic import command
from alembic.config import Config
from arq import create_pool
from arq.connections import RedisSettings
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routers import health, documents


def run_migrations() -> None:
    alembic_cfg = Config("alembic.ini")
    command.upgrade(alembic_cfg, "head")


@asynccontextmanager
async def lifespan(app: FastAPI):
    run_migrations()
    app.state.arq_pool = await create_pool(RedisSettings.from_dsn(settings.redis_url))
    yield
    await app.state.arq_pool.aclose()


app = FastAPI(title="AI Second Brain API", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, tags=["health"])
app.include_router(documents.router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.api_host, port=settings.api_port, reload=settings.debug)
