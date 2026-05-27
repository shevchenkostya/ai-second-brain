import pytest
from httpx import AsyncClient
from main import app


async def _make_admin(client: AsyncClient) -> tuple[str, str]:
    """Register a user and promote them to admin. Returns (email, token)."""
    email = "admintest@example.com"
    resp = await client.post("/api/auth/register", json={"email": email, "password": "adminpass123"})
    assert resp.status_code in (201, 400)  # 400 = already exists from prior test in session

    from database import get_db
    from sqlalchemy import select
    from models.user import User, ROLE_ADMIN

    async for db in app.dependency_overrides[get_db]():
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one()
        user.role = ROLE_ADMIN
        await db.commit()

    login = await client.post("/api/auth/login", json={"email": email, "password": "adminpass123"})
    token = login.json()["access_token"]
    return email, token


@pytest.mark.asyncio
async def test_non_admin_cannot_access_users(client: AsyncClient):
    resp = await client.get("/api/admin/users")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_admin_can_list_users(client: AsyncClient):
    _, token = await _make_admin(client)
    resp = await client.get("/api/admin/users", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data
    assert data["total"] > 0


@pytest.mark.asyncio
async def test_admin_can_get_user_by_id(client: AsyncClient):
    _, token = await _make_admin(client)
    users_resp = await client.get("/api/admin/users", headers={"Authorization": f"Bearer {token}"})
    first_id = users_resp.json()["items"][0]["id"]

    resp = await client.get(f"/api/admin/users/{first_id}", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["id"] == first_id


@pytest.mark.asyncio
async def test_admin_can_change_role(client: AsyncClient):
    _, token = await _make_admin(client)

    # Create a plain user to promote
    reg = await client.post("/api/auth/register", json={"email": "promote@example.com", "password": "pass12345"})
    user_id = None
    users_resp = await client.get("/api/admin/users", headers={"Authorization": f"Bearer {token}"})
    for u in users_resp.json()["items"]:
        if u["email"] == "promote@example.com":
            user_id = u["id"]
            break
    assert user_id is not None

    resp = await client.patch(
        f"/api/admin/users/{user_id}",
        json={"role": "admin"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["role"] == "admin"


@pytest.mark.asyncio
async def test_admin_can_block_user(client: AsyncClient):
    _, token = await _make_admin(client)

    reg = await client.post("/api/auth/register", json={"email": "toblock@example.com", "password": "pass12345"})
    users_resp = await client.get("/api/admin/users", headers={"Authorization": f"Bearer {token}"})
    user_id = next(u["id"] for u in users_resp.json()["items"] if u["email"] == "toblock@example.com")

    resp = await client.patch(
        f"/api/admin/users/{user_id}",
        json={"is_active": False},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False

    # Blocked user can't login
    login = await client.post("/api/auth/login", json={"email": "toblock@example.com", "password": "pass12345"})
    assert login.status_code == 403


@pytest.mark.asyncio
async def test_admin_cannot_block_self(client: AsyncClient):
    admin_email, token = await _make_admin(client)
    users_resp = await client.get("/api/admin/users", headers={"Authorization": f"Bearer {token}"})
    admin_id = next(u["id"] for u in users_resp.json()["items"] if u["email"] == admin_email)

    resp = await client.patch(
        f"/api/admin/users/{admin_id}",
        json={"is_active": False},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_admin_can_force_verify_email(client: AsyncClient):
    _, token = await _make_admin(client)

    reg = await client.post("/api/auth/register", json={"email": "unverified@example.com", "password": "pass12345"})
    users_resp = await client.get("/api/admin/users", headers={"Authorization": f"Bearer {token}"})
    user_id = next(u["id"] for u in users_resp.json()["items"] if u["email"] == "unverified@example.com")

    resp = await client.post(
        f"/api/admin/users/{user_id}/force-verify",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["email_verified"] is True


@pytest.mark.asyncio
async def test_admin_can_delete_user(client: AsyncClient):
    _, token = await _make_admin(client)

    await client.post("/api/auth/register", json={"email": "todelete@example.com", "password": "pass12345"})
    users_resp = await client.get("/api/admin/users", headers={"Authorization": f"Bearer {token}"})
    user_id = next(u["id"] for u in users_resp.json()["items"] if u["email"] == "todelete@example.com")

    resp = await client.delete(f"/api/admin/users/{user_id}", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 204

    get_resp = await client.get(f"/api/admin/users/{user_id}", headers={"Authorization": f"Bearer {token}"})
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_admin_cannot_delete_self(client: AsyncClient):
    admin_email, token = await _make_admin(client)
    users_resp = await client.get("/api/admin/users", headers={"Authorization": f"Bearer {token}"})
    admin_id = next(u["id"] for u in users_resp.json()["items"] if u["email"] == admin_email)

    resp = await client.delete(f"/api/admin/users/{admin_id}", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_get_nonexistent_user_404(client: AsyncClient):
    _, token = await _make_admin(client)
    import uuid
    resp = await client.get(f"/api/admin/users/{uuid.uuid4()}", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 404
