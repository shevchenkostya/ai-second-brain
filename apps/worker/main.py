import logging

from arq import run_worker
from arq.connections import RedisSettings
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from config import settings

logger = logging.getLogger(__name__)


async def index_document(_ctx: dict, document_id: str) -> dict:
    """
    Sprint 1: меняет статус документа на processing.
    Sprint 2: добавится реальный парсинг и эмбеддинги.
    """
    logger.info(f"Starting indexing for document {document_id}")

    engine = create_async_engine(settings.database_url)
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with Session() as db:
        await db.execute(
            text("UPDATE documents SET status = 'processing', updated_at = now() WHERE id = :id"),
            {"id": document_id},
        )
        await db.commit()

    await engine.dispose()
    logger.info(f"Document {document_id} marked as processing")
    return {"status": "processing", "document_id": document_id}


async def startup(_ctx: dict) -> None:
    logger.info("Worker started")


async def shutdown(_ctx: dict) -> None:
    logger.info("Worker stopped")


class WorkerSettings:
    functions = [index_document]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = RedisSettings.from_dsn(settings.redis_url)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_worker(WorkerSettings)
