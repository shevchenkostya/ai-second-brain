import hashlib
import logging
import os

logger = logging.getLogger(__name__)

EMBEDDING_DIM = int(os.getenv("EMBEDDING_DIM", "1536"))


def _mock_embedding(text: str) -> list[float]:
    """Deterministic unit vector based on text hash. No API key needed."""
    import random
    seed = int(hashlib.sha256(text.encode()).hexdigest(), 16) % (2**32)
    rng = random.Random(seed)
    raw = [rng.gauss(0, 1) for _ in range(EMBEDDING_DIM)]
    norm = sum(x ** 2 for x in raw) ** 0.5 or 1.0
    return [x / norm for x in raw]


def _openai_embeddings(texts: list[str]) -> list[list[float]]:
    from openai import OpenAI
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=texts,
    )
    return [item.embedding for item in response.data]


def embed_texts(texts: list[str]) -> list[list[float]]:
    provider = os.getenv("EMBEDDING_PROVIDER", "mock")

    if provider == "openai" and os.getenv("OPENAI_API_KEY"):
        logger.info(f"Generating {len(texts)} embeddings via OpenAI")
        return _openai_embeddings(texts)

    logger.info(f"Generating {len(texts)} mock embeddings")
    return [_mock_embedding(t) for t in texts]
