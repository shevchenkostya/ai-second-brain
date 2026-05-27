from services.mcp.base import MCPClient


class MCPRegistry:
    def __init__(self) -> None:
        self._providers: dict[str, MCPClient] = {}

    def register(self, name: str, client: MCPClient) -> None:
        self._providers[name] = client

    def get(self, name: str) -> MCPClient:
        client = self._providers.get(name)
        if client is None:
            raise KeyError(f"MCP provider '{name}' is not registered")
        return client

    def names(self) -> list[str]:
        return list(self._providers.keys())


registry = MCPRegistry()
