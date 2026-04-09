from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@db:5432/second_brain"
    redis_url: str = "redis://redis:6379"
    qdrant_url: str = "http://qdrant:6333"
    api_host: str = "0.0.0.0"
    api_port: int = 4000
    debug: bool = False

    # Embeddings
    embedding_provider: str = "mock"   # mock | openai
    openai_api_key: str = ""
    embedding_dim: int = 1536
    qdrant_collection: str = "documents"

    # LLM (Sprint 3+)
    anthropic_api_key: str = ""

    model_config = SettingsConfigDict(env_file=".env.local", extra="ignore")


settings = Settings()
