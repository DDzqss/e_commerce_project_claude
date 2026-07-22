# JD-Clone Backend

FastAPI-based backend service for the JD-Clone e-commerce platform.

## Tech Stack

- **Framework**: FastAPI 0.115+ (async)
- **ORM**: SQLAlchemy 2.0 (async) + Alembic
- **Database**: PostgreSQL 16+
- **Cache / KV**: Redis
- **Object Storage**: MinIO (S3-compatible)
- **Auth**: JWT (access + refresh) with Redis blacklist
- **Package Manager**: [uv](https://github.com/astral-sh/uv)
- **Python**: 3.12

## Directory Layout

```
backend/
├── app/
│   ├── api/
│   │   └── v1/
│   │       ├── user/          # User-facing endpoints
│   │       ├── merchant/      # Merchant-facing endpoints
│   │       ├── admin/         # Admin-facing endpoints
│   │       └── common/        # Shared endpoints (health, meta)
│   ├── core/                  # Config, security, DB engine
│   ├── models/                # SQLAlchemy ORM models
│   ├── schemas/               # Pydantic request/response schemas
│   ├── services/              # Business logic
│   ├── repositories/          # Data-access layer
│   ├── workers/               # Async / background jobs
│   ├── utils/                 # Helpers
│   └── main.py                # FastAPI app entrypoint
├── alembic/                   # DB migrations
├── tests/                     # Pytest suite
├── pyproject.toml
├── alembic.ini
├── Dockerfile
├── .env.example
└── README.md
```

## Getting Started

### 1. Install dependencies

```bash
uv sync --all-extras
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env: fill in DATABASE_URL, REDIS_URL, SECRET_KEY, ...
```

### 3. Run database migrations

```bash
uv run alembic upgrade head
```

### 4. Start the dev server

```bash
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Then visit:

- Health check: <http://localhost:8000/health>
- OpenAPI docs: <http://localhost:8000/docs>
- ReDoc: <http://localhost:8000/redoc>

## Common Commands

```bash
# Lint & format
uv run ruff check .
uv run ruff format .

# Type check
uv run mypy app

# Run tests
uv run pytest -v

# Create a new migration (autogenerate from model diff)
uv run alembic revision --autogenerate -m "add order table"

# Apply migrations
uv run alembic upgrade head

# Rollback one migration
uv run alembic downgrade -1
```

## API Conventions

- All routes are versioned: `/api/v1/{scope}/{resource}`
- Unified response envelope: `{ "code": 0, "message": "ok", "data": ... }`
- Pagination via `?page=1&size=20`
- Idempotent write operations accept `Idempotency-Key` header

See `docs/DEVELOPMENT_PLAN.md` §10 for full API rules.

## Docker

Build the image:

```bash
docker build -t jd-clone-backend .
```

For the full local stack (Postgres + Redis + MinIO), use the root `docker-compose.yml`.
