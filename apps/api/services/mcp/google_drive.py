from urllib.parse import urlencode

import httpx

from services.mcp.base import MCPClient, MCPContent, MCPSource

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
DRIVE_API = "https://www.googleapis.com/drive/v3"

SCOPES = "https://www.googleapis.com/auth/drive.readonly"

# Google Docs types that must be exported rather than downloaded directly
_EXPORT_MAP: dict[str, tuple[str, str]] = {
    "application/vnd.google-apps.document": ("text/plain", ".txt"),
    "application/vnd.google-apps.spreadsheet": ("text/csv", ".csv"),
}

# Non-Google file types we accept for direct download
_SUPPORTED_MIME = {
    "application/pdf",
    "text/plain",
    "text/markdown",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/html",
    "application/json",
    "text/x-yaml",
    "application/x-yaml",
}


class GoogleDriveClient(MCPClient):
    def __init__(self, client_id: str, client_secret: str, redirect_uri: str) -> None:
        self._client_id = client_id
        self._client_secret = client_secret
        self._redirect_uri = redirect_uri

    async def get_auth_url(self, state: str) -> str:
        params = {
            "client_id": self._client_id,
            "redirect_uri": self._redirect_uri,
            "response_type": "code",
            "scope": SCOPES,
            "access_type": "offline",
            "prompt": "consent",
            "state": state,
        }
        return f"{AUTH_URL}?{urlencode(params)}"

    async def exchange_code(self, code: str) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                TOKEN_URL,
                data={
                    "code": code,
                    "client_id": self._client_id,
                    "client_secret": self._client_secret,
                    "redirect_uri": self._redirect_uri,
                    "grant_type": "authorization_code",
                },
            )
            resp.raise_for_status()
            return resp.json()

    async def list_sources(self, token_data: dict) -> list[MCPSource]:
        supported = set(_EXPORT_MAP.keys()) | _SUPPORTED_MIME
        mime_filter = " or ".join(f"mimeType='{m}'" for m in sorted(supported))
        params = {
            "q": f"trashed=false and ({mime_filter})",
            "fields": "files(id,name,mimeType,modifiedTime)",
            "pageSize": 50,
            "orderBy": "modifiedTime desc",
        }
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{DRIVE_API}/files",
                headers={"Authorization": f"Bearer {token_data['access_token']}"},
                params=params,
            )
            resp.raise_for_status()
            files = resp.json().get("files", [])

        return [
            MCPSource(
                id=f["id"],
                name=f["name"],
                mime_type=f["mimeType"],
                modified_at=f.get("modifiedTime"),
            )
            for f in files
        ]

    async def fetch_content(self, token_data: dict, source_id: str) -> MCPContent:
        headers = {"Authorization": f"Bearer {token_data['access_token']}"}

        async with httpx.AsyncClient() as client:
            # Get file metadata first
            meta_resp = await client.get(
                f"{DRIVE_API}/files/{source_id}",
                headers=headers,
                params={"fields": "id,name,mimeType"},
            )
            meta_resp.raise_for_status()
            meta = meta_resp.json()

            mime_type: str = meta["mimeType"]
            name: str = meta["name"]

            if mime_type in _EXPORT_MAP:
                export_mime, ext = _EXPORT_MAP[mime_type]
                download_resp = await client.get(
                    f"{DRIVE_API}/files/{source_id}/export",
                    headers=headers,
                    params={"mimeType": export_mime},
                )
                download_resp.raise_for_status()
                return MCPContent(
                    filename=f"{name}{ext}",
                    mime_type=export_mime,
                    data=download_resp.content,
                )

            download_resp = await client.get(
                f"{DRIVE_API}/files/{source_id}",
                headers=headers,
                params={"alt": "media"},
            )
            download_resp.raise_for_status()
            return MCPContent(
                filename=name,
                mime_type=mime_type,
                data=download_resp.content,
            )
