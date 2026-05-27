from pydantic import BaseModel


class UserAdminOut(BaseModel):
    id: str
    email: str
    role: str
    is_active: bool
    email_verified: bool
    created_at: str


class UserAdminPatch(BaseModel):
    role: str | None = None
    is_active: bool | None = None


class UserListOut(BaseModel):
    items: list[UserAdminOut]
    total: int
