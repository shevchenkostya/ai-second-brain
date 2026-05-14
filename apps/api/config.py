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

    # LLM
    llm_provider: str = "mock"  # mock | anthropic | ollama
    anthropic_api_key: str = ""
    ollama_url: str = "http://host.docker.internal:11434"
    ollama_model: str = "llama3.2:3b"

    # Auth
    secret_key: str = "dev-secret-change-in-production"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days

    model_config = SettingsConfigDict(env_file=".env.local", extra="ignore")


settings = Settings()
