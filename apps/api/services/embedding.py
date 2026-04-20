"""
Query embedding for retrieval.
Uses the same mock/openai provider logic as the worker,
so retrieval vectors are compatible with indexed vectors.
"""
import hashlib

from config import settings

EMBEDDING_DIM = settings.embedding_dim


def embed_query(text: str) -> list[float]:
    if settings.embedding_provider == "openai" and settings.openai_api_key:
        return _openai_embed(text)
    return _mock_embed(text)


def _mock_embed(text: str) -> list[float]:
    import random
    seed = int(hashlib.sha256(text.encode()).hexdigest(), 16) % (2**32)
    rng = random.Random(seed)
    raw = [rng.gauss(0, 1) for _ in range(EMBEDDING_DIM)]
    norm = sum(x ** 2 for x in raw) ** 0.5 or 1.0
    return [x / norm for x in raw]


def _openai_embed(text: str) -> list[float]:
    from openai import OpenAI
    client = OpenAI(api_key=settings.openai_api_key)
    response = client.embeddings.create(model="text-embedding-3-small", input=[text])
    return response.data[0].embedding
