import asyncio
import logging

from arq import run_worker
from arq.connections import RedisSettings

from config import settings

logger = logging.getLogger(__name__)


async def index_document(ctx: dict, document_id: str) -> dict:
    """Placeholder for document indexing task (Sprint 2)."""
    logger.info(f"Received indexing task for document {document_id}")
    return {"status": "queued", "document_id": document_id}


async def startup(ctx: dict) -> None:
    logger.info("Worker started")


async def shutdown(ctx: dict) -> None:
    logger.info("Worker stopped")


class WorkerSettings:
    functions = [index_document]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = RedisSettings.from_dsn(settings.redis_url)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_worker(WorkerSettings)
