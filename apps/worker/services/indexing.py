import logging
import os
import uuid

from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct

logger = logging.getLogger(__name__)

COLLECTION = os.getenv("QDRANT_COLLECTION", "documents")
EMBEDDING_DIM = int(os.getenv("EMBEDDING_DIM", "1536"))


def get_client() -> QdrantClient:
    return QdrantClient(url=os.getenv("QDRANT_URL", "http://qdrant:6333"))


def ensure_collection(client: QdrantClient) -> None:
    existing = {c.name for c in client.get_collections().collections}
    if COLLECTION not in existing:
        client.create_collection(
            collection_name=COLLECTION,
            vectors_config=VectorParams(size=EMBEDDING_DIM, distance=Distance.COSINE),
        )
        logger.info(f"Created Qdrant collection '{COLLECTION}'")


def index_chunks(
    chunk_ids: list[str],
    texts: list[str],
    embeddings: list[list[float]],
    document_id: str,
) -> None:
    client = get_client()
    ensure_collection(client)

    points = [
        PointStruct(
            id=str(uuid.UUID(chunk_id)),
            vector=embedding,
            payload={
                "document_id": document_id,
                "chunk_id": chunk_id,
                "text": text[:500],  # short preview in payload
            },
        )
        for chunk_id, text, embedding in zip(chunk_ids, texts, embeddings)
    ]

    client.upsert(collection_name=COLLECTION, points=points)
    logger.info(f"Indexed {len(points)} vectors for document {document_id}")


def delete_document_vectors(document_id: str) -> None:
    from qdrant_client.models import Filter, FieldCondition, MatchValue
    client = get_client()
    ensure_collection(client)
    client.delete(
        collection_name=COLLECTION,
        points_selector=Filter(
            must=[FieldCondition(key="document_id", match=MatchValue(value=document_id))]
        ),
    )
    logger.info(f"Deleted vectors for document {document_id}")
