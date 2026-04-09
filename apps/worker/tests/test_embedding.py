import os
import pytest

# Force mock provider so tests never hit the OpenAI API
os.environ.setdefault("EMBEDDING_PROVIDER", "mock")

from services.embedding import embed_texts, _mock_embedding, EMBEDDING_DIM


def test_embed_texts_returns_correct_count():
    texts = ["hello", "world", "foo bar"]
    result = embed_texts(texts)
    assert len(result) == len(texts)


def test_embedding_has_correct_dimension():
    embedding = _mock_embedding("test text")
    assert len(embedding) == EMBEDDING_DIM


def test_embedding_is_unit_vector():
    embedding = _mock_embedding("some text here")
    norm = sum(x ** 2 for x in embedding) ** 0.5
    assert abs(norm - 1.0) < 1e-5


def test_same_text_produces_same_embedding():
    text = "deterministic input"
    e1 = _mock_embedding(text)
    e2 = _mock_embedding(text)
    assert e1 == e2


def test_different_texts_produce_different_embeddings():
    e1 = _mock_embedding("apple")
    e2 = _mock_embedding("orange")
    assert e1 != e2


def test_embed_texts_empty_list():
    result = embed_texts([])
    assert result == []


def test_all_embeddings_are_floats():
    embeddings = embed_texts(["hello world"])
    assert all(isinstance(v, float) for v in embeddings[0])
