import pytest
import pytest_asyncio
from unittest.mock import AsyncMock
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from database import Base, get_db
from main import app
import services.document as doc_service


@pytest.fixture(scope="session", autouse=True)
def patch_upload_dir(tmp_path_factory):
    tmp = tmp_path_factory.mktemp("uploads")
    doc_service.UPLOAD_DIR = tmp
    yield tmp

# In-memory SQLite for tests — не нужен реальный Postgres
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

_TEST_EMAIL = "test@example.com"
_TEST_PASSWORD = "testpass123"


@pytest_asyncio.fixture(scope="session")
async def engine():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(engine):
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def client(engine):
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def override_get_db():
        async with Session() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db

    # ASGITransport does not trigger lifespan events, so arq_pool is never set.
    # Manually mock it so upload/reindex endpoints don't fail.
    app.state.arq_pool = AsyncMock()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Register test user — ignore 400 if already exists from a prior test in this session
        await ac.post("/api/auth/register", json={"email": _TEST_EMAIL, "password": _TEST_PASSWORD})
        resp = await ac.post("/api/auth/login", json={"email": _TEST_EMAIL, "password": _TEST_PASSWORD})
        token = resp.json()["access_token"]
        ac.headers = {**ac.headers, "Authorization": f"Bearer {token}"}
        yield ac

    app.dependency_overrides.clear()
