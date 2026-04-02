import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from schemas.document import DocumentOut, DocumentListOut
from services.document import upload_document, list_documents, get_document, delete_document

router = APIRouter(prefix="/api/documents", tags=["documents"])

ALLOWED_EXTENSIONS = {"md", "txt", "pdf", "docx", "json", "yaml", "html"}


@router.post("/upload", response_model=DocumentOut, status_code=201)
async def upload(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: .{ext}")
    document = await upload_document(file, db)
    return document


@router.get("", response_model=DocumentListOut)
async def list_docs(db: AsyncSession = Depends(get_db)):
    documents, total = await list_documents(db)
    return DocumentListOut(items=documents, total=total)


@router.get("/{document_id}", response_model=DocumentOut)
async def get_doc(document_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    document = await get_document(document_id, db)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


@router.delete("/{document_id}", status_code=204)
async def delete_doc(document_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    deleted = await delete_document(document_id, db)
    if not deleted:
        raise HTTPException(status_code=404, detail="Document not found")
