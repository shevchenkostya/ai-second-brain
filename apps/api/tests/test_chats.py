import pytest
from unittest.mock import AsyncMock, patch


# ── helpers ──────────────────────────────────────────────────────────────────

async def create_chat(client, title: str | None = None):
    body = {"title": title} if title else {}
    return await client.post("/api/chats", json=body)


# ── chat CRUD ─────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_chats_empty(client):
    response = await client.get("/api/chats")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_create_chat_no_title(client):
    response = await create_chat(client)
    assert response.status_code == 201
    data = response.json()
    assert "id" in data
    assert "workspace_id" in data
    assert data["title"] is None
    assert "created_at" in data


@pytest.mark.asyncio
async def test_create_chat_with_title(client):
    response = await create_chat(client, title="Architecture review")
    assert response.status_code == 201
    assert response.json()["title"] == "Architecture review"


@pytest.mark.asyncio
async def test_created_chat_appears_in_list(client):
    await create_chat(client, title="My chat")
    response = await client.get("/api/chats")
    assert response.status_code == 200
    titles = [c["title"] for c in response.json()]
    assert "My chat" in titles


@pytest.mark.asyncio
async def test_get_chat_by_id(client):
    created = (await create_chat(client, title="Sprint planning")).json()
    chat_id = created["id"]

    response = await client.get(f"/api/chats/{chat_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == chat_id
    assert data["title"] == "Sprint planning"
    assert data["messages"] == []


@pytest.mark.asyncio
async def test_get_nonexistent_chat_returns_404(client):
    response = await client.get("/api/chats/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_chat(client):
    chat_id = (await create_chat(client)).json()["id"]

    delete_resp = await client.delete(f"/api/chats/{chat_id}")
    assert delete_resp.status_code == 204

    get_resp = await client.get(f"/api/chats/{chat_id}")
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_nonexistent_chat_returns_404(client):
    response = await client.delete("/api/chats/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404


# ── send message ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_send_message_returns_assistant_response(client):
    chat_id = (await create_chat(client)).json()["id"]

    # Mock Qdrant so tests don't need a running vector store
    with patch("services.chat.retrieve_chunks", new=AsyncMock(return_value=[])):
        response = await client.post(
            f"/api/chats/{chat_id}/messages",
            json={"query": "What is RAG?"},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["role"] == "assistant"
    assert len(data["content"]) > 0
    assert "chat_id" in data
    assert data["chat_id"] == chat_id


@pytest.mark.asyncio
async def test_send_message_persists_in_history(client):
    chat_id = (await create_chat(client)).json()["id"]

    with patch("services.chat.retrieve_chunks", new=AsyncMock(return_value=[])):
        await client.post(
            f"/api/chats/{chat_id}/messages",
            json={"query": "Hello"},
        )

    response = await client.get(f"/api/chats/{chat_id}")
    messages = response.json()["messages"]
    # user + assistant = 2 messages
    assert len(messages) == 2
    assert messages[0]["role"] == "user"
    assert messages[0]["content"] == "Hello"
    assert messages[1]["role"] == "assistant"


@pytest.mark.asyncio
async def test_send_message_with_citations(client):
    chat_id = (await create_chat(client)).json()["id"]

    fake_citations = [
        {
            "chunk_id": "chunk-1",
            "document_id": "doc-1",
            "document_title": "Architecture Guide",
            "text": "RAG stands for Retrieval Augmented Generation.",
            "score": 0.95,
        }
    ]

    with patch("services.chat.retrieve_chunks", new=AsyncMock(return_value=fake_citations)):
        response = await client.post(
            f"/api/chats/{chat_id}/messages",
            json={"query": "What is RAG?"},
        )

    data = response.json()
    assert data["role"] == "assistant"
    assert len(data["citations"]) == 1
    assert data["citations"][0]["document_title"] == "Architecture Guide"
    assert "RAG" in data["citations"][0]["text"]


@pytest.mark.asyncio
async def test_send_message_to_nonexistent_chat(client):
    with patch("services.chat.retrieve_chunks", new=AsyncMock(return_value=[])):
        response = await client.post(
            "/api/chats/00000000-0000-0000-0000-000000000000/messages",
            json={"query": "Hello"},
        )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_send_empty_query_returns_422(client):
    chat_id = (await create_chat(client)).json()["id"]
    response = await client.post(
        f"/api/chats/{chat_id}/messages",
        json={"query": "   "},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_multiple_messages_ordered_chronologically(client):
    chat_id = (await create_chat(client)).json()["id"]

    with patch("services.chat.retrieve_chunks", new=AsyncMock(return_value=[])):
        await client.post(f"/api/chats/{chat_id}/messages", json={"query": "First"})
        await client.post(f"/api/chats/{chat_id}/messages", json={"query": "Second"})

    messages = (await client.get(f"/api/chats/{chat_id}")).json()["messages"]
    user_messages = [m for m in messages if m["role"] == "user"]
    assert user_messages[0]["content"] == "First"
    assert user_messages[1]["content"] == "Second"
