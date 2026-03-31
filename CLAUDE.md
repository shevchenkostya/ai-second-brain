# CLAUDE.md

## Project
This repository contains the AI Second Brain for Developer / Architect project.

The product is a personal AI-powered engineering workspace that supports:
- document ingestion
- retrieval-augmented generation (RAG)
- grounded chat with citations
- role-based agents
- artifact generation
- scheduled automations
- future MCP integrations

## Primary Goal
Build a production-minded MVP that is simple, modular, testable, and incrementally extensible.

## Product Priorities
When making decisions, prioritize:
1. Reliability of ingestion and retrieval
2. Grounded answers with citations
3. Clear architecture and maintainable code
4. Strong developer experience
5. Incremental delivery over over-engineering

## Engineering Principles
- Prefer simple, explicit, maintainable code
- Avoid unnecessary abstractions until repeated patterns are proven
- Keep business logic out of controllers and UI components
- Favor typed interfaces and structured schemas
- Prefer modular monolith architecture first
- Optimize for readability and testability
- Do not introduce heavy frameworks unless they clearly reduce implementation cost

## Tech Direction
Preferred stack:
- Frontend: Next.js, TypeScript, Tailwind, shadcn/ui
- Backend: FastAPI, Pydantic, SQLAlchemy, Alembic
- Async jobs: Celery or Arq with Redis
- Database: PostgreSQL
- Vector store: Qdrant
- Infra: Docker Compose initially, VPS deployment later

## Domain Rules
The system must support:
- documents
- document chunks
- embeddings
- workspaces
- chats
- messages
- artifacts
- jobs
- automations

All AI outputs must be grounded in retrieved source content whenever the task depends on repository or user-provided knowledge.

## Retrieval Rules
- Prefer grounded retrieval over generic model knowledge
- Use chunk-level retrieval
- Preserve source references
- Return citations whenever answering from ingested documents
- If retrieval confidence is weak, say so explicitly
- Do not fabricate sources or decisions

## Agent Behavior
The project has three primary agent roles:
- Analyst
- Architect
- Reviewer

When implementing or prompting these agents:
- keep responsibilities separate
- use structured outputs where possible
- avoid overlapping prompts unless necessary
- require evidence-backed statements for analysis tasks

## Code Quality Rules
- Use descriptive names
- Keep functions focused
- Add docstrings/comments only where they provide real value
- Write tests for non-trivial logic
- Avoid giant files and god classes
- Prefer dependency injection or explicit composition over hidden globals

## Backend Rules
- Keep API layer thin
- Put orchestration in services
- Put storage logic in repositories/data-access layer
- Use Pydantic schemas for request/response contracts
- Use Alembic for schema migrations
- Use async/background jobs for indexing and automations
- Keep provider-specific AI code behind adapters

## Frontend Rules
- Separate presentational and data-fetching concerns
- Keep components small and composable
- Use server/client boundaries intentionally
- Design UI for chat, sources, artifacts, and job status visibility
- Prefer clarity over visual complexity

## Security Rules
- Never expose secrets in frontend
- Read API keys from environment variables
- Do not hardcode credentials
- Avoid dangerous shell actions unless explicitly requested
- Treat generated file operations carefully

## Delivery Rules
When asked to implement a feature:
1. Restate the objective briefly
2. Inspect current relevant files
3. Propose a minimal implementation plan
4. Implement incrementally
5. Update tests
6. Update docs when behavior changes

## Output Rules
When generating implementation plans:
- provide concrete file-level changes
- mention trade-offs
- highlight assumptions
- suggest the smallest useful first version

When generating code:
- output complete file content when changing a file substantially
- keep code ready to run
- avoid placeholder pseudo-code unless explicitly requested

When generating architecture content:
- prefer actionable design over abstract theory
- include data flow, boundaries, and responsibilities
- identify risks and future extension points

## Anti-Patterns to Avoid
- premature microservices
- excessive agent orchestration before MVP
- hidden magic in prompts or config
- tight coupling between retrieval and UI
- giant all-in-one service classes
- framework-driven architecture instead of domain-driven structure

## Default Working Mode
Assume the user wants:
- strong software engineering quality
- architecture-first thinking
- implementation-ready outputs
- comprehensive but practical guidance
- full code when coding is requested