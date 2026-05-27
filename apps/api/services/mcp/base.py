from abc import ABC, abstractmethod

from pydantic import BaseModel


class MCPSource(BaseModel):
    id: str
    name: str
    mime_type: str
    modified_at: str | None = None


class MCPContent(BaseModel):
    filename: str
    mime_type: str
    data: bytes

    class Config:
        arbitrary_types_allowed = True


class MCPClient(ABC):
    @abstractmethod
    async def get_auth_url(self, state: str) -> str: ...

    @abstractmethod
    async def exchange_code(self, code: str) -> dict: ...

    @abstractmethod
    async def list_sources(self, token_data: dict) -> list[MCPSource]: ...

    @abstractmethod
    async def fetch_content(self, token_data: dict, source_id: str) -> MCPContent: ...
