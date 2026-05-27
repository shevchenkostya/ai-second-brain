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
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30
    email_token_expire_hours: int = 24

    # Email (SMTP)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    from_email: str = "noreply@localhost"
    frontend_url: str = "http://localhost:3000"

    # First admin bootstrap (created on startup if no admin exists)
    first_admin_email: str = ""
    first_admin_password: str = ""

    # MCP — Google Drive
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:4000/api/mcp/google/callback"

    model_config = SettingsConfigDict(env_file=".env.local", extra="ignore")


settings = Settings()
