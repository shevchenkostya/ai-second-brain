import uuid
from datetime import datetime
from pydantic import BaseModel


class DocumentOut(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    title: str
    source_type: str | None
    mime_type: str | None
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DocumentListOut(BaseModel):
    items: list[DocumentOut]
    total: int
