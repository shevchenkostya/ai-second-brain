"""
Retrieval service: embed query → search Qdrant → return citations.
"""
import logging
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from models.document import Document
from services.embedding import embed_query

logger = logging.getLogger(__name__)


async def retrieve_chunks(
    query: str,
    db: AsyncSession,
    top_k: int = 5,
) -> list[dict]:
    """
    Embed query, search Qdrant for nearest chunks, fetch document titles from DB.
    Returns a list of citation dicts: chunk_id, document_id, document_title, text, score.
    """
    vector = embed_query(query)

    try:
        from qdrant_client import QdrantClient
        client = QdrantClient(url=settings.qdrant_url)
        results = client.query_points(
            collection_name=settings.qdrant_collection,
            query=vector,
            limit=top_k,
            with_payload=True,
        )
        points = results.points
    except Exception as exc:
        logger.warning(f"Qdrant search failed: {exc}")
        return []

    if not points:
        return []

    # Collect unique document IDs to fetch titles in bulk
    doc_ids = list({p.payload.get("document_id") for p in points if p.payload.get("document_id")})
    titles: dict[str, str] = {}
    for doc_id in doc_ids:
        try:
            doc = await db.get(Document, uuid.UUID(doc_id))
            if doc:
                titles[doc_id] = doc.title
        except Exception:
            pass

    citations = []
    for point in points:
        doc_id = point.payload.get("document_id", "")
        chunk_id = point.payload.get("chunk_id", str(point.id))
        text = point.payload.get("text", "")
        citations.append({
            "chunk_id": chunk_id,
            "document_id": doc_id,
            "document_title": titles.get(doc_id, "Unknown"),
            "text": text,
            "score": round(float(point.score), 4),
        })

    return citations
