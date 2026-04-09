import logging
import uuid

from arq import run_worker
from arq.connections import RedisSettings
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from config import settings
from services.parsing.registry import get_parser
from services.chunking import chunk_text
from services.embedding import embed_texts
from services.indexing import index_chunks, delete_document_vectors, ensure_collection, get_client

logger = logging.getLogger(__name__)


async def _set_status(db: AsyncSession, document_id: str, status: str) -> None:
    await db.execute(
        text("UPDATE documents SET status = :status, updated_at = now() WHERE id = :id"),
        {"status": status, "id": document_id},
    )
    await db.commit()


async def index_document(_ctx: dict, document_id: str) -> dict:
    """
    Full indexing pipeline:
    1. Load document metadata from DB
    2. Parse file → raw text
    3. Chunk text
    4. Generate embeddings
    5. Store chunks in PostgreSQL
    6. Store vectors in Qdrant
    7. Update document status → indexed
    """
    logger.info(f"[{document_id}] Starting indexing pipeline")

    engine = create_async_engine(settings.database_url)
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with Session() as db:
        try:
            # 1. Load document
            result = await db.execute(
                text("SELECT id, title, source_type, file_path FROM documents WHERE id = :id"),
                {"id": document_id},
            )
            row = result.mappings().one_or_none()
            if row is None:
                logger.error(f"[{document_id}] Document not found")
                return {"error": "not_found"}

            source_type = row["source_type"] or "txt"
            file_path = row["file_path"]
            title = row["title"]
            logger.info(f"[{document_id}] Loaded: '{title}' ({source_type})")

            await _set_status(db, document_id, "processing")

            # 2. Parse
            parser = get_parser(source_type)
            if parser is None:
                raise ValueError(f"No parser for source_type '{source_type}'")
            parse_result = parser.parse(file_path)
            logger.info(f"[{document_id}] Parsed {len(parse_result.text)} chars")

            if not parse_result.text.strip():
                raise ValueError("Parsed text is empty")

            # 3. Chunk
            chunks = chunk_text(parse_result.text)
            logger.info(f"[{document_id}] Created {len(chunks)} chunks")

            # 4. Embeddings
            texts = [c.text for c in chunks]
            embeddings = embed_texts(texts)
            logger.info(f"[{document_id}] Generated {len(embeddings)} embeddings")

            # 5. Clear old chunks, insert new ones
            await db.execute(
                text("DELETE FROM document_chunks WHERE document_id = :id"),
                {"id": document_id},
            )

            chunk_ids = []
            for chunk in chunks:
                chunk_id = str(uuid.uuid4())
                chunk_ids.append(chunk_id)
                await db.execute(
                    text("""
                        INSERT INTO document_chunks
                            (id, document_id, chunk_index, text, token_count, metadata_json, vector_ref)
                        VALUES
                            (:id, :document_id, :chunk_index, :text, :token_count, :metadata_json, :vector_ref)
                    """),
                    {
                        "id": chunk_id,
                        "document_id": document_id,
                        "chunk_index": chunk.index,
                        "text": chunk.text,
                        "token_count": chunk.char_count // 4,  # rough estimate
                        "metadata_json": None,
                        "vector_ref": chunk_id,
                    },
                )
            await db.commit()

            # 6. Index in Qdrant
            delete_document_vectors(document_id)
            index_chunks(chunk_ids, texts, embeddings, document_id)

            # 7. Done
            await _set_status(db, document_id, "indexed")
            logger.info(f"[{document_id}] Indexed successfully ({len(chunks)} chunks)")
            return {"status": "indexed", "document_id": document_id, "chunks": len(chunks)}

        except Exception as e:
            logger.exception(f"[{document_id}] Indexing failed: {e}")
            await _set_status(db, document_id, "failed")
            return {"status": "failed", "document_id": document_id, "error": str(e)}

    await engine.dispose()


async def startup(_ctx: dict) -> None:
    logger.info("Worker started — initializing Qdrant collection")
    ensure_collection(get_client())


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
