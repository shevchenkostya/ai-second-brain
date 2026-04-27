from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict


AnalysisMode = Literal["summarize", "compare", "extract_decisions", "find_contradictions"]


class AnalyzeIn(BaseModel):
    mode: AnalysisMode
    document_ids: list[str]
    language: str = "auto"
    title: Optional[str] = None


class ArtifactOut(BaseModel):
    id: str
    artifact_type: str
    title: Optional[str] = None
    content: Optional[str] = None
    source_refs: list[str] = []
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
