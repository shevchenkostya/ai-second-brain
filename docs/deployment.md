# Deployment Guide — AI Second Brain

## Prerequisites

- VPS with Ubuntu 22.04+ (minimum 2 GB RAM, 20 GB disk)
- Docker Engine 24+ and Docker Compose v2 installed
- A domain name pointing to the VPS IP (A record)
- Ports 80 and 443 open in the firewall

### Install Docker (if not installed)

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
```

---

## 1. Clone the Repository

```bash
git clone <your-repo-url> ai-second-brain
cd ai-second-brain
```

---

## 2. Configure Environment

```bash
cp .env.prod.example .env.prod
nano .env.prod
```

Fill in all required values:

| Variable | Description |
|----------|-------------|
| `DOMAIN` | Your domain, e.g. `brain.example.com` |
| `POSTGRES_USER` | Database username |
| `POSTGRES_PASSWORD` | Strong database password |
| `POSTGRES_DB` | Database name |
| `DATABASE_URL` | Full asyncpg connection string (must match above) |
| `SECRET_KEY` | JWT signing secret — generate with `python -c "import secrets; print(secrets.token_hex(32))"` |
| `ANTHROPIC_API_KEY` | Anthropic API key (if using Claude) |
| `OPENAI_API_KEY` | OpenAI API key (if using OpenAI embeddings) |
| `LLM_PROVIDER` | `anthropic`, `ollama`, or `mock` |
| `EMBEDDING_PROVIDER` | `openai` or `mock` |

> **Security:** Never commit `.env.prod` to version control. Add it to `.gitignore`.

---

## 3. Build and Start

```bash
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

This starts all services:
- `caddy` — reverse proxy with automatic HTTPS via Let's Encrypt
- `web` — Next.js frontend
- `api` — FastAPI backend (runs Alembic migrations on startup)
- `worker` — arq background worker
- `db` — PostgreSQL
- `redis` — Redis
- `qdrant` — Vector store

---

## 4. Verify

```bash
# Check all containers are running
docker compose -f docker-compose.prod.yml ps

# Check API health
curl https://yourdomain.com/api/health

# Check logs
docker compose -f docker-compose.prod.yml logs -f api
```

Expected health response:
```json
{"status": "ok"}
```

---

## 5. Database Migrations

Migrations run automatically on `api` container startup via Alembic. To run manually:

```bash
docker compose -f docker-compose.prod.yml exec api alembic upgrade head
```

---

## 6. Updates

```bash
git pull

docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

Alembic migrations run automatically on next `api` startup.

---

## 7. Backups

### PostgreSQL

```bash
# Dump
docker compose -f docker-compose.prod.yml exec db \
  pg_dump -U $POSTGRES_USER $POSTGRES_DB > backup_$(date +%Y%m%d).sql

# Restore
docker compose -f docker-compose.prod.yml exec -T db \
  psql -U $POSTGRES_USER $POSTGRES_DB < backup_20240101.sql
```

### Uploaded Files

The `uploads_data` Docker volume contains all user-uploaded files.

```bash
docker run --rm \
  -v ai-second-brain_uploads_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/uploads_$(date +%Y%m%d).tar.gz /data
```

---

## 8. Stopping and Removing

```bash
# Stop (keeps data)
docker compose -f docker-compose.prod.yml down

# Stop and remove all volumes (DELETES ALL DATA)
docker compose -f docker-compose.prod.yml down -v
```

---

## Troubleshooting

**Caddy can't get a TLS certificate**
- Verify DNS A record points to the VPS IP: `dig yourdomain.com`
- Ports 80 and 443 must be open and not used by another process
- Check Caddy logs: `docker compose -f docker-compose.prod.yml logs caddy`

**API fails to start**
- Check DB is healthy: `docker compose -f docker-compose.prod.yml ps db`
- Check for migration errors: `docker compose -f docker-compose.prod.yml logs api`

**Frontend shows "Cannot connect to API"**
- Verify `API_URL=http://api:4000` in `.env.prod` (internal Docker network)
- Verify `NEXT_PUBLIC_API_URL=https://yourdomain.com` matches your domain

**Worker not processing jobs**
- Check Redis connection: `docker compose -f docker-compose.prod.yml logs worker`
- Verify `REDIS_URL=redis://redis:6379` in `.env.prod`
