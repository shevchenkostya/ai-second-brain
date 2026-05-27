import pytest
from httpx import AsyncClient
from main import app


@pytest.mark.asyncio
async def test_login_returns_refresh_token(client: AsyncClient):
    resp = await client.post("/api/auth/login", json={"email": "test@example.com", "password": "testpass123"})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data


@pytest.mark.asyncio
async def test_register_returns_refresh_token(client: AsyncClient):
    resp = await client.post(
        "/api/auth/register",
        json={"email": "newrefresh@example.com", "password": "password123"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert "refresh_token" in data


@pytest.mark.asyncio
async def test_refresh_returns_new_token_pair(client: AsyncClient):
    reg = await client.post(
        "/api/auth/register",
        json={"email": "refreshuser@example.com", "password": "password123"},
    )
    old_refresh = reg.json()["refresh_token"]

    resp = await client.post("/api/auth/refresh", json={"refresh_token": old_refresh})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["refresh_token"] != old_refresh


@pytest.mark.asyncio
async def test_refresh_token_rotation_invalidates_old(client: AsyncClient):
    reg = await client.post(
        "/api/auth/register",
        json={"email": "rotation@example.com", "password": "password123"},
    )
    old_refresh = reg.json()["refresh_token"]

    await client.post("/api/auth/refresh", json={"refresh_token": old_refresh})

    # Using old token again must fail
    resp = await client.post("/api/auth/refresh", json={"refresh_token": old_refresh})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_logout_revokes_refresh_token(client: AsyncClient):
    reg = await client.post(
        "/api/auth/register",
        json={"email": "logoutuser@example.com", "password": "password123"},
    )
    refresh_token = reg.json()["refresh_token"]

    await client.post("/api/auth/logout", json={"refresh_token": refresh_token})

    resp = await client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_verify_email_valid_token(client: AsyncClient):
    from services.auth import create_email_token, _hash_token
    from models.email_token import EMAIL_TOKEN_VERIFY
    from database import get_db

    # Get a db session via the override
    async for db in app.dependency_overrides[get_db]():
        from sqlalchemy import select
        from models.user import User
        result = await db.execute(select(User).where(User.email == "test@example.com"))
        user = result.scalar_one()
        token = await create_email_token(user.id, EMAIL_TOKEN_VERIFY, db)

    resp = await client.post("/api/auth/verify-email", json={"token": token})
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_verify_email_invalid_token(client: AsyncClient):
    resp = await client.post("/api/auth/verify-email", json={"token": "notavalidtoken"})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_forgot_password_always_200(client: AsyncClient):
    resp = await client.post("/api/auth/forgot-password", json={"email": "nobody@nowhere.com"})
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_reset_password_valid_token(client: AsyncClient):
    from services.auth import create_email_token
    from models.email_token import EMAIL_TOKEN_RESET
    from database import get_db

    # Use a dedicated user so we don't break the shared test@example.com account
    reset_email = "resetpwtest@example.com"
    reset_pass = "originalpass123"
    await client.post("/api/auth/register", json={"email": reset_email, "password": reset_pass})

    async for db in app.dependency_overrides[get_db]():
        from sqlalchemy import select
        from models.user import User
        result = await db.execute(select(User).where(User.email == reset_email))
        user = result.scalar_one()
        token = await create_email_token(user.id, EMAIL_TOKEN_RESET, db)

    resp = await client.post("/api/auth/reset-password", json={"token": token, "new_password": "newpassword999"})
    assert resp.status_code == 200

    # Old password no longer works
    login_resp = await client.post("/api/auth/login", json={"email": reset_email, "password": reset_pass})
    assert login_resp.status_code == 401


@pytest.mark.asyncio
async def test_reset_password_expired_token(client: AsyncClient):
    from services.auth import _hash_token
    from models.email_token import EmailToken, EMAIL_TOKEN_RESET
    from database import get_db
    from datetime import datetime, timezone, timedelta
    import uuid

    async for db in app.dependency_overrides[get_db]():
        from sqlalchemy import select
        from models.user import User
        result = await db.execute(select(User).where(User.email == "test@example.com"))
        user = result.scalar_one()
        import secrets
        raw = secrets.token_urlsafe(32)
        db.add(EmailToken(
            user_id=user.id,
            token_hash=_hash_token(raw),
            type=EMAIL_TOKEN_RESET,
            expires_at=datetime.now(timezone.utc) - timedelta(hours=1),
        ))
        await db.commit()

    resp = await client.post("/api/auth/reset-password", json={"token": raw, "new_password": "doesntmatter"})
    assert resp.status_code == 400
    assert "expired" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_change_password_wrong_old_password(client: AsyncClient):
    resp = await client.post(
        "/api/auth/change-password",
        json={"old_password": "wrongpassword", "new_password": "newpassword123"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_blocked_user_cannot_login(client: AsyncClient):
    from database import get_db
    from sqlalchemy import select
    from models.user import User

    async for db in app.dependency_overrides[get_db]():
        result = await db.execute(select(User).where(User.email == "test@example.com"))
        user = result.scalar_one()
        user.is_active = False
        await db.commit()

    resp = await client.post("/api/auth/login", json={"email": "test@example.com", "password": "testpass123"})
    assert resp.status_code == 403

    # Restore
    async for db in app.dependency_overrides[get_db]():
        result = await db.execute(select(User).where(User.email == "test@example.com"))
        user = result.scalar_one()
        user.is_active = True
        await db.commit()


@pytest.mark.asyncio
async def test_me_returns_role_and_verified(client: AsyncClient):
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 200
    data = resp.json()
    assert "role" in data
    assert "is_active" in data
    assert "email_verified" in data
