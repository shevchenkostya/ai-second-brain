"""
LLM service: generates answers grounded in retrieved chunks.
Supports mock (no API key needed) and Anthropic Claude.
"""
import logging

from config import settings

logger = logging.getLogger(__name__)


def generate_answer(query: str, citations: list[dict]) -> str:
    if settings.llm_provider == "anthropic" and settings.anthropic_api_key:
        logger.info("Generating answer via Anthropic Claude")
        return _anthropic_answer(query, citations)

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


def _anthropic_answer(query: str, citations: list[dict]) -> str:
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

    system_prompt = (
        "You are an AI assistant embedded in a developer's personal knowledge base. "
        "Answer questions based ONLY on the provided document excerpts. "
        "Use citation numbers like [1], [2] when referencing specific sources. "
        "If the provided context does not contain enough information to answer confidently, "
        "say so explicitly — do not fabricate facts."
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
