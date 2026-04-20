"""
Query embedding for retrieval.
Uses the same mock/openai provider logic as the worker,
so retrieval vectors are compatible with indexed vectors.
"""
import hashlib
import struct

from config import settings

EMBEDDING_DIM = settings.embedding_dim


def embed_query(text: str) -> list[float]:
    if settings.embedding_provider == "openai" and settings.openai_api_key:
        return _openai_embed(text)
    return _mock_embed(text)


def _mock_embed(text: str) -> list[float]:
    digest = hashlib.sha256(text.encode()).digest()
    repeated = (digest * ((EMBEDDING_DIM * 4 // len(digest)) + 1))[: EMBEDDING_DIM * 4]
    raw = list(struct.unpack(f"{EMBEDDING_DIM}f", repeated))
    norm = sum(x ** 2 for x in raw) ** 0.5 or 1.0
    return [x / norm for x in raw]


def _openai_embed(text: str) -> list[float]:
    from openai import OpenAI
    client = OpenAI(api_key=settings.openai_api_key)
    response = client.embeddings.create(model="text-embedding-3-small", input=[text])
    return response.data[0].embedding
