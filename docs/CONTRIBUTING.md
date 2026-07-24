# 贡献指南 · JD-Clone

> 本文档面向新加入的协作者（人类 or AI Agent）。目标：**30 分钟内跑起完整开发环境并提交第一个 PR**。
> 强制规范以 [AGENTS.md](../AGENTS.md) 为准，本文档是操作手册。

---

## 1. 分支策略

**GitFlow 简化版**（详见 [AGENTS.md §2.2](../AGENTS.md#22-分支策略gitflow-简化版)）：

```
main               受保护，只接受 release/* 和 hotfix/*
  ↑
release/vX.Y.0     发布前稳定分支
  ↑
develop            集成分支
  ↑
feature/<scope>-<name>   功能分支（推荐一 phase 一大 feature 分支或多细分）
```

**分支命名**：`feature/backend-*` · `feature/user-web-*` · `feature/merchant-*` · `feature/admin-*` · `feature/android-*` · `fix/*` · `docs/*` · `chore/*`。

**保护规则**：`main` / `develop` 禁止直推，必须 PR + CI 全绿 + review approval。

---

## 2. Commit 规范（Conventional Commits）

```
<type>(<scope>): <subject>

<body（可选）>

Refs: #<issue>
```

| type | 用途 |
|---|---|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 文档 |
| `refactor` | 重构 |
| `test` | 测试 |
| `chore` | 构建 / 依赖 |
| `perf` | 性能 |
| `style` | 代码风格（不影响功能） |

**scope 常用**：`backend` · `user-web` · `merchant` · `admin` · `android` · `api` · `db` · `phase-N`

**示例**：
```
feat(backend): 新增售后仲裁的强制退款端点

- 支持客服强制退款绕过商家审核
- 金额校验 ≤ 订单可退金额
- 结论 ≥20 字 + 二次确认
- 补 audit_log 与 aftersales_status_history

Refs: #123
```

---

## 3. PR 流程

1. 从 `develop` 分出 feature 分支
2. 完成开发 + 本地跑通测试（见下）
3. `git push -u origin <branch>` 推到远端
4. `gh pr create --base develop --title "..." --body "..."` 或走网页
5. **PR 模板已存在**：`.github/pull_request_template.md`，会自动填入，逐项勾选
6. CI 全绿 → 请 reviewer 审 → merge

**必检项**（PR 模板已经列出）：
- 关联 Phase 与 Issue
- 变更类型 + 涉及端侧勾选
- 数据库变更（若有）必附 Alembic 迁移
- 测试补齐（单元 / 集成 / E2E / 手动）
- **业务深度检查**（P0 功能必勾）
- `/security-review` 已跑

---

## 4. 本地开发环境

### 4.1 前置

- **Node ≥ 22** + **pnpm ≥ 11**（`corepack enable` 会自动装匹配版本，见根 `package.json.packageManager`）
- **Python ≥ 3.12** + **uv**（`curl -LsSf https://astral.sh/uv/install.sh | sh`）
- **Docker Desktop** 或 Docker Engine + Compose plugin
- **JDK 21**（Android 开发）+ Android Studio（可选，命令行也能构建）
- **Git 2.30+**

### 4.2 一次性初始化

```bash
git clone <repo-url>
cd e_commerce_project_claude

# 复制 env 骨架（本地默认可跑）
cp .env.example .env

# 拉起数据依赖（Postgres + Redis + MinIO + minio-init）
docker compose up -d postgres redis minio minio-init

# 后端：装依赖 + 建表 + 灌种子
cd backend
uv sync --all-extras
uv run alembic upgrade head
uv run python -m app.scripts.seed         # 4 admin + 2 test user + 少量商品 / 订单 / 售后
cd ..

# 三前端：workspace 一次装完
pnpm install
```

### 4.3 启动各端

```bash
# 后端（reload）
cd backend && uv run uvicorn app.main:app --reload
# → http://localhost:8000  · Swagger: http://localhost:8000/docs

# 三前端（分别开 3 个 terminal，或用 pnpm concurrently）
pnpm dev:user-web       # http://localhost:3000
pnpm dev:merchant       # http://localhost:3001
pnpm dev:admin          # http://localhost:3002

# Android
# Android Studio 打开 android-app/ 首次会自动生成 gradle wrapper
# 或命令行：
cd android-app && gradle wrapper --gradle-version 8.10.2 && ./gradlew assembleDebug
```

**测试账号**（由 seed 脚本生成，见 `backend/app/scripts/seed.py`）：
- Admin：`admin_super / Passw0rd!` · `admin_business / Passw0rd!` · `admin_cs / Passw0rd!` · `admin_tech / Passw0rd!`
- User：`13800000001 / Passw0rd!` · `13800000002 / Passw0rd!`

---

## 5. 跑测试

### 5.1 后端

```bash
cd backend

# 单元 + 集成（sqlite + fakeredis，无需起 postgres）
uv run pytest -v

# lint + format 检查
uv run ruff check .
uv run ruff format --check .

# 类型检查
uv run mypy app/
```

**注意**：Agent 交付前 **必须** `uv sync --refresh --all-extras` 刷新，避免本地 .venv 缓存旧 ruff/pytest 版本导致 CI 挂（AGENTS §11.3）。

### 5.2 三前端

```bash
# 所有 workspace 一次跑
pnpm -r test           # vitest run 各自跑
pnpm -r build          # next build 各自跑
pnpm -r typecheck      # tsc --noEmit 各自跑

# 单个 workspace
pnpm --filter frontend-user-web test
pnpm --filter frontend-merchant build
pnpm --filter frontend-admin typecheck
```

**注意**：`next build` 比 `tsc --noEmit` 严格，务必本地跑 build 后再提交。

### 5.3 Android

```bash
cd android-app
./gradlew testDebugUnitTest
./gradlew assembleDebug
```

### 5.4 E2E（Phase 7 引入）

E2E 位于 `e2e/` workspace，CI 只做 `playwright test --list` 语法校验，真跑需要人工本地起完整后端 + 三前端：

```bash
docker compose up -d
cd backend && uv run uvicorn app.main:app &
pnpm dev:user-web &
pnpm dev:merchant &
pnpm dev:admin &

pnpm --filter e2e test
```

---

## 6. 数据库迁移

**红线**：改表结构必须走 Alembic 迁移，禁止手改 DB。

```bash
cd backend

# 生成迁移（推荐手写而非 --autogenerate，因需要 partial UNIQUE / native enum 精细控制）
uv run alembic revision -m "add xxx table"

# 应用
uv run alembic upgrade head

# 回滚一步
uv run alembic downgrade -1

# 查看历史
uv run alembic history

# 生成纯 SQL（不落库，仅审查）
uv run alembic upgrade head --sql
```

**Phase 沉淀（AGENTS §11.3）**：
- Partial UNIQUE index 只在 alembic 里 `op.execute("CREATE UNIQUE INDEX ... WHERE ...")`，模型层不声明（SQLite create_all 会退化）
- Native enum 用 `sa.Enum(EnumClass, name="xxx_enum", create_type=True)`
- JSONB 用 `JSON().with_variant(JSONB, "postgresql")` 双兼容

---

## 7. 代码风格

### 7.1 Python（backend）

- **Ruff**：`backend/ruff.toml` 定义规则，严格模式 + 少数 ignore（PLC0415 局部 import / PLR0911 状态机 dispatcher 多返回）
- **格式化**：`uv run ruff format .`
- **类型**：`mypy --strict` + `pydantic.mypy` plugin
- **命名**：`snake_case`（函数 / 变量 / 文件） · `PascalCase`（类 / Enum）
- **每个断言独占一行**（PT018）

### 7.2 TypeScript（三前端）

- **ESLint**：`next lint`（Next 15 起 deprecated，Phase 后期迁移到 eslint CLI）
- **Prettier**：根 `.prettierrc.json`
- **命名**：`camelCase`（变量 / 函数） · `PascalCase`（组件 / 类型） · `kebab-case`（文件名）
- **禁止**：`any` · 未使用 import · `console.log` 留守（除 dev 有意义）

### 7.3 Kotlin（Android）

- **ktlint** + **detekt**
- Compose Material3 experimental API 必须 `@OptIn(ExperimentalMaterial3Api::class)`（`SecondaryTabRow` / `PrimaryTabRow` / `TopAppBar` / `PullToRefresh` 等）
- 命名：`PascalCase`（类 / Composable） · `camelCase`（属性 / 方法） · 每个包路径与目录严格对应

---

## 8. 如何加新 Phase / 大 feature

1. **契约先行**：先在 `docs/API/phase-N-contracts.md` 定稿字段 / 端点 / 错误码 / 状态机；参考现有 6 个契约文档结构（数据模型 → 状态机 → RBAC → 端点 → 沉淀）
2. **规划**：使用 `/plan` 或 `/feature-dev` skill 生成实现计划
3. **拆 Agent**：Orchestrator 决定 backend 先出 → 三前端并行；或全并行开发（前端 mock 数据）
4. **每 Agent 交付前自检**（AGENTS §11.5）：
   - `git ls-files <dir>` 核对所有文件已 git track
   - Backend：`uv run ruff check . && uv run pytest -v`
   - Frontend：`pnpm --filter <ws> tsc --noEmit && pnpm --filter <ws> build`
   - 显式列出**契约偏差点**
5. **合并到 develop 后**：更新 `docs/CHANGELOG.md` + `docs/DEVELOPMENT_PLAN.md` 打 ✅ + tag `vX.Y.0-phaseN` + push

---

## 9. 常见坑（浓缩自 AGENTS §11）

- **macOS 大小写不敏感**：本地 build 通过，CI Linux 挂。命名一律 kebab-case
- **pnpm workspace 隐性 hoisting**：每个 workspace 必须显式声明所有 `import` 的包
- **Next.js typedRoutes vs string href**：Phase 后期统一改造
- **bcrypt 5 × passlib 1.7 不兼容**：`bcrypt>=4.0,<5.0` 严格 pin
- **SQLAlchemy async 缺 greenlet**：`sqlalchemy[asyncio] + greenlet>=3.0` 都写
- **SQLite BigInteger 不自增**：`BigInteger().with_variant(Integer, "sqlite")` 定义 `BigIntId`
- **session.flush() 后读 updated_at**：需要 `await session.refresh(row)` 才能拿 `onupdate=func.now()` 的值
- **CI ruff 版本比本地新**：Agent 交付前 `uv sync --refresh`
- **Agent API 中断**：用 `SendMessage(agentId, focused-prompt)` 续跑而非重启

---

## 10. 求助

- 项目里程碑 / 业务范围疑问 → [docs/DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md)
- 架构 / 部署 → [docs/ARCHITECTURE.md](ARCHITECTURE.md)
- API 细节 → [docs/API/INDEX.md](API/INDEX.md)
- Agent 协作 / Git 流程 → [AGENTS.md](../AGENTS.md)
- 安全审查结果 → [docs/SECURITY_AUDIT.md](SECURITY_AUDIT.md)
- ADR / 决策记录 → `docs/DECISIONS/`

**欢迎提 Issue / PR 补充本文档遗漏。**
