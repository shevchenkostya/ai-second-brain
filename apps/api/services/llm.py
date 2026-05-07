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


# ── Analyst agent ─────────────────────────────────────────────────────────────

_ANALYST_SYSTEM_PROMPTS: dict[str, str] = {
    "summarize": (
        "You are an expert technical analyst. "
        "Produce a clear, structured summary of the provided document(s). "
        "Use markdown headers and bullet points. "
        "Cover: main purpose, key concepts, important details, and conclusions. "
        "Base your summary ONLY on the provided content — do not add external knowledge."
    ),
    "compare": (
        "You are an expert technical analyst. "
        "Compare the provided documents thoroughly. "
        "Structure your response with markdown as follows:\n"
        "1. **Overview** — brief description of each document\n"
        "2. **Similarities** — what the documents have in common\n"
        "3. **Differences** — key differences, use a table if helpful\n"
        "4. **Conclusion** — which approach is better and why (if applicable)\n"
        "Base your analysis ONLY on the provided content."
    ),
    "extract_decisions": (
        "You are an expert technical analyst. "
        "Extract all decisions, action items, conclusions, and commitments from the provided document(s). "
        "Format as a numbered list. For each item include:\n"
        "- The decision or action\n"
        "- Who is responsible (if mentioned)\n"
        "- Deadline or context (if mentioned)\n"
        "Base your extraction ONLY on what is explicitly stated in the documents."
    ),
    "find_contradictions": (
        "You are an expert technical analyst. "
        "Identify all contradictions, conflicts, and inconsistencies in the provided document(s). "
        "For each contradiction:\n"
        "- Quote or describe both conflicting statements\n"
        "- Indicate which document each comes from\n"
        "- Suggest how the contradiction might be resolved\n"
        "If no contradictions are found, say so explicitly. "
        "Base your analysis ONLY on the provided content."
    ),
    # ── Architect modes ───────────────────────────────────────────────────────
    "adr": (
        "You are a senior software architect. "
        "Based on the provided document(s), produce an Architecture Decision Record (ADR) in markdown. "
        "Use this exact structure:\n"
        "## Title\n"
        "## Status\n"
        "## Context\n(the problem and forces at play, derived from the documents)\n"
        "## Decision\n(the chosen approach, based on what the documents describe)\n"
        "## Consequences\n(positive and negative outcomes)\n"
        "## Alternatives Considered\n(other options mentioned or implied)\n"
        "Base the ADR ONLY on what is stated in the documents. "
        "If key information is missing, note it explicitly under the relevant section."
    ),
    "tech_radar": (
        "You are a senior software architect performing a technology assessment. "
        "Analyze the technologies, tools, frameworks, and approaches mentioned in the provided document(s). "
        "Produce a Tech Radar report in markdown with these sections:\n"
        "## Adopt\n(technologies proven and recommended for wide use)\n"
        "## Trial\n(technologies worth pursuing with caution)\n"
        "## Assess\n(technologies to explore but not yet committed to)\n"
        "## Hold\n(technologies to avoid or phase out)\n"
        "For each item, provide a one-sentence rationale grounded in the documents. "
        "Base your assessment ONLY on the provided content."
    ),
    "risk_analysis": (
        "You are a senior software architect specializing in risk management. "
        "Identify and analyze all technical, architectural, and operational risks mentioned or implied in the provided document(s). "
        "Structure your report as follows:\n"
        "## Critical Risks\n(immediate threats to system stability or delivery)\n"
        "## High Risks\n(significant issues requiring prompt attention)\n"
        "## Medium Risks\n(notable concerns to monitor)\n"
        "## Low Risks\n(minor issues or technical debt)\n"
        "For each risk:\n"
        "- **Risk**: description\n"
        "- **Impact**: what could go wrong\n"
        "- **Mitigation**: recommended action\n"
        "Base your analysis ONLY on the provided content."
    ),
    "system_design": (
        "You are a senior software architect. "
        "Based on the provided document(s), produce a System Design overview in markdown. "
        "Cover these sections (skip any for which the documents provide no information):\n"
        "## System Overview\n"
        "## Components & Responsibilities\n"
        "## Data Flow\n"
        "## Key Design Decisions\n"
        "## Scalability & Performance Considerations\n"
        "## Security Considerations\n"
        "## Open Questions & Gaps\n"
        "Be precise and concise. "
        "Base your design ONLY on the provided content — do not invent components or requirements."
    ),
    # ── Reviewer modes ────────────────────────────────────────────────────────
    "code_review": (
        "You are an expert code reviewer with deep knowledge of software engineering best practices. "
        "Review the code or technical content in the provided document(s). "
        "Structure your review as follows:\n"
        "## Summary\n(overall assessment in 2-3 sentences)\n"
        "## Critical Issues\n(bugs, security vulnerabilities, data loss risks — must fix)\n"
        "## Improvements\n(performance, readability, maintainability — should fix)\n"
        "## Suggestions\n(style, naming, minor refactors — nice to have)\n"
        "## Positives\n(what is done well)\n"
        "For each issue: describe the problem, explain the impact, and suggest a concrete fix. "
        "Be direct and constructive. Base your review ONLY on the provided content."
    ),
    "doc_review": (
        "You are an expert technical writer and documentation reviewer. "
        "Review the document(s) for quality, clarity, and completeness. "
        "Structure your review as follows:\n"
        "## Overall Assessment\n(quality rating: Excellent / Good / Needs Work / Poor, with 2-3 sentence rationale)\n"
        "## Strengths\n(what is clear, well-structured, or particularly useful)\n"
        "## Issues Found\n(ambiguities, missing information, incorrect statements, poor structure)\n"
        "## Recommendations\n(concrete, actionable improvements)\n"
        "## Audience Fit\n(is the document appropriate for its intended audience?)\n"
        "Be specific — quote or reference the problematic parts directly. "
        "Base your review ONLY on the provided content."
    ),
    "pr_summary": (
        "You are a senior engineer writing a pull request description. "
        "Based on the provided document(s) (which may be code diffs, change logs, or technical notes), "
        "produce a clear PR summary in markdown with this structure:\n"
        "## What changed\n(bullet list of the main changes, grouped by area)\n"
        "## Why\n(motivation, problem being solved, or business reason)\n"
        "## How to test\n(specific steps to verify the changes work correctly)\n"
        "## Notes for reviewers\n(edge cases, known limitations, areas needing extra attention)\n"
        "Keep it concise and useful for a code reviewer. "
        "Base the summary ONLY on the provided content."
    ),
}

_ANALYST_TITLES: dict[str, str] = {
    "summarize": "Summary",
    "compare": "Comparison",
    "extract_decisions": "Decision Extraction",
    "find_contradictions": "Contradiction Analysis",
    "adr": "Architecture Decision Record",
    "tech_radar": "Tech Radar",
    "risk_analysis": "Risk Analysis",
    "system_design": "System Design",
    "code_review": "Code Review",
    "doc_review": "Document Review",
    "pr_summary": "PR Summary",
}


def generate_analysis(
    mode: str,
    documents: list[dict],  # [{"title": str, "content": str}]
    language: str = "auto",
) -> str:
    system_prompt = _ANALYST_SYSTEM_PROMPTS.get(mode, _ANALYST_SYSTEM_PROMPTS["summarize"])
    lang = _language_instruction(language)
    if lang:
        system_prompt += " " + lang

    doc_context = "\n\n".join(
        f"=== Document: {d['title']} ===\n{d['content']}"
        for d in documents
    )
    user_message = f"Please analyze the following document(s):\n\n{doc_context}"

    if settings.llm_provider == "anthropic" and settings.anthropic_api_key:
        logger.info(f"Analyst [{mode}] via Anthropic")
        return _analyst_anthropic(system_prompt, user_message)

    if settings.llm_provider == "ollama":
        logger.info(f"Analyst [{mode}] via Ollama ({settings.ollama_model})")
        return _analyst_ollama(system_prompt, user_message)

    logger.info(f"Analyst [{mode}] via mock")
    return _analyst_mock(mode, documents)


def _analyst_mock(mode: str, documents: list[dict]) -> str:
    doc_titles = ", ".join(d["title"] for d in documents)
    label = _ANALYST_TITLES.get(mode, mode)
    return (
        f"## {label}: {doc_titles}\n\n"
        f"*This is a mock result — connect Ollama or Anthropic to get a real analysis.*\n\n"
        f"**Documents analyzed:** {len(documents)}\n"
        + "\n".join(f"- {d['title']} ({len(d['content'])} chars)" for d in documents)
    )


def _analyst_ollama(system_prompt: str, user_message: str) -> str:
    import httpx
    payload = {
        "model": settings.ollama_model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        "stream": False,
    }
    try:
        response = httpx.post(
            f"{settings.ollama_url}/api/chat",
            json=payload,
            timeout=180.0,
        )
        response.raise_for_status()
        return response.json()["message"]["content"]
    except Exception as exc:
        logger.error(f"Ollama analyst failed: {exc}")
        return f"*Analysis failed: {exc}*"


def _analyst_anthropic(system_prompt: str, user_message: str) -> str:
    try:
        import anthropic
    except ImportError:
        return "*anthropic package not installed*"
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=2048,
        system=system_prompt,
        messages=[{"role": "user", "content": user_message}],
    )
    return response.content[0].text
