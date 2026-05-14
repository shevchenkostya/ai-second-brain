import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.chat import Chat, Message
from services.document import get_or_create_default_workspace
from services.retrieval import retrieve_chunks
from services.llm import generate_answer


async def create_chat(db: AsyncSession, title: str | None = None, user_id: uuid.UUID | None = None) -> Chat:
    workspace = await get_or_create_default_workspace(db, user_id)
    chat = Chat(workspace_id=workspace.id, title=title)
    db.add(chat)
    await db.commit()
    await db.refresh(chat)
    return chat


async def list_chats(db: AsyncSession, user_id: uuid.UUID | None = None) -> list[Chat]:
    from services.document import get_or_create_default_workspace
    workspace = await get_or_create_default_workspace(db, user_id)
    result = await db.execute(
        select(Chat).where(Chat.workspace_id == workspace.id).order_by(Chat.created_at.desc())
    )
    return list(result.scalars().all())


async def get_chat(chat_id: uuid.UUID, db: AsyncSession) -> Chat | None:
    result = await db.execute(select(Chat).where(Chat.id == chat_id))
    return result.scalar_one_or_none()


async def get_chat_messages(chat_id: uuid.UUID, db: AsyncSession) -> list[Message]:
    result = await db.execute(
        select(Message)
        .where(Message.chat_id == chat_id)
        .order_by(Message.created_at.asc())
    )
    return list(result.scalars().all())


async def delete_chat(chat_id: uuid.UUID, db: AsyncSession) -> bool:
    chat = await get_chat(chat_id, db)
    if chat is None:
        return False
    await db.delete(chat)
    await db.commit()
    return True


async def send_message(
    chat_id: uuid.UUID,
    query: str,
    db: AsyncSession,
    language: str = "auto",
) -> Message:
    # 1. Save user message
    user_msg = Message(chat_id=chat_id, role="user", content=query)
    db.add(user_msg)
    await db.commit()

    # 2. Retrieve relevant chunks from Qdrant
    citations = await retrieve_chunks(query=query, db=db)

    # 3. Generate grounded answer
    answer = generate_answer(query=query, citations=citations, language=language)

    # 4. Save assistant message with citations
    assistant_msg = Message(
        chat_id=chat_id,
        role="assistant",
        content=answer,
        citations_json=citations,
    )
    db.add(assistant_msg)
    await db.commit()
    await db.refresh(assistant_msg)

    return assistant_msg
