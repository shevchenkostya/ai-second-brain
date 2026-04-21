from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class Citation(BaseModel):
    chunk_id: str
    document_id: str
    document_title: str
    text: str
    score: float = 0.0


class MessageOut(BaseModel):
    id: str
    chat_id: str
    role: str
    content: str
    citations: list[Citation] = []
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def from_orm_with_citations(cls, msg) -> "MessageOut":
        citations = []
        if msg.citations_json:
            citations = [Citation(**c) for c in msg.citations_json]
        return cls(
            id=str(msg.id),
            chat_id=str(msg.chat_id),
            role=msg.role,
            content=msg.content,
            citations=citations,
            created_at=msg.created_at,
        )


class ChatOut(BaseModel):
    id: str
    workspace_id: str
    title: Optional[str] = None
    created_at: datetime
    messages: list[MessageOut] = []

    model_config = ConfigDict(from_attributes=True)


class ChatCreate(BaseModel):
    title: Optional[str] = None


class SendMessageIn(BaseModel):
    query: str
    language: str = "auto"  # auto | ru | en | uk | de | fr | es | zh
