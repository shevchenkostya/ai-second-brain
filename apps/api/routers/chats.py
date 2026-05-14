import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.user import User
from schemas.chat import ChatOut, ChatCreate, MessageOut, SendMessageIn
from services.auth import get_current_user
from services import chat as chat_service

router = APIRouter(prefix="/api/chats", tags=["chats"])


@router.get("", response_model=list[ChatOut])
async def list_chats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    chats = await chat_service.list_chats(db, user_id=current_user.id)
    return [
        ChatOut(
            id=str(c.id),
            workspace_id=str(c.workspace_id),
            title=c.title,
            created_at=c.created_at,
        )
        for c in chats
    ]


@router.post("", response_model=ChatOut, status_code=status.HTTP_201_CREATED)
async def create_chat(
    body: ChatCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    chat = await chat_service.create_chat(db, title=body.title, user_id=current_user.id)
    return ChatOut(
        id=str(chat.id),
        workspace_id=str(chat.workspace_id),
        title=chat.title,
        created_at=chat.created_at,
    )


@router.get("/{chat_id}", response_model=ChatOut)
async def get_chat(
    chat_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    chat = await chat_service.get_chat(chat_id, db)
    if chat is None:
        raise HTTPException(status_code=404, detail="Chat not found")
    messages = await chat_service.get_chat_messages(chat_id, db)
    return ChatOut(
        id=str(chat.id),
        workspace_id=str(chat.workspace_id),
        title=chat.title,
        created_at=chat.created_at,
        messages=[MessageOut.from_orm_with_citations(m) for m in messages],
    )


@router.delete("/{chat_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chat(
    chat_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deleted = await chat_service.delete_chat(chat_id, db)
    if not deleted:
        raise HTTPException(status_code=404, detail="Chat not found")


@router.post("/{chat_id}/messages", response_model=MessageOut)
async def send_message(
    chat_id: uuid.UUID,
    body: SendMessageIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    chat = await chat_service.get_chat(chat_id, db)
    if chat is None:
        raise HTTPException(status_code=404, detail="Chat not found")
    if not body.query.strip():
        raise HTTPException(status_code=422, detail="Query cannot be empty")

    assistant_msg = await chat_service.send_message(
        chat_id=chat_id, query=body.query, db=db, language=body.language
    )
    return MessageOut.from_orm_with_citations(assistant_msg)
