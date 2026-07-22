# JD-Clone 电商平台项目

> 一个复刻京东（JD.com）业务生态的大规模全栈电商项目
> 覆盖 用户 Web / Android App / 商家后台 / 管理员后台 四端 + FastAPI 后端

## 📚 项目文档索引

| 文档 | 用途 |
|---|---|
| [`docs/DEVELOPMENT_PLAN.md`](docs/DEVELOPMENT_PLAN.md) | **开发规划流程文档** — 项目愿景、业务范围、技术选型、架构、阶段划分、验收标准 |
| [`AGENTS.md`](AGENTS.md) | **多智能体协作与开发规范** — Git 工作流、分支职责、Agent 分工、Skills 清单 |

## 🎯 项目核心理念

> **做深做透，而非做多做浅**

- 不追求功能数量，而追求每个业务模块的**真实深度**
- 每个功能都要覆盖：**正常流程 + 异常流程 + 三方角色（用户/商家/管理员）联动**
- 可选模块（如支付）可简化模拟；一旦决定实现的模块，必须扎实

## 🛠 技术栈概览

| 端 | 技术 |
|---|---|
| 后端 | FastAPI + SQLAlchemy 2.0 (async) + PostgreSQL 16 + Redis |
| 用户 Web / 商家后台 / 管理员后台 | Next.js 15 + React 19 + Tailwind CSS 4 |
| Android App | Kotlin + Jetpack Compose + Retrofit |
| 基础设施 | Docker Compose + GitHub Actions + Nginx |

## 🚀 快速开始

```bash
# 1. 复制环境变量
cp .env.example .env

# 2. 启动基础设施 + 后端
docker-compose up -d postgres redis minio minio-init
# 或全部（含后端）
docker-compose up -d

# 3. 后端（本地开发，不走 docker）
cd backend
uv sync --all-extras
uv run alembic upgrade head    # 首次运行前
uv run uvicorn app.main:app --reload
# 后端在 http://localhost:8000  Swagger: /docs

# 4. 前端（在项目根目录）
pnpm install
pnpm dev:user-web     # http://localhost:3000  普通用户购物端
pnpm dev:merchant     # http://localhost:3001  商家后台
pnpm dev:admin        # http://localhost:3002  管理员后台

# 5. Android
# 用 Android Studio 打开 android-app/，首次加载会自动生成 gradle wrapper
# 或命令行：cd android-app && gradle wrapper --gradle-version 8.10.2 && ./gradlew assembleDebug
```

## 📁 目录结构

```
e_commerce_project_claude/
├── backend/                # FastAPI 后端
├── frontend-user-web/      # 用户 Web
├── frontend-merchant/      # 商家后台
├── frontend-admin/         # 管理员后台
├── android-app/            # Android 客户端
├── infra/                  # Docker / CI 配置
├── docs/                   # 全局文档
│   ├── DEVELOPMENT_PLAN.md
│   ├── CHANGELOG.md
│   ├── DECISIONS/          # ADR
│   └── UX_ISSUES.md
├── AGENTS.md               # 多智能体协作规范
└── README.md
```

## 🔀 Git 工作流

- `main`：受保护，仅接受 `release/*` 和 `hotfix/*`
- `develop`：集成分支
- `feature/<scope>-<name>`：功能分支（`scope` = backend / user-web / merchant / admin / android）
- **每完成一个 Phase 必须推送到远端并打 Tag**

详见 [AGENTS.md](AGENTS.md) 第 2 节。

## 🧠 Multi-Agent 开发模式

本项目采用 Multi-Agent 并行开发：
- **Orchestrator**（主 Claude）统筹分派
- 各端由独立 Agent 负责（Backend / User-Web / Merchant / Admin / Android）
- Explorer / Reviewer / Security / Test / Docs Agent 提供横向支持

详见 [AGENTS.md](AGENTS.md) 第 3-4 节。

---

**License**：本项目为学习性质，不用于商业用途。
