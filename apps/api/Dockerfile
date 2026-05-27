FROM python:3.12-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

FROM base AS builder

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM base AS runner

RUN addgroup --system app && adduser --system --ingroup app app && \
    mkdir -p /app/uploads && chown app:app /app/uploads

COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

COPY --chown=app:app . .

RUN chown app:app /app/uploads

USER app

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:4000/health')"

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "4000"]
