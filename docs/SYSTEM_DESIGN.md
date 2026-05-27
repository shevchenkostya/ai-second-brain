# System Design — AI Second Brain

## 1. Что это за продукт

AI Second Brain — персональное AI-рабочее пространство для разработчиков и архитекторов. Пользователь загружает свои документы (технические спецификации, RFC, заметки, код, архитектурные решения) и получает три инструмента поверх них:

- **RAG-чат** — задаёт вопросы, получает ответы строго на основе своих документов с цитатами
- **Analyst Agent** — автоматический анализ: резюме, сравнение, извлечение решений, поиск противоречий
- **Architect / Reviewer Agents** — ADR, Tech Radar, Risk Analysis, System Design, Code Review, Doc Review, PR Summary

Целевая аудитория: индивидуальные разработчики и небольшие команды, которые хотят сделать свою документацию «живой» и интерактивной.

---

## 2. Архитектура MVP (текущее состояние)

```
┌─────────────────────────────────────────────────────────┐
│                     Browser (Next.js)                   │
│   /documents   /chat/[id]   /artifacts   /artifacts/[id]│
└────────────────────────┬────────────────────────────────┘
                         │ HTTP
┌────────────────────────▼────────────────────────────────┐
│                  API (FastAPI, port 4000)                │
│  /api/documents  /api/chats  /api/artifacts              │
│                                                         │
│  services/                                              │
│  ├── document.py    — upload, status, CRUD              │
│  ├── chat.py        — create, send message, history     │
│  ├── analyst.py     — load chunks → LLM → artifact      │
│  ├── retrieval.py   — embed query → search Qdrant       │
│  └── llm.py         — Anthropic / Ollama / Mock         │
└──────┬──────────────────────┬───────────────────────────┘
       │ enqueue_job           │ async DB queries
       │                       │
┌──────▼──────┐   ┌────────────▼───────────┐
│    Redis     │   │    PostgreSQL           │
│  (arq queue) │   │  workspaces            │
└──────┬──────┘   │  documents             │
       │           │  document_chunks       │
┌──────▼──────┐   │  chats                 │
│   Worker     │   │  messages              │
│ (arq, async) │   │  artifacts             │
│              │   │  jobs (reserved)       │
│ index_document│  │  automations (reserved)│
│  → parse     │   └────────────────────────┘
│  → chunk     │
│  → embed     │   ┌────────────────────────┐
│  → Qdrant    │   │    Qdrant              │
│  → DB update │──►│  collection: documents │
└─────────────┘   │  distance: cosine      │
                   │  dim: 1536             │
                   └────────────────────────┘
```

### Сервисы

| Сервис | Технология | Порт | Назначение |
|--------|-----------|------|-----------|
| web | Next.js 14, TypeScript, Tailwind | 3000 | UI |
| api | FastAPI, asyncpg, SQLAlchemy | 4000 | REST API, бизнес-логика |
| worker | arq (async Redis Queue) | — | Фоновая индексация |
| db | PostgreSQL 16 | 5432 (internal) | Основное хранилище |
| redis | Redis 7 | 6379 (internal) | Очередь задач |
| qdrant | Qdrant latest | 6333 (internal) | Векторный поиск |

---

## 3. Модели данных

### workspaces
Контейнер верхнего уровня. В MVP — один workspace на инстанс.

```
id          UUID PK
name        VARCHAR(255)
description TEXT
created_at  TIMESTAMPTZ
```

### documents
```
id           UUID PK
workspace_id UUID FK → workspaces (CASCADE)
title        VARCHAR(500)
source_type  VARCHAR(50)   -- md, txt, pdf, docx, json, yaml, html
mime_type    VARCHAR(100)
file_path    TEXT          -- путь к файлу на диске
checksum     VARCHAR(64)   -- SHA-256, для дедупликации
status       VARCHAR(50)   -- uploaded → queued → processing → indexed | failed
created_at   TIMESTAMPTZ
updated_at   TIMESTAMPTZ
```

### document_chunks
```
id           UUID PK
document_id  UUID FK → documents (CASCADE)
chunk_index  INTEGER
text         TEXT
token_count  INTEGER       -- приблизительно (символы / 4)
metadata_json JSON
vector_ref   VARCHAR(255)  -- ID точки в Qdrant
created_at   TIMESTAMPTZ
```

### chats / messages
```
chats:
  id, workspace_id FK, title, created_at

messages:
  id, chat_id FK, role (user|assistant), content TEXT,
  citations_json JSON,  -- [{chunk_id, document_id, document_title, text, score}]
  created_at
```

### artifacts
```
id              UUID PK
workspace_id    UUID FK → workspaces (CASCADE)
artifact_type   VARCHAR(100)  -- 11 режимов (summarize, adr, code_review, ...)
title           VARCHAR(500)
content         TEXT          -- Markdown
source_refs_json JSON         -- [document_id, ...]
created_at      TIMESTAMPTZ
```

### users (расширено в Sprint 9)
```
id                UUID PK
email             VARCHAR(255) UNIQUE
password_hash     VARCHAR(255)   -- bcrypt
role              VARCHAR(20)    -- 'user' | 'admin'
is_active         BOOLEAN        -- false = заблокирован
email_verified    BOOLEAN
email_verified_at TIMESTAMPTZ
created_at        TIMESTAMPTZ
```

### refresh_tokens
```
id          UUID PK
user_id     UUID FK → users (CASCADE)
token_hash  VARCHAR(64) UNIQUE  -- SHA-256 от raw токена, не сам токен
expires_at  TIMESTAMPTZ
revoked     BOOLEAN             -- true после использования (rotation)
created_at  TIMESTAMPTZ
```

### email_tokens
```
id          UUID PK
user_id     UUID FK → users (CASCADE)
token_hash  VARCHAR(64) UNIQUE
type        VARCHAR(30)   -- 'verify_email' | 'reset_password'
expires_at  TIMESTAMPTZ
used_at     TIMESTAMPTZ   -- NULL = не использован
created_at  TIMESTAMPTZ
```

### mcp_tokens
```
id            UUID PK
user_id       UUID FK → users (CASCADE)
provider      VARCHAR(50)  -- 'google_drive'
access_token  TEXT
refresh_token TEXT
expires_at    TIMESTAMPTZ
created_at / updated_at TIMESTAMPTZ
UNIQUE(user_id, provider)
```

### jobs / automations (зарезервированы в миграции, не используются в MVP)
```
jobs:
  id, workspace_id, job_type, status, payload_json, result_json,
  created_at, updated_at

automations:
  id, workspace_id, automation_type, schedule, enabled,
  config_json, created_at, updated_at
```

---

---

## 4. Система авторизации (Sprint 9)

### Схема токенов

```
Регистрация / Логин
  → access_token  (15 мин, JWT, подписан SECRET_KEY)
  → refresh_token (30 дней, random bytes, хранится как SHA-256 хэш в БД)
  Оба хранятся в localStorage на клиенте

Каждый API-запрос:
  Authorization: Bearer <access_token>

access_token истёк (401):
  Frontend → POST /api/auth/refresh { refresh_token }
  → новые access_token + refresh_token
  → старый refresh_token помечается revoked=true (rotation)

Логаут:
  POST /api/auth/logout { refresh_token }
  → refresh_token revoked=true в БД
  → clearToken() на клиенте
```

### Роли
- `user` — стандартный доступ к своему workspace
- `admin` — дополнительно: `/api/admin/*` (управление пользователями)

### Email флоу
```
Регистрация → create_email_token(type='verify_email') → письмо со ссылкой
Ссылка: /verify-email?token=<raw_token>
Frontend → POST /api/auth/verify-email { token }
→ token_hash найден, не использован, не просрочен
→ user.email_verified = true, token.used_at = now()

Забыли пароль → POST /api/auth/forgot-password { email }
→ create_email_token(type='reset_password') → письмо
→ всегда 200 (не раскрываем существование email)
Ссылка: /reset-password?token=<raw_token>
→ POST /api/auth/reset-password { token, new_password }
→ token consumed, password_hash обновлён
```

### Bootstrap первого admin
При старте API — если `FIRST_ADMIN_EMAIL` задан и в БД нет ни одного admin,
создаётся или обновляется пользователь с `role='admin'` и `email_verified=true`.

---

## 5. Ключевые потоки данных

### 4.1 Загрузка и индексация документа

```
User uploads file
      │
      ▼
POST /api/documents/upload
  1. Сохранить файл на диск (/app/uploads/)
  2. Создать запись Document(status="queued") в PostgreSQL
  3. Поставить задачу в Redis: arq_pool.enqueue_job("index_document", doc_id)
  4. Вернуть 201 с DocumentOut
      │
      ▼ (async, в Worker)
index_document(doc_id)
  1. Загрузить Document из PostgreSQL, status → "processing"
  2. Парсинг файла (python-docx, PyPDF2, markdown, plain text)
  3. Нарезка на чанки (chunk_size=1000 символов, overlap=200, по абзацам)
  4. Генерация эмбеддингов (OpenAI text-embedding-3-small / mock)
  5. Сохранить DocumentChunk[] в PostgreSQL
  6. Upsert векторов в Qdrant (payload: document_id, chunk_id, text preview)
  7. status → "indexed"
```

### 4.2 RAG-чат (вопрос → ответ)

```
User sends message
      │
      ▼
POST /api/chats/{chat_id}/messages
  1. Сохранить Message(role="user") в PostgreSQL
  2. retrieve_chunks(query):
     a. Embed query → вектор (OpenAI / mock)
     b. Qdrant search (top_k=5, cosine)
     c. Fetch chunk text + document titles из PostgreSQL
  3. Собрать контекст из чанков
  4. generate_answer(query, citations):
     - Anthropic Claude Haiku / Ollama / Mock
     - System prompt: отвечай ТОЛЬКО на основе контекста
  5. Сохранить Message(role="assistant", citations_json=[...])
  6. Вернуть MessageOut с citations
```

### 4.3 Анализ документов (Artifact)

```
User selects documents + mode
      │
      ▼
POST /api/artifacts/analyze
  1. Для каждого document_id:
     - Загрузить Document из PostgreSQL
     - Загрузить до 25 DocumentChunk (max 12 000 символов)
  2. Собрать контекст: "=== Document: {title} ===\n{content}"
  3. generate_analysis(mode, documents):
     - Выбрать system prompt по mode (11 вариантов)
     - Anthropic / Ollama / Mock
  4. Создать Artifact(type=mode, content=markdown, source_refs=[ids])
  5. Сохранить в PostgreSQL
  6. Вернуть ArtifactOut
```

---

## 5. LLM-провайдеры

Система поддерживает три провайдера, переключаемых через `LLM_PROVIDER` в `.env.local`:

| Провайдер | Переменные | Модель | Когда использовать |
|-----------|-----------|--------|-------------------|
| `mock` | — | — | Разработка без API-ключей |
| `anthropic` | `ANTHROPIC_API_KEY` | claude-haiku-4-5 | Продакшн, высокое качество |
| `ollama` | `OLLAMA_URL`, `OLLAMA_MODEL` | llama3.2:3b (или любая) | Self-hosted, приватность |

Аналогично для эмбеддингов (`EMBEDDING_PROVIDER`):
- `mock` — детерминированные векторы на SHA-256 (для разработки)
- `openai` — text-embedding-3-small, 1536 dim (продакшн)

---

## 6. API — полный список эндпоинтов

| Метод | Путь | Описание |
|-------|------|---------|
| GET | /health | Health check + DB connectivity |
| POST | /api/documents/upload | Загрузить документ |
| GET | /api/documents | Список документов |
| GET | /api/documents/{id} | Метаданные документа |
| GET | /api/documents/{id}/chunks | Чанки документа |
| POST | /api/documents/{id}/reindex | Переиндексировать документ |
| DELETE | /api/documents/{id} | Удалить документ |
| GET | /api/chats | Список чатов |
| POST | /api/chats | Создать чат |
| GET | /api/chats/{id} | Чат с историей сообщений |
| DELETE | /api/chats/{id} | Удалить чат |
| POST | /api/chats/{id}/messages | Отправить сообщение (RAG) |
| POST | /api/artifacts/analyze | Запустить анализ документов |
| GET | /api/artifacts | Список артефактов |
| GET | /api/artifacts/{id} | Артефакт с контентом |
| DELETE | /api/artifacts/{id} | Удалить артефакт |

---

## 7. Инфраструктура MVP

Весь стек запускается через Docker Compose на одной машине:

```
docker-compose.yml
├── web        (Next.js, build from ./apps/web)
├── api        (FastAPI, build from ./apps/api)
│              volumes: uploads_data:/app/uploads
├── worker     (arq, build from ./apps/worker)
│              volumes: uploads_data:/app/uploads  ← shared с api
├── db         (postgres:16)
│              volumes: postgres_data
├── redis      (redis:7-alpine)
│              volumes: redis_data
└── qdrant     (qdrant/qdrant:latest)
               volumes: qdrant_data
```

Миграции запускаются автоматически при старте API через `alembic upgrade head`.

---

## 8. Что нужно изменить для продакшн-деплоя

MVP работает на одной машине без аутентификации. Для того чтобы деплоить продукт и продавать его, нужно решить следующие проблемы.

### 8.1 Аутентификация и multi-tenancy

**Сейчас:** один workspace, нет пользователей, нет авторизации.

**Нужно:**
- Добавить таблицу `users` (id, email, password_hash, plan, created_at)
- Связать `workspaces` с `users` (один пользователь — один или несколько workspace)
- JWT-аутентификация (FastAPI + python-jose или Better Auth на фронте)
- Middleware для проверки владения ресурсами (`workspace_id` должен принадлежать текущему юзеру)

**Вариант:** использовать Clerk, Auth0 или Supabase Auth — минимум кода, быстрый запуск.

### 8.2 Хранение файлов

**Сейчас:** файлы хранятся на диске в Docker volume `uploads_data`.

**Проблема:** при горизонтальном масштабировании API и Worker нужен shared storage. Volume работает только на одном хосте.

**Нужно:** S3-совместимое хранилище (AWS S3, Cloudflare R2, MinIO self-hosted). Изменений в коде минимум — заменить `file_path` на S3 key и добавить boto3/httpx-загрузку.

### 8.3 Разделение сервисов

**Сейчас:** всё на одной машине.

**Для деплоя:**
- API и Worker можно вынести на отдельные VPS или в Kubernetes
- PostgreSQL → managed (Supabase, Railway, RDS)
- Redis → managed (Upstash, Redis Cloud)
- Qdrant → managed (Qdrant Cloud) или отдельный VPS

**Минимальная схема для старта продаж (один VPS ~$20-40/мес):**
```
VPS (4 CPU, 8GB RAM)
├── Nginx (reverse proxy, SSL termination)
├── API (uvicorn, 2-4 workers)
├── Worker (1-2 процесса)
├── PostgreSQL
├── Redis
└── Qdrant
```

### 8.4 Биллинг и ограничения

**Нужно для SaaS:**
- Таблица `plans` (free / pro / team) с лимитами
- Счётчики: документов, чанков, запросов к LLM, артефактов
- Middleware для проверки лимитов перед тяжёлыми операциями
- Stripe интеграция для оплаты
- Webhook от Stripe → обновление плана пользователя

### 8.5 Мониторинг и надёжность

**Минимальный набор:**
- Structured logging (уже есть через Python logging, нужен JSON-формат и агрегатор — Loki / Datadog)
- Health endpoint уже есть (`/health`)
- Метрики: время ответа API, размер очереди Worker, количество ошибок индексации
- Alerting: если Worker упал или очередь растёт — Telegram / PagerDuty

### 8.6 Безопасность

| Уязвимость | Статус | Решение |
|-----------|--------|---------|
| Нет аутентификации | ⚠️ Критично для продакшн | JWT + middleware |
| API ключи в `.env.local` | ✅ Норм для VPS | Secrets manager (Vault / AWS Secrets) для команды |
| CORS разрешён для `*` | ⚠️ Нужно ограничить | Явный whitelist доменов |
| Upload — нет проверки размера | ⚠️ | Лимит на размер файла (текущий стек принимает любой файл) |
| PostgreSQL без SSL | ⚠️ Для managed DB | Включить SSL в DATABASE_URL |

---

## 9. Масштабирование

### Узкие места при росте нагрузки

**Worker** — самое медленное звено. Индексация одного DOCX на 100 страниц занимает 5-30 секунд. При 100 пользователях очередь начнёт расти.

Решение: запустить несколько Worker-процессов (arq поддерживает конкурентность из коробки). Лимитирующий фактор — скорость OpenAI Embeddings API.

**Qdrant** — хорошо масштабируется горизонтально. При > 1М чанков — переходить на Qdrant Cloud с шардированием.

**PostgreSQL** — для MVP запаса хватит до ~100K пользователей. Далее — read replicas для запросов на чтение.

**LLM (Anthropic)** — rate limits. При высокой нагрузке — очередь запросов к LLM, приоритизация, retry с exponential backoff.

### Примерные пороги

| Нагрузка | Архитектура | Стоимость |
|---------|------------|----------|
| 1-50 пользователей | Один VPS | ~$20-40/мес |
| 50-500 пользователей | VPS x2 + managed DB/Redis | ~$100-200/мес |
| 500-5000 пользователей | Kubernetes / ECS + managed всё | ~$500-1500/мес |

---

## 10. Roadmap к продакшну

Приоритизированный список того, что нужно сделать до первых платящих пользователей:

### Обязательно (до запуска)
1. **Аутентификация** — JWT или Clerk, связь с workspace
2. **Ограничение CORS** — убрать wildcard `*`
3. **Лимит на размер загружаемых файлов** — middleware
4. **SSL/HTTPS** — Nginx + Let's Encrypt
5. **Переменные окружения** — вынести все секреты из `.env.local` в secrets manager или хотя бы не коммитить

### Желательно (первые 30 дней после запуска)
6. **S3 для файлов** — Cloudflare R2 (дешевле S3, бесплатный egress)
7. **Structured logging + агрегация** — чтобы видеть ошибки пользователей
8. **Email-нотификации** — "индексация завершена", "анализ готов"
9. **Биллинг** — Stripe, даже простой free/pro

### Хорошо иметь (квартал 2)
10. **Automations** — периодический пересбор, scheduled анализ
11. **MCP интеграции** — GitHub, Notion, Confluence как источники документов
12. **Reviewer Agent** — CI/CD интеграция, авто-ревью при PR
13. **Workspace sharing** — командные функции

---

## 11. Текущий технологический стек (итог)

| Слой | Технология | Версия |
|------|-----------|--------|
| Frontend | Next.js | 14 |
| UI | Tailwind CSS, shadcn/ui | — |
| State | TanStack Query, Zustand | — |
| Backend | FastAPI | 0.115 |
| ORM | SQLAlchemy (async) | 2.0 |
| Migrations | Alembic | 1.13 |
| DB driver | asyncpg | 0.29 |
| Job queue | arq | 0.26 |
| Database | PostgreSQL | 16 |
| Cache/Queue | Redis | 7 |
| Vector DB | Qdrant | latest |
| LLM | Anthropic Claude Haiku / Ollama | — |
| Embeddings | OpenAI text-embedding-3-small / mock | — |
| Infra | Docker Compose | — |
| Tests | pytest, pytest-asyncio, httpx | — |
