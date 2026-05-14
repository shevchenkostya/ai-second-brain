import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.user import User
from schemas.artifact import AnalyzeIn, ArtifactOut
from services.auth import get_current_user
from services import analyst as analyst_service

router = APIRouter(prefix="/api/artifacts", tags=["artifacts"])


def _serialize(artifact) -> ArtifactOut:
    return ArtifactOut(
        id=str(artifact.id),
        artifact_type=artifact.artifact_type,
        title=artifact.title,
        content=artifact.content,
        source_refs=artifact.source_refs_json or [],
        created_at=artifact.created_at,
    )


@router.post("/analyze", response_model=ArtifactOut, status_code=status.HTTP_201_CREATED)
async def analyze(
    body: AnalyzeIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        artifact = await analyst_service.run_analysis(
            mode=body.mode,
            document_ids=body.document_ids,
            db=db,
            language=body.language,
            custom_title=body.title,
            user_id=current_user.id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return _serialize(artifact)


@router.get("", response_model=list[ArtifactOut])
async def list_artifacts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    artifacts = await analyst_service.list_artifacts(db, user_id=current_user.id)
    return [_serialize(a) for a in artifacts]


@router.get("/{artifact_id}", response_model=ArtifactOut)
async def get_artifact(
    artifact_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    artifact = await analyst_service.get_artifact(artifact_id, db)
    if artifact is None:
        raise HTTPException(status_code=404, detail="Artifact not found")
    return _serialize(artifact)


@router.delete("/{artifact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_artifact(
    artifact_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deleted = await analyst_service.delete_artifact(artifact_id, db)
    if not deleted:
        raise HTTPException(status_code=404, detail="Artifact not found")
