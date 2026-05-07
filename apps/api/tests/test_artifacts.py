import uuid
import pytest
from unittest.mock import AsyncMock, patch


# ── helpers ──────────────────────────────────────────────────────────────────

def _fake_doc_content(title="Doc A"):
    return {"title": title, "content": "Some content about " + title}


def _make_analyze_body(doc_ids=None, mode="summarize"):
    return {
        "mode": mode,
        "document_ids": doc_ids or [str(uuid.uuid4())],
        "language": "auto",
    }


# ── POST /api/artifacts/analyze ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_analyze_returns_artifact(client):
    with patch("services.analyst._load_document_content", new=AsyncMock(return_value=_fake_doc_content())), \
         patch("services.analyst.generate_analysis", return_value="# Summary\nThis is a summary."):
        response = await client.post("/api/artifacts/analyze", json=_make_analyze_body())

    assert response.status_code == 201
    data = response.json()
    assert "id" in data
    assert data["artifact_type"] == "summarize"
    assert "Summary" in data["title"]
    assert data["content"] == "# Summary\nThis is a summary."
    assert isinstance(data["source_refs"], list)
    assert "created_at" in data


@pytest.mark.asyncio
async def test_analyze_compare_mode(client):
    doc_ids = [str(uuid.uuid4()), str(uuid.uuid4())]
    with patch("services.analyst._load_document_content", new=AsyncMock(side_effect=[
             _fake_doc_content("Doc A"), _fake_doc_content("Doc B"),
         ])), \
         patch("services.analyst.generate_analysis", return_value="## Comparison result"):
        response = await client.post(
            "/api/artifacts/analyze",
            json={"mode": "compare", "document_ids": doc_ids, "language": "auto"},
        )

    assert response.status_code == 201
    data = response.json()
    assert data["artifact_type"] == "compare"
    assert data["content"] == "## Comparison result"
    assert len(data["source_refs"]) == 2


@pytest.mark.asyncio
async def test_analyze_custom_title(client):
    with patch("services.analyst._load_document_content", new=AsyncMock(return_value=_fake_doc_content())), \
         patch("services.analyst.generate_analysis", return_value="content"):
        response = await client.post(
            "/api/artifacts/analyze",
            json={**_make_analyze_body(), "title": "My custom title"},
        )

    assert response.status_code == 201
    assert response.json()["title"] == "My custom title"


@pytest.mark.asyncio
async def test_analyze_invalid_doc_ids_returns_422(client):
    with patch("services.analyst._load_document_content", new=AsyncMock(return_value=None)):
        response = await client.post(
            "/api/artifacts/analyze",
            json=_make_analyze_body(doc_ids=[str(uuid.uuid4())]),
        )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_analyze_invalid_mode_returns_422(client):
    response = await client.post(
        "/api/artifacts/analyze",
        json={"mode": "nonexistent_mode", "document_ids": [str(uuid.uuid4())]},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_analyze_malformed_doc_id_skipped(client):
    real_id = str(uuid.uuid4())
    with patch("services.analyst._load_document_content", new=AsyncMock(return_value=_fake_doc_content())), \
         patch("services.analyst.generate_analysis", return_value="ok"):
        response = await client.post(
            "/api/artifacts/analyze",
            json={"mode": "summarize", "document_ids": ["not-a-uuid", real_id], "language": "auto"},
        )

    assert response.status_code == 201
    assert response.json()["source_refs"] == [real_id]


# ── GET /api/artifacts ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_artifacts_returns_list(client):
    response = await client.get("/api/artifacts")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_list_artifacts_grows_after_create(client):
    before = len((await client.get("/api/artifacts")).json())

    with patch("services.analyst._load_document_content", new=AsyncMock(return_value=_fake_doc_content())), \
         patch("services.analyst.generate_analysis", return_value="new content"):
        await client.post("/api/artifacts/analyze", json=_make_analyze_body())

    after = len((await client.get("/api/artifacts")).json())
    assert after == before + 1


# ── GET /api/artifacts/{id} ───────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_artifact_by_id(client):
    with patch("services.analyst._load_document_content", new=AsyncMock(return_value=_fake_doc_content())), \
         patch("services.analyst.generate_analysis", return_value="detailed content"):
        created = (await client.post("/api/artifacts/analyze", json=_make_analyze_body())).json()

    response = await client.get(f"/api/artifacts/{created['id']}")
    assert response.status_code == 200
    assert response.json()["id"] == created["id"]
    assert response.json()["content"] == "detailed content"


@pytest.mark.asyncio
async def test_get_artifact_not_found(client):
    response = await client.get(f"/api/artifacts/{uuid.uuid4()}")
    assert response.status_code == 404


# ── DELETE /api/artifacts/{id} ────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_delete_artifact(client):
    with patch("services.analyst._load_document_content", new=AsyncMock(return_value=_fake_doc_content())), \
         patch("services.analyst.generate_analysis", return_value="x"):
        created = (await client.post("/api/artifacts/analyze", json=_make_analyze_body())).json()

    del_response = await client.delete(f"/api/artifacts/{created['id']}")
    assert del_response.status_code == 204

    get_response = await client.get(f"/api/artifacts/{created['id']}")
    assert get_response.status_code == 404


@pytest.mark.asyncio
async def test_delete_artifact_not_found(client):
    response = await client.delete(f"/api/artifacts/{uuid.uuid4()}")
    assert response.status_code == 404


# ── Architect modes ───────────────────────────────────────────────────────────

@pytest.mark.asyncio
@pytest.mark.parametrize("mode,expected_title_fragment", [
    ("adr", "Architecture Decision Record"),
    ("tech_radar", "Tech Radar"),
    ("risk_analysis", "Risk Analysis"),
    ("system_design", "System Design"),
])
async def test_architect_modes_return_artifact(client, mode, expected_title_fragment):
    with patch("services.analyst._load_document_content", new=AsyncMock(return_value=_fake_doc_content())), \
         patch("services.analyst.generate_analysis", return_value=f"## {expected_title_fragment}\nContent here."):
        response = await client.post("/api/artifacts/analyze", json=_make_analyze_body(mode=mode))

    assert response.status_code == 201
    data = response.json()
    assert data["artifact_type"] == mode
    assert expected_title_fragment in data["title"]
    assert data["content"] == f"## {expected_title_fragment}\nContent here."


@pytest.mark.asyncio
async def test_adr_title_auto_generated(client):
    with patch("services.analyst._load_document_content", new=AsyncMock(return_value=_fake_doc_content("Design Doc"))), \
         patch("services.analyst.generate_analysis", return_value="## ADR\n..."):
        response = await client.post("/api/artifacts/analyze", json=_make_analyze_body(mode="adr"))

    assert response.status_code == 201
    title = response.json()["title"]
    assert "Architecture Decision Record" in title
    assert "Design Doc" in title
