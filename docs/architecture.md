# Architecture — AI Second Brain for Developer / Architect

## 1. Overview

AI Second Brain is a personal AI-powered engineering workspace for developers and architects.
Its purpose is to ingest engineering knowledge, index it, retrieve relevant context, support grounded conversations, run role-based agent workflows, generate artifacts, and automate recurring knowledge tasks.

The architecture is designed for:
- local-first development
- fast MVP delivery
- clean module boundaries
- production-minded extensibility
- future MCP integration without redesigning the core system

The system is intentionally designed as a **modular monolith with supporting infrastructure services**.

---

## 2. Architecture Principles

### 2.1 Modular monolith first

At the early stage, the system should remain a modular monolith instead of splitting into microservices.

Reasoning:
- lower operational complexity
- faster implementation
- easier debugging
- simpler local development
- better fit for a single-user or early-stage product

### 2.2 Retrieval quality over agent complexity

The most important part of the product is retrieval quality.
If ingestion, chunking, metadata, embeddings, and retrieval are weak, all higher-level agent workflows will degrade.

### 2.3 Thin transport, rich services

Controllers and route handlers should stay thin.
Business rules, orchestration, retrieval logic, artifact generation, and workflow behavior should live in dedicated service layers.

### 2.4 Async by default for heavy tasks

Any operation that is expensive or failure-prone should run asynchronously:
- parsing
- chunking
- embedding generation
- indexing
- digest generation
- periodic reports

### 2.5 Explicit boundaries

Each module should have a clearly defined responsibility.
Avoid "god services" and avoid mixing:
- API transport logic
- domain logic
- AI orchestration
- persistence concerns

### 2.6 Prompt and agent behavior must be versionable

Prompt definitions, role instructions, and AGENTS.md-based guidance should be stored as explicit artifacts in the repository rather than hidden inside application code.

---

## 3. High-Level System Architecture

```text
[Next.js Web App]
        |
        v
[FastAPI API]
        |
        +--> [PostgreSQL]        -> relational data, metadata, chat history, artifacts, jobs
        |
        +--> [Qdrant]            -> vector storage and semantic retrieval
        |
        +--> [Redis]             -> job queue, caching, coordination
        |
        +--> [File Storage]      -> original uploaded files
        |
        +--> [Worker]            -> parsing, chunking, embeddings, indexing, automations
        |
        +--> [LLM Adapter]       -> model provider integration
        |
        +--> [MCP Client Layer]  -> future external tool/data integrations
```

---

## 4. Main Runtime Components

### 4.1 Web application

**Responsibilities:**
- workspace UI
- document upload UI
- document list and detail views
- chat UI
- artifact viewer
- automation/job status screens
- settings screens

**Recommended stack:**
- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- TanStack Query

**Notes:**
The frontend should remain mostly a presentation and interaction layer. It should not contain business logic for retrieval, indexing, or agent orchestration.

### 4.2 API application

**Responsibilities:**
- REST API
- workspace and document management
- chat request handling
- retrieval orchestration
- agent workflow execution
- artifact persistence
- settings management
- automation configuration

**Recommended stack:**
- FastAPI
- Pydantic
- SQLAlchemy
- Alembic

**Notes:**
The API should be the central orchestrator of user-facing workflows. It should delegate long-running tasks to the worker and keep HTTP handlers thin.

### 4.3 Worker application

**Responsibilities:**
- parser execution
- text normalization
- chunking
- embedding generation
- indexing to vector store
- reindexing
- scheduled digest generation
- stale document checks
- background artifact generation

**Recommended stack:**
- Arq or Celery
- Redis

**Notes:**
The worker should process asynchronous jobs and update job/document state consistently. All heavy operations should go through the worker rather than blocking the API.

### 4.4 Relational database

**Responsibilities:**
- workspaces
- documents
- document metadata
- chunk metadata
- chats
- messages
- artifacts
- jobs
- automations
- settings

**Recommended stack:** PostgreSQL

**Notes:**
PostgreSQL is the system of record for structured application state.

### 4.5 Vector store

**Responsibilities:**
- vector indexing
- semantic retrieval
- hybrid retrieval support
- metadata filtering

**Recommended stack:** Qdrant

**Notes:**
Qdrant should store embeddings and vector-related metadata needed for retrieval. The original chunk text can be stored in PostgreSQL, while vector references stay aligned with chunk IDs.

### 4.6 File storage

**Responsibilities:**
- original file persistence
- source file retrieval
- future export/import support

- **Local development:** local filesystem volume
- **Production:** S3-compatible object storage

**Notes:**
The system should always preserve the original uploaded file unless the user explicitly deletes it.

### 4.7 LLM adapter layer

**Responsibilities:**
- model provider integration
- prompt execution
- structured output handling
- retries and error handling
- provider abstraction
- usage accounting (later)

**Notes:**
Provider-specific logic should not leak into the domain or route layers. The rest of the application should depend on an internal abstraction rather than a direct SDK everywhere.

### 4.8 MCP client layer

**Responsibilities:**
- connect the system to external tools and data sources
- expose future integrations in a standard way
- support controlled access to external context

**Initial status:** Postponed until after MVP core retrieval is stable.

**Notes:**
MCP should be introduced as an extension layer, not as a core dependency of the first version.

---

## 5. Backend Module Boundaries

The backend should be organized into clear domain-oriented modules.

### 5.1 Workspaces module

**Responsibilities:**
- workspace creation
- workspace settings
- workspace-scoped access to documents, chats, artifacts, and automations

**Owns:**
- workspace entities
- workspace configuration
- workspace-level instruction settings (later)

### 5.2 Documents module

**Responsibilities:**
- file registration
- file storage coordination
- metadata extraction
- indexing lifecycle management
- document status tracking
- reindex and delete orchestration

**Owns:**
- document entity
- parser selection input
- indexing state

**Status lifecycle:** `uploaded` → `queued` → `processing` → `indexed` → `failed` → `deleted`

### 5.3 Parsing and ingestion module

**Responsibilities:**
- parser registry
- format-specific parsing
- normalization
- text cleanup
- content extraction

**Supported formats (early versions):** `.md`, `.txt`, `.pdf`, `.docx`, `.json`, `.yaml`, `.html`

**Notes:**
Parsing should be isolated from retrieval and agent logic. It should return normalized content plus parsing metadata.

### 5.4 Chunking module

**Responsibilities:**
- split normalized content into retrieval chunks
- assign chunk metadata
- preserve ordering and source mapping
- support configurable chunk size and overlap

**Notes:**
Chunking strategy must be explicit and configurable. Poor chunking will directly damage retrieval quality.

### 5.5 Embeddings and indexing module

**Responsibilities:**
- generate embeddings
- push vectors to Qdrant
- persist chunk metadata
- maintain vector-to-chunk mapping
- support reindex flows

**Notes:**
This module should be idempotent where possible. Reindexing should not corrupt metadata or duplicate active vector records.

### 5.6 Retrieval module

**Responsibilities:**
- semantic search
- metadata filtering
- keyword retrieval (later)
- hybrid retrieval (later)
- reranking (later)
- source evidence assembly
- confidence heuristics

**Notes:**
Retrieval is a first-class subsystem, not a helper function. It should expose clean interfaces to the chat and agents modules.

### 5.7 Chat module

**Responsibilities:**
- chat sessions
- message persistence
- mode handling
- retrieval-backed response generation
- citation construction

**Supported chat modes:** Ask, Summarize, Compare, Decisions, ADR Draft

**Notes:**
The chat module should not directly parse files or manage indexing.

### 5.8 Agents module

**Responsibilities:**
- role-specific workflow execution
- role prompt selection
- structured output schemas
- optional multi-step execution
- evidence-aware agent responses

**Initial roles:** Analyst, Architect, Reviewer

**Notes:**
The initial architecture should use role-based workflows, not uncontrolled autonomous agents.

### 5.9 Artifacts module

**Responsibilities:**
- persist generated outputs
- classify artifact type
- attach source references
- support artifact listing and viewing

**Artifact examples:** summary report, comparison report, decision log, ADR draft, digest

### 5.10 Jobs and automations module

**Responsibilities:**
- background job creation
- status tracking
- scheduling
- retries
- recurring workflows

**Examples:**
- auto-index on upload
- nightly digest
- weekly summary
- stale document report

### 5.11 Settings module

**Responsibilities:**
- provider configuration
- model selection
- retrieval tuning parameters
- chunking settings
- prompt template selection (later)

---

## 6. End-to-End Data Flows

### 6.1 Document upload and indexing flow

```
User uploads file
  -> API validates request
  -> file stored in file storage
  -> document record created in PostgreSQL
  -> indexing job enqueued
  -> worker loads file
  -> parser extracts normalized content
  -> chunking module splits content
  -> embedding module generates vectors
  -> chunk metadata stored in PostgreSQL
  -> vectors stored in Qdrant
  -> document status updated to indexed
```

**Key guarantees:**
- original file is preserved
- document status is visible
- failed indexing is traceable
- reindex remains possible

### 6.2 Chat and RAG flow

```
User sends prompt
  -> API resolves workspace and chat context
  -> chat mode determined
  -> retrieval module fetches relevant chunks
  -> context builder assembles grounded evidence
  -> LLM adapter generates response
  -> citations attached
  -> message stored in PostgreSQL
  -> response returned to frontend
```

**Key guarantees:**
- grounded context is explicit
- citations point to retrieved chunks
- chat history is preserved
- weak retrieval can surface uncertainty

### 6.3 Agent workflow flow

```
User selects role/task
  -> API identifies requested workflow
  -> retrieval fetches evidence
  -> agent-specific prompt executes
  -> structured output validated
  -> optional reviewer pass runs
  -> artifact saved
  -> result returned to frontend
```

**Key guarantees:**
- role boundaries are respected
- outputs can be persisted
- evidence is preserved
- schemas remain stable

### 6.4 Scheduled automation flow

```
Scheduler triggers job
  -> job record created
  -> worker gathers relevant inputs
  -> retrieval + summarization/analysis runs
  -> artifact generated
  -> job status updated
  -> artifact becomes visible in UI
```

**Key guarantees:**
- scheduled work is traceable
- outputs remain inspectable
- failures do not break the API path

---

## 7. Retrieval Architecture

Retrieval is the core of product quality.

### 7.1 Retrieval pipeline

1. source parsing
2. normalization
3. chunking
4. metadata assignment
5. embedding generation
6. vector storage
7. semantic retrieval
8. metadata filtering
9. optional reranking
10. evidence assembly
11. grounded prompt execution
12. citation mapping

### 7.2 Retrieval requirements

- chunk-level evidence
- stable chunk identifiers
- document-level and workspace-level filters
- configurable top-k
- support for future hybrid retrieval
- support for future reranking
- support for future evaluation

### 7.3 Evidence model

Each retrieved result should preserve:
- `workspace_id`
- `document_id`
- `chunk_id`
- `chunk_index`
- source text
- metadata
- retrieval score
- optional rerank score

This makes citations and debugging possible.

### 7.4 Citation strategy

The system should return citations based on retrieved chunks, not invented source names.
A citation should ideally include:
- document title
- chunk reference
- optional snippet preview
- optional page/section metadata if available

### 7.5 Failure cases

| Case | Behavior |
|---|---|
| Weak retrieval | Response should explicitly state that evidence is weak |
| Empty retrieval | Avoid hallucinating; explain no sufficient evidence was found |
| Low-quality parsing | Document stays marked as failed/partially indexed, no silent misleading results |

---

## 8. Agent Architecture

The first version uses controlled role-based agents.

### 8.1 Why not fully autonomous multi-agent at first

A full autonomous multi-agent system introduces unnecessary complexity early:
- harder observability
- harder debugging
- weaker determinism
- more prompt drift
- more token cost
- less predictable outputs

The system should first support clear role-based workflows with explicit orchestration.

### 8.2 Initial roles

**Analyst**
- summarize documents
- extract requirements
- extract decisions
- detect contradictions
- synthesize findings

**Architect**
- compare technical options
- propose solutions
- analyze trade-offs
- generate ADR drafts
- recommend phased implementation

**Reviewer**
- critique outputs
- detect missing assumptions
- identify risk areas
- improve result quality

### 8.3 Role execution model

```
Request
 -> role selected
 -> evidence retrieved
 -> role prompt executed
 -> output validated
 -> optional persisted artifact
```

For some tasks, Reviewer may evaluate Architect or Analyst outputs.

### 8.4 Prompt layering

Prompt composition should follow a stable order:

1. global system rules
2. repository rules
3. product constraints
4. workspace instructions
5. AGENTS.md instructions
6. role instructions
7. task instructions
8. output schema requirements

This avoids fragile prompts and hidden behavior.

---

## 9. Data Architecture

### 9.1 Primary relational entities

**users**
- `id`, `email`, `name`, `created_at`

**workspaces**
- `id`, `user_id`, `name`, `description`, `created_at`

**documents**
- `id`, `workspace_id`, `title`, `source_type`, `mime_type`, `file_path`, `checksum`, `status`, `created_at`, `updated_at`

**document_chunks**
- `id`, `document_id`, `chunk_index`, `text`, `token_count`, `metadata_json`, `vector_ref`, `created_at`

**chats**
- `id`, `workspace_id`, `title`, `created_at`

**messages**
- `id`, `chat_id`, `role`, `mode`, `content`, `citations_json`, `created_at`

**artifacts**
- `id`, `workspace_id`, `artifact_type`, `title`, `content`, `source_refs_json`, `created_at`

**jobs**
- `id`, `workspace_id`, `job_type`, `status`, `payload_json`, `result_json`, `created_at`, `updated_at`

**automations**
- `id`, `workspace_id`, `automation_type`, `schedule`, `enabled`, `config_json`, `created_at`, `updated_at`

### 9.2 Storage ownership

| Store | Owns |
|---|---|
| PostgreSQL | metadata, entities, job states, history, artifacts, chunk metadata and text |
| Qdrant | vectors, vector payload for retrieval, mapping to chunk identity |
| File storage | raw uploaded documents |

### 9.3 Design rule

> Structured truth belongs in PostgreSQL. Vector retrieval state belongs in Qdrant. Original source files belong in file storage.

---

## 10. API Architecture

The API surface should remain resource-oriented and predictable.

### 10.1 Document endpoints

```
POST   /api/documents/upload
GET    /api/documents
GET    /api/documents/{id}
POST   /api/documents/{id}/reindex
DELETE /api/documents/{id}
```

### 10.2 Chat and retrieval endpoints

```
POST /api/chat
GET  /api/chats
GET  /api/chats/{id}/messages
POST /api/search
```

### 10.3 Agent endpoints

```
POST /api/agents/analyze
POST /api/agents/architect
POST /api/agents/review
```

### 10.4 Artifact endpoints

```
GET  /api/artifacts
GET  /api/artifacts/{id}
POST /api/artifacts
```

### 10.5 Automation endpoints

```
GET   /api/automations
POST  /api/automations
PATCH /api/automations/{id}
```

### 10.6 Settings endpoints

```
GET   /api/settings
PATCH /api/settings
```

---

## 11. Deployment Architecture

### 11.1 Local development

Local development should run through Docker Compose and include:
- web
- api
- worker
- postgres
- redis
- qdrant

**Goals:**
- one-command startup
- reproducible local environment
- easy debugging
- no cloud dependency required for core development

### 11.2 Production deployment

Initial production should target a VPS and include:
- reverse proxy
- HTTPS
- persistent storage
- environment-based secret configuration
- backup strategy
- log collection

**Topology:**

```
[Internet]
   |
[Reverse Proxy]
   |
   +--> [Web]
   +--> [API]
   +--> [Worker]
   +--> [PostgreSQL]
   +--> [Redis]
   +--> [Qdrant]
   +--> [Object/File Storage]
```

---

## 12. Security Architecture

### 12.1 Local mode

- single-user
- secrets in environment variables
- no frontend secret exposure

### 12.2 Production mode

- authentication required
- backend-only API key usage
- file access restrictions
- audit-friendly logs for generation/indexing jobs
- no destructive actions without explicit control paths

---

## 13. Observability Architecture

The system should expose enough signals to debug AI and indexing workflows.

### 13.1 Minimum observability requirements

- structured logs
- request IDs
- job IDs
- document indexing status
- job status transitions
- error traces for failed parsing/indexing/generation

### 13.2 Later improvements

- latency metrics
- retrieval quality metrics
- token usage tracking
- artifact generation success metrics
- automation success/failure dashboards

---

## 14. Extension Strategy

### 14.1 AGENTS.md support

The system should later support repository- and workspace-level instructions through AGENTS.md-like files.

These instructions may modify:
- style
- constraints
- allowed actions
- required output format
- role behavior

This must be layered, not hardcoded.

### 14.2 MCP support

MCP integration should be added after the retrieval-centric core is stable.

Likely first integrations:
- local filesystem
- GitHub
- docs source connectors
- issue/task systems

MCP should extend the system, not replace internal retrieval.

### 14.3 Evaluation layer

A later evaluation subsystem should assess:
- retrieval relevance
- answer grounding
- hallucination rate
- artifact usefulness
- prompt stability

---

## 15. Main Risks

1. poor PDF and semi-structured parsing quality
2. weak chunking strategy
3. low-quality metadata design
4. over-engineering agent workflows too early
5. weak citation mapping
6. mixing orchestration and provider logic
7. lack of traceability in async jobs

---

## 16. Architectural Decisions

**Chosen now:**
- modular monolith
- Next.js frontend
- FastAPI backend
- worker for async processing
- PostgreSQL for structured state
- Qdrant for vectors
- Redis for job coordination
- role-based agents
- grounded RAG as the product core

**Explicitly postponed:**
- microservices
- advanced multi-user design
- uncontrolled autonomous agent graphs
- large integration surface
- complex knowledge graph UI
- heavy MCP usage before MVP

---

## 17. Recommended Repository Structure

```
apps/
  web/
  api/
  worker/

docs/
  PRD.md
  architecture.md
  roadmap.md

prompts/
  system/
  tasks/

.claude/
  skills/

infra/
  docker/
  nginx/

README.md
CLAUDE.md
AGENTS.md
docker-compose.yml
```

---

## 18. Summary

The architecture is centered on one core principle:

> Build a reliable knowledge ingestion and retrieval system first, then layer agent workflows, artifacts, automations, AGENTS.md support, and MCP integrations on top of that stable foundation.

This keeps the MVP realistic, the implementation clean, and the future roadmap open without sacrificing delivery speed.
