import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.user import User, ROLE_ADMIN, ROLE_USER
from schemas.user import UserAdminOut, UserAdminPatch, UserListOut
from services.auth import require_admin

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _user_out(u: User) -> UserAdminOut:
    return UserAdminOut(
        id=str(u.id),
        email=u.email,
        role=u.role,
        is_active=u.is_active,
        email_verified=u.email_verified,
        created_at=u.created_at.isoformat(),
    )


@router.get("/users", response_model=UserListOut)
async def list_users(
    offset: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(User).order_by(User.created_at.desc()).offset(offset).limit(limit))
    users = list(result.scalars().all())
    total_result = await db.execute(select(func.count()).select_from(User))
    total = total_result.scalar_one()
    return UserListOut(items=[_user_out(u) for u in users], total=total)


@router.get("/users/{user_id}", response_model=UserAdminOut)
async def get_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return _user_out(user)


@router.patch("/users/{user_id}", response_model=UserAdminOut)
async def patch_user(
    user_id: uuid.UUID,
    body: UserAdminPatch,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    if body.role is not None:
        if body.role not in (ROLE_USER, ROLE_ADMIN):
            raise HTTPException(status_code=400, detail=f"Invalid role: {body.role}")
        user.role = body.role

    if body.is_active is not None:
        if user.id == admin.id and not body.is_active:
            raise HTTPException(status_code=400, detail="Cannot deactivate your own account")
        user.is_active = body.is_active

    await db.commit()
    await db.refresh(user)
    return _user_out(user)


@router.delete("/users/{user_id}", status_code=204)
async def delete_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    await db.delete(user)
    await db.commit()


@router.post("/users/{user_id}/force-verify", response_model=UserAdminOut)
async def force_verify(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    from datetime import datetime, timezone
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    user.email_verified = True
    user.email_verified_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(user)
    return _user_out(user)
