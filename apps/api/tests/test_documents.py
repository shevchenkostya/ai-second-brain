import io
import pytest


def make_file(filename: str, content: bytes = b"# Hello\nThis is a test document."):
    return {"file": (filename, io.BytesIO(content), "text/plain")}


@pytest.mark.asyncio
async def test_list_documents_empty(client):
    response = await client.get("/api/documents")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data


@pytest.mark.asyncio
async def test_upload_markdown_document(client):
    response = await client.post("/api/documents/upload", files=make_file("readme.md"))
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "readme.md"
    assert data["source_type"] == "md"
    assert data["status"] == "uploaded"
    assert "id" in data
    assert "workspace_id" in data


@pytest.mark.asyncio
async def test_upload_txt_document(client):
    response = await client.post("/api/documents/upload", files=make_file("notes.txt"))
    assert response.status_code == 201
    assert response.json()["source_type"] == "txt"


@pytest.mark.asyncio
async def test_upload_unsupported_type_returns_400(client):
    response = await client.post("/api/documents/upload", files=make_file("script.py"))
    assert response.status_code == 400
    assert "Unsupported file type" in response.json()["detail"]


@pytest.mark.asyncio
async def test_uploaded_document_appears_in_list(client):
    await client.post("/api/documents/upload", files=make_file("arch.md"))
    response = await client.get("/api/documents")
    assert response.status_code == 200
    titles = [d["title"] for d in response.json()["items"]]
    assert "arch.md" in titles


@pytest.mark.asyncio
async def test_get_document_by_id(client):
    upload = await client.post("/api/documents/upload", files=make_file("spec.md"))
    doc_id = upload.json()["id"]

    response = await client.get(f"/api/documents/{doc_id}")
    assert response.status_code == 200
    assert response.json()["id"] == doc_id


@pytest.mark.asyncio
async def test_get_nonexistent_document_returns_404(client):
    fake_id = "00000000-0000-0000-0000-000000000000"
    response = await client.get(f"/api/documents/{fake_id}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_document(client):
    upload = await client.post("/api/documents/upload", files=make_file("to_delete.md"))
    doc_id = upload.json()["id"]

    delete_response = await client.delete(f"/api/documents/{doc_id}")
    assert delete_response.status_code == 204

    get_response = await client.get(f"/api/documents/{doc_id}")
    assert get_response.status_code == 404


@pytest.mark.asyncio
async def test_delete_nonexistent_document_returns_404(client):
    fake_id = "00000000-0000-0000-0000-000000000000"
    response = await client.delete(f"/api/documents/{fake_id}")
    assert response.status_code == 404
