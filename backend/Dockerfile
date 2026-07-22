# syntax=docker/dockerfile:1.7

# ---------------------------------------------------------------------------
# Stage 1: builder — install deps via uv into a self-contained venv
# ---------------------------------------------------------------------------
FROM python:3.12-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    UV_PROJECT_ENVIRONMENT=/opt/venv

# Install uv from the official distroless image
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

# System build deps for wheels that need compilation (bcrypt, cryptography, asyncpg)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency manifests first for cache-friendly rebuilds
COPY pyproject.toml ./
# Lockfile is optional at this stage — copy if present
COPY uv.loc[k] ./

# Create the venv and install runtime deps (no dev extras)
RUN uv venv /opt/venv --python 3.12 \
    && uv sync --no-dev --no-install-project

# Copy the app source and install the project itself
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./
RUN uv sync --no-dev

# ---------------------------------------------------------------------------
# Stage 2: runtime — minimal image with the prebuilt venv
# ---------------------------------------------------------------------------
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH" \
    VIRTUAL_ENV=/opt/venv

# Runtime libs (libpq for asyncpg is not strictly required, but useful for psql tooling)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system app \
    && useradd --system --gid app --home /app --shell /usr/sbin/nologin app

WORKDIR /app

COPY --from=builder /opt/venv /opt/venv
COPY --from=builder /app /app

USER app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -fsS http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
