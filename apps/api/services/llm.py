"""
LLM service: generates answers grounded in retrieved chunks.
Supports mock (no API key needed), Anthropic Claude, and Ollama (local models).
"""
import logging

from config import settings

logger = logging.getLogger(__name__)


_LANGUAGE_NAMES = {
    "ru": "Russian",
    "en": "English",
    "uk": "Ukrainian",
    "de": "German",
    "fr": "French",
    "es": "Spanish",
    "zh": "Chinese",
}


def _language_instruction(language: str) -> str:
    if language == "auto" or language not in _LANGUAGE_NAMES:
        return ""
    return f"Always respond in {_LANGUAGE_NAMES[language]}."


def generate_answer(query: str, citations: list[dict], language: str = "auto") -> str:
    if settings.llm_provider == "anthropic" and settings.anthropic_api_key:
        logger.info("Generating answer via Anthropic Claude")
        return _anthropic_answer(query, citations, language)

    if settings.llm_provider == "ollama":
        logger.info(f"Generating answer via Ollama ({settings.ollama_model})")
        return _ollama_answer(query, citations, language)

    logger.info("Generating mock answer")
    return _mock_answer(query, citations)


def _mock_answer(query: str, citations: list[dict]) -> str:
    if not citations:
        return (
            "No relevant documents were found in your knowledge base for this query. "
            "Try uploading and indexing some documents first."
        )

    parts = []
    for i, c in enumerate(citations, 1):
        parts.append(f"[{i}] **{c['document_title']}**\n> {c['text']}")

    context = "\n\n".join(parts)
    return (
        f"Based on your documents, here is what I found related to: *\"{query}\"*\n\n"
        f"{context}\n\n"
        f"---\n*{len(citations)} source(s) retrieved. "
        "Connect an Anthropic API key in `.env.local` to get a synthesized answer.*"
    )


def _ollama_answer(query: str, citations: list[dict], language: str = "auto") -> str:
    """Call a local Ollama model via its OpenAI-compatible API."""
    try:
        import httpx
    except ImportError:
        logger.error("httpx not installed")
        return _mock_answer(query, citations)

    if not citations:
        context = "No documents found."
    else:
        context = "\n\n".join(
            f"[{i}] From '{c['document_title']}':\n{c['text']}"
            for i, c in enumerate(citations, 1)
        )

    lang = _language_instruction(language)
    system_prompt = (
        "You are an AI assistant embedded in a developer's personal knowledge base. "
        "Answer questions based ONLY on the provided document excerpts. "
        "Use citation numbers like [1], [2] when referencing specific sources. "
        "If the context does not contain enough information, say so clearly. "
        + lang
    )

    payload = {
        "model": settings.ollama_model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {query}"},
        ],
        "stream": False,
    }

    try:
        response = httpx.post(
            f"{settings.ollama_url}/api/chat",
            json=payload,
            timeout=120.0,
        )
        response.raise_for_status()
        return response.json()["message"]["content"]
    except Exception as exc:
        logger.error(f"Ollama request failed: {exc}")
        return _mock_answer(query, citations)


def _anthropic_answer(query: str, citations: list[dict], language: str = "auto") -> str:
    try:
        import anthropic
    except ImportError:
        logger.error("anthropic package not installed")
        return _mock_answer(query, citations)

    context_parts = [
        f"[{i}] From '{c['document_title']}':\n{c['text']}"
        for i, c in enumerate(citations, 1)
    ]
    context = "\n\n".join(context_parts)

    lang = _language_instruction(language)
    system_prompt = (
        "You are an AI assistant embedded in a developer's personal knowledge base. "
        "Answer questions based ONLY on the provided document excerpts. "
        "Use citation numbers like [1], [2] when referencing specific sources. "
        "If the provided context does not contain enough information to answer confidently, "
        "say so explicitly — do not fabricate facts. "
        + lang
    )

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        system=system_prompt,
        messages=[
            {
                "role": "user",
                "content": f"Context:\n{context}\n\nQuestion: {query}",
            }
        ],
    )
    return response.content[0].text
