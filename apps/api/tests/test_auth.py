import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register_returns_token(client: AsyncClient):
    resp = await client.post(
        "/api/auth/register",
        json={"email": "newuser@example.com", "password": "password123"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient):
    email = "duplicate@example.com"
    await client.post("/api/auth/register", json={"email": email, "password": "pass1"})
    resp = await client.post("/api/auth/register", json={"email": email, "password": "pass2"})
    assert resp.status_code == 400
    assert "already registered" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_login_valid_credentials(client: AsyncClient):
    email = "logintest@example.com"
    await client.post("/api/auth/register", json={"email": email, "password": "mypassword"})
    resp = await client.post("/api/auth/login", json={"email": email, "password": "mypassword"})
    assert resp.status_code == 200
    assert "access_token" in resp.json()


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient):
    email = "wrongpass@example.com"
    await client.post("/api/auth/register", json={"email": email, "password": "correct"})
    resp = await client.post("/api/auth/login", json={"email": email, "password": "wrong"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_login_unknown_email(client: AsyncClient):
    resp = await client.post(
        "/api/auth/login",
        json={"email": "nobody@example.com", "password": "whatever"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_me_returns_current_user(client: AsyncClient):
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 200
    data = resp.json()
    assert "id" in data
    assert data["email"] == "test@example.com"
