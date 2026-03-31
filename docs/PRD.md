# PRD — AI Second Brain for Developer / Architect

## 1. Product Overview

AI Second Brain for Developer / Architect is a personal AI-powered engineering workspace for storing, indexing, searching, analyzing, and transforming project knowledge.

The system helps a developer or architect work with engineering documentation such as:
- PRD
- ADR
- RFC
- README
- architecture notes
- API specs
- meeting notes
- design decisions
- technical investigations

The product combines:
- document ingestion
- semantic and hybrid retrieval
- grounded chat with citations
- role-based AI agents
- artifact generation
- scheduled automations
- future MCP-based integrations

---

## 2. Problem Statement

Engineering knowledge is fragmented across documents, markdown files, PDFs, notes, and ad hoc decisions. As a result:
- context is hard to find quickly
- decisions are forgotten
- documents contradict each other
- onboarding is slower
- AI assistants hallucinate when they lack grounded context
- there is no unified workspace for asking questions, generating artifacts, and tracking decisions

---

## 3. Target Users

### Primary
- solo developers
- backend/frontend/fullstack engineers
- software architects
- tech leads

### Secondary
- product managers
- business analysts
- QA leads in small teams

---

## 4. Product Vision

Create a personal engineering knowledge workspace where AI can:
- answer only from relevant sources
- cite supporting evidence
- summarize and compare documentation
- detect contradictions
- generate ADR drafts
- produce decision logs and digests
- later connect to external tools via MCP

---

## 5. Goals

### MVP Goals
1. Upload and store documents
2. Parse and index documents into a searchable knowledge base
3. Chat with the knowledge base using RAG
4. Return grounded answers with citations
5. Support basic role-based agents:
   - Analyst
   - Architect
   - Reviewer
6. Generate artifacts:
   - summary
   - comparison report
   - decision log
   - ADR draft
7. Run basic automations:
   - auto-index on upload
   - nightly digest
   - weekly summary

### Post-MVP Goals
1. Support MCP integrations
2. Support AGENTS.md / instruction layering
3. Add document connectors
4. Add team/multi-user mode
5. Add evaluation dashboard
6. Add knowledge graph

---

## 6. Non-Goals for MVP

The MVP will not include:
- collaborative document editing
- enterprise-grade RBAC
- advanced multi-user permissions
- full code execution agent
- complex live knowledge graph visualization
- many third-party integrations in the first release

---

## 7. User Stories

### Story 1 — Upload and Index
As a user, I want to upload project documents so that the system can index them and make them searchable.

### Story 2 — Ask Questions
As a user, I want to ask questions about my engineering documents and get grounded answers with citations.

### Story 3 — Compare Documents
As a user, I want to compare two or more documents and identify contradictions or inconsistencies.

### Story 4 — Generate ADR
As a user, I want to generate an ADR draft based on relevant documents and prior decisions.

### Story 5 — Weekly Summary
As a user, I want the system to generate a weekly digest of new knowledge, decisions, and open issues.

---

## 8. Functional Requirements

### 8.1 Document Ingestion
- Upload markdown, txt, pdf, docx, json, yaml, html
- Extract metadata
- Parse content
- Save original files
- Reindex documents
- Soft delete documents

### 8.2 Retrieval
- Semantic search
- Keyword + semantic hybrid retrieval
- Chunk-based retrieval
- Metadata filters
- Top-k retrieval
- Re-ranking
- Citation mapping to source chunks

### 8.3 Chat
- Workspace-level chat
- Conversation history
- Ask mode
- Summarize mode
- Compare mode
- Decision extraction mode
- ADR draft mode

### 8.4 Agents
- Analyst:
  - summarize
  - extract requirements
  - extract decisions
  - detect contradictions
- Architect:
  - compare technical options
  - produce trade-off analysis
  - generate ADR draft
- Reviewer:
  - critique outputs
  - identify risks
  - highlight missing assumptions

### 8.5 Artifacts
- Summary report
- Comparison report
- Decision log
- ADR draft
- Weekly digest

### 8.6 Automations
- Auto-index after upload
- Nightly digest
- Weekly summary
- Stale document detection

---

## 9. Non-Functional Requirements

### Performance
- Search should typically complete within 2–4 seconds
- Standard chat response should typically complete within 8–15 seconds
- Small to medium files should index reliably

### Reliability
- Retry failed indexing jobs
- Track job status
- Preserve chat and artifact history

### Security
- API keys remain on backend only
- Environment-based secret management
- Authentication required in production
- Logging of indexing and generation jobs

### Scalability
- Stateless API layer
- Dedicated async worker
- Dedicated vector store
- Object storage in production

### Observability
- Structured logs
- Request/job IDs
- Job status dashboard

---

## 10. Success Metrics

### Product Metrics
- At least 80% of answers contain citations
- At least 70% of sessions result in a useful answer or artifact
- Active user uses the system at least 3 times per week

### Technical Metrics
- Indexing success rate
- Retrieval quality on evaluation set
- Hallucination rate
- Response latency
- Automation success rate

---

## 11. Risks

1. Weak retrieval pipeline will reduce answer quality
2. Over-engineering multi-agent workflows too early
3. Low-quality parsing of PDFs and semi-structured documents
4. Excessive scope before the first usable MVP
5. Poor source grounding leading to hallucinated outputs

---

## 12. MVP Definition

A single user can upload engineering documents, ask grounded questions, receive citation-backed answers, run specialized analysis and architecture workflows, and store generated artifacts inside one workspace.