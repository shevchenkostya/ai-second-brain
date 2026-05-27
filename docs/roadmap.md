# Roadmap — AI Second Brain for Developer / Architect

## Product Delivery Strategy

Build the product in thin, useful vertical slices.
Do not try to implement the entire vision at once.

The first milestone must already feel usable:
- upload documents
- index them
- ask grounded questions
- get citations

After that, add agent workflows and automation value.

---

## Sprint 0 — Foundation

### Goal
Set up the repository, infrastructure, and development workflow.

### Deliverables
- monorepo or structured repo layout
- apps/web scaffold
- apps/api scaffold
- apps/worker scaffold
- docker-compose.yml
- PostgreSQL
- Redis
- Qdrant
- base environment files
- README with setup steps
- healthcheck endpoint
- linting and formatting

### Exit Criteria
- project starts locally with one command
- backend health endpoint works
- frontend shell loads
- infrastructure services are reachable

---

## Sprint 1 — Document Upload and Metadata

### Goal
Implement document registration and upload flow.

### Deliverables
- upload API endpoint
- local file storage
- document metadata persistence
- documents list UI
- document statuses:
  - uploaded
  - processing
  - indexed
  - failed

### Exit Criteria
- user can upload a file
- file is stored
- document record appears in UI
- metadata is persisted

---

## Sprint 2 — Parsing, Chunking, Embeddings

### Goal
Convert uploaded documents into searchable chunks.

### Deliverables
- parser registry
- parsers for md, txt, pdf, docx
- chunking pipeline
- embedding generation
- Qdrant indexing
- async indexing job
- reindex endpoint

### Exit Criteria
- uploaded document can be indexed
- chunks are visible in database
- embeddings are stored
- document can be reindexed

---

## Sprint 3 — RAG Chat MVP

### Goal
Ship the first useful end-to-end product slice.

### Deliverables
- chat UI
- chat API
- retrieval service
- grounded context builder
- answer persistence
- citations in responses
- chat history

### Exit Criteria
- user can ask a question about uploaded docs
- answer is grounded in retrieved chunks
- citations are returned and shown in UI
- conversation history is saved

---

## Sprint 4 — Analyst Agent

### Goal
Add structured analysis workflows beyond chat.

### Deliverables
- summarize mode
- compare mode
- decision extraction mode
- contradiction detection mode
- structured output schemas
- artifact persistence

### Exit Criteria
- user can generate summary artifacts
- user can compare documents
- user can extract decisions
- results are saved as artifacts

---

## Sprint 5 — Architect and Reviewer Agents

### Goal
Add architecture-focused generation and critique.

### Deliverables
- Architect agent
- Reviewer agent
- ADR draft generation
- trade-off report generation
- risk review output
- artifact detail UI

### Exit Criteria
- user can generate an ADR draft
- user can request critique of generated output
- architecture artifacts are saved and viewable

---

## Sprint 6 — Automations

### Goal
Add recurring value through scheduled workflows.

### Deliverables
- nightly digest job
- weekly summary job
- stale documents report
- jobs dashboard
- job retry support

### Exit Criteria
- scheduled jobs execute
- generated digest artifacts are stored
- user can inspect job status in UI

---

## Sprint 7 — AGENTS.md and Prompt Layering

### Goal
Make agent behavior configurable and repository-aware.

### Deliverables
- AGENTS.md support
- instruction layering design
- workspace-level instructions
- role-specific prompt templates
- instruction loading flow

### Exit Criteria
- AGENTS.md can influence agent behavior
- agent prompts are modular and versionable
- instruction precedence is explicit

---

## Sprint 8 — Production Readiness and MCP Foundation

### Goal
Prepare the application for VPS deployment and future integrations.

### Deliverables
- production docker setup
- reverse proxy config
- authentication
- persistent volumes
- deployment documentation
- MCP client integration foundation
- one initial MCP integration

### Exit Criteria
- application can be deployed to a VPS
- production environment variables are documented
- at least one MCP path is designed or implemented

---

## Sprint 9 — Full Auth System & User Management

### Goal
Implement production-grade authentication: refresh tokens, email verification, password reset, user blocking, role-based access, and admin panel.

### Deliverables
- Refresh token rotation (30-day, stored as SHA-256 hash)
- Email verification flow (token sent on registration)
- Password reset via email link
- Password change for authenticated users
- User blocking / deactivation by admin
- Role system: `user` / `admin`
- Admin panel: list, block, promote, delete users, force-verify email
- First admin bootstrap via environment variables
- SMTP email service (dev: stdout, prod: SMTP)
- Auto-refresh of access token on 401 in frontend
- New pages: `/settings`, `/forgot-password`, `/reset-password`, `/verify-email`, `/admin/users`

### Exit Criteria
- Register → receive verification email → click link → email verified
- Forgot password → email → reset link → new password works
- Admin can block user → blocked user cannot login
- Admin panel visible only to users with `role=admin`
- Refresh token rotates on each use; old token is rejected
- All new flows covered by tests

---

## MVP Scope Summary

The MVP is complete when the user can:
1. create a workspace
2. upload engineering documents
3. index documents
4. search and chat over indexed content
5. receive answers with citations
6. generate at least one type of useful artifact
7. run at least one structured agent workflow

---

## Scope Rules

### Must have
- upload
- indexing
- retrieval
- citations
- chat
- artifact persistence
- one useful agent workflow

### Should have
- compare mode
- ADR draft generation
- weekly digest
- reviewer workflow

### Could have
- AGENTS.md support
- MCP integration
- advanced filters
- evaluation tooling

---

## Risk Management Rules

- Retrieval quality is more important than agent complexity
- Parsing reliability is more important than fancy UI
- End-to-end usefulness is more important than architecture purity
- Working vertical slices are preferred over broad incomplete modules

---

## Delivery Principle

Every sprint should end with something demonstrable, even if internal quality and scope are still evolving.