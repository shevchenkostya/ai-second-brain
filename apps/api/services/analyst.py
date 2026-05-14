import uuid
import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.artifact import Artifact
from models.document import Document
from models.document_chunk import DocumentChunk
from services.document import get_or_create_default_workspace
from services.llm import generate_analysis, _ANALYST_TITLES

logger = logging.getLogger(__name__)

# Max chars of document content sent to LLM to stay within context limits
_MAX_CHARS_PER_DOC = 12_000
_MAX_CHUNKS_PER_DOC = 25


async def _load_document_content(document_id: uuid.UUID, db: AsyncSession) -> dict | None:
    doc = await db.get(Document, document_id)
    if doc is None:
        return None

    result = await db.execute(
        select(DocumentChunk)
        .where(DocumentChunk.document_id == document_id)
        .order_by(DocumentChunk.chunk_index)
        .limit(_MAX_CHUNKS_PER_DOC)
    )
    chunks = result.scalars().all()

    if not chunks:
        return {"title": doc.title, "content": f"[No indexed content for {doc.title}]"}

    content = "\n\n".join(c.text for c in chunks)
    if len(content) > _MAX_CHARS_PER_DOC:
        content = content[:_MAX_CHARS_PER_DOC] + "\n\n[... content truncated ...]"

    return {"title": doc.title, "content": content}


async def run_analysis(
    mode: str,
    document_ids: list[str],
    db: AsyncSession,
    language: str = "auto",
    custom_title: str | None = None,
    user_id: uuid.UUID | None = None,
) -> Artifact:
    workspace = await get_or_create_default_workspace(db, user_id)

    documents = []
    valid_doc_ids = []
    for doc_id_str in document_ids:
        try:
            doc_id = uuid.UUID(doc_id_str)
        except ValueError:
            continue
        doc_content = await _load_document_content(doc_id, db)
        if doc_content:
            documents.append(doc_content)
            valid_doc_ids.append(doc_id_str)

    if not documents:
        raise ValueError("No valid indexed documents found for the given IDs")

    logger.info(f"Running [{mode}] on {len(documents)} document(s)")
    content = generate_analysis(mode=mode, documents=documents, language=language)

    mode_label = _ANALYST_TITLES.get(mode, mode.replace("_", " ").title())
    if custom_title:
        title = custom_title
    elif len(documents) == 1:
        title = f"{mode_label}: {documents[0]['title']}"
    else:
        titles = ", ".join(d["title"] for d in documents[:2])
        suffix = f" +{len(documents) - 2} more" if len(documents) > 2 else ""
        title = f"{mode_label}: {titles}{suffix}"

    artifact = Artifact(
        workspace_id=workspace.id,
        artifact_type=mode,
        title=title,
        content=content,
        source_refs_json=valid_doc_ids,
    )
    db.add(artifact)
    await db.commit()
    await db.refresh(artifact)
    return artifact


async def list_artifacts(db: AsyncSession, user_id: uuid.UUID | None = None) -> list[Artifact]:
    workspace = await get_or_create_default_workspace(db, user_id)
    result = await db.execute(
        select(Artifact)
        .where(Artifact.workspace_id == workspace.id)
        .order_by(Artifact.created_at.desc())
    )
    return list(result.scalars().all())


async def get_artifact(artifact_id: uuid.UUID, db: AsyncSession) -> Artifact | None:
    return await db.get(Artifact, artifact_id)


async def delete_artifact(artifact_id: uuid.UUID, db: AsyncSession) -> bool:
    artifact = await get_artifact(artifact_id, db)
    if artifact is None:
        return False
    await db.delete(artifact)
    await db.commit()
    return True
