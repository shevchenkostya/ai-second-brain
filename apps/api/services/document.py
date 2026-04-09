import hashlib
import uuid
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.document import Document
from models.document_chunk import DocumentChunk
from models.workspace import Workspace

UPLOAD_DIR = Path("/app/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_WORKSPACE_NAME = "default"


async def get_or_create_default_workspace(db: AsyncSession) -> Workspace:
    result = await db.execute(select(Workspace).where(Workspace.name == DEFAULT_WORKSPACE_NAME))
    workspace = result.scalar_one_or_none()
    if workspace is None:
        workspace = Workspace(name=DEFAULT_WORKSPACE_NAME, description="Default workspace")
        db.add(workspace)
        await db.commit()
        await db.refresh(workspace)
    return workspace


async def upload_document(file: UploadFile, db: AsyncSession, arq_pool) -> Document:
    workspace = await get_or_create_default_workspace(db)

    content = await file.read()
    checksum = hashlib.sha256(content).hexdigest()

    file_id = uuid.uuid4()
    suffix = Path(file.filename or "file").suffix
    file_path = UPLOAD_DIR / f"{file_id}{suffix}"
    file_path.write_bytes(content)

    ext = suffix.lstrip(".").lower()
    source_type = ext if ext else "unknown"

    document = Document(
        workspace_id=workspace.id,
        title=file.filename or "Untitled",
        source_type=source_type,
        mime_type=file.content_type,
        file_path=str(file_path),
        checksum=checksum,
        status="queued",
    )
    db.add(document)
    await db.commit()
    await db.refresh(document)

    await arq_pool.enqueue_job("index_document", str(document.id))
    return document


async def reindex_document(document_id: uuid.UUID, db: AsyncSession, arq_pool) -> Document | None:
    result = await db.execute(select(Document).where(Document.id == document_id))
    document = result.scalar_one_or_none()
    if document is None:
        return None

    # Clear existing chunks
    chunks = await db.execute(
        select(DocumentChunk).where(DocumentChunk.document_id == document_id)
    )
    for chunk in chunks.scalars().all():
        await db.delete(chunk)

    document.status = "queued"
    await db.commit()
    await db.refresh(document)

    await arq_pool.enqueue_job("index_document", str(document.id))
    return document


async def list_documents(db: AsyncSession) -> tuple[list[Document], int]:
    result = await db.execute(select(Document).order_by(Document.created_at.desc()))
    documents = list(result.scalars().all())
    count_result = await db.execute(select(func.count()).select_from(Document))
    total = count_result.scalar_one()
    return documents, total


async def get_document(document_id: uuid.UUID, db: AsyncSession) -> Document | None:
    result = await db.execute(select(Document).where(Document.id == document_id))
    return result.scalar_one_or_none()


async def get_document_chunks(document_id: uuid.UUID, db: AsyncSession) -> list[DocumentChunk]:
    result = await db.execute(
        select(DocumentChunk)
        .where(DocumentChunk.document_id == document_id)
        .order_by(DocumentChunk.chunk_index)
    )
    return list(result.scalars().all())


async def delete_document(document_id: uuid.UUID, db: AsyncSession) -> bool:
    document = await get_document(document_id, db)
    if document is None:
        return False
    await db.delete(document)
    await db.commit()
    return True
