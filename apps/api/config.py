from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@db:5432/second_brain"
    redis_url: str = "redis://redis:6379"
    qdrant_url: str = "http://qdrant:6333"
    api_host: str = "0.0.0.0"
    api_port: int = 4000
    debug: bool = False

    class Config:
        env_file = ".env"


settings = Settings()
