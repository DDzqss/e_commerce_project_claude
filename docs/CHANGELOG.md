# CHANGELOG

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 规范。

版本号遵循语义化 + Phase 标识：`vX.Y.Z-phaseN`。

---

## [Unreleased]

### Added
- （下一个 Phase 待启动）

---

## [0.1.0-phase0] — 2026-07-22

### Phase 0：项目筹备完成

#### Monorepo 基础
- `pnpm-workspace.yaml`：3 个前端 workspace + packages/*，含 allowBuilds 白名单
- 根 `package.json`（Node 20+、pnpm 11）与统一 `.editorconfig` / `.prettierrc.json` / `.nvmrc`

#### 后端（`backend/`，33 文件）
- FastAPI 0.115+ + async SQLAlchemy 2.0 + Alembic async env
- 分层：api/v1/{user,merchant,admin,common} · core · models · schemas · services · repositories · workers · utils
- 双 health 探针：`/health`（liveness）与 `/api/v1/common/health`（DB+Redis readiness）
- JWT + bcrypt 安全占位、pydantic-settings 配置、多阶段 uv Dockerfile（非 root）
- 通用 mixin：`IdMixin` / `TimestampMixin` / `SoftDeleteMixin`
- 首个 pytest-asyncio smoke test（`/health` 200）通过；ruff + format 全绿

#### 前端 · 用户 Web 端（`frontend-user-web/`，21 文件，端口 3000）
- Next.js 15 App Router + React 19 + TypeScript strict + Tailwind CSS 4（`@theme` 新格式）
- Zustand + TanStack Query + ky + react-hook-form + zod
- 主色 `#D0211A`（对京东红微调），首页占位（三张特性卡 + CTA）

#### 前端 · 商家后台（`frontend-merchant/`，23 文件，端口 3001）
- 同上技术栈 + recharts
- Dashboard 布局（sidebar + main）、4 张统计卡片占位
- MerchantRole 枚举（OWNER / OPERATOR / SUPPORT）
- 主色 `#1a56db` 专业蓝

#### 前端 · 管理员后台（`frontend-admin/`，24 文件，端口 3002）
- 同 merchant 技术栈
- Console 布局（sidebar + header + main）、4 张统计卡片
- `AdminRole` 枚举（SUPER / BUSINESS / CUSTOMER_SERVICE / TECH ADMIN）+ RBAC 权限矩阵占位
- 主色 `#0f172a` 中性深灰，信息密度更高

#### Android App（`android-app/`，30 文件）
- Kotlin 2.0.21 + Jetpack Compose (BOM 2024.12.01, Material 3)
- Hilt DI + Retrofit + OkHttp + Kotlinx Serialization + Coil 3 + DataStore
- 版本目录 `gradle/libs.versions.toml`；applicationId `com.jdclone.app`
- 底部 4 tab 导航占位（首页/分类/购物车/我的）
- Retrofit health 接口 + BASE_URL 通过 BuildConfig（默认 `http://10.0.2.2:8000/api/v1/` 供模拟器）

#### 基础设施
- `docker-compose.yml`：postgres:16 + redis:7 + minio + backend + minio-init（自动建 bucket）
- 全部服务含 healthcheck
- `.env.example` 覆盖所有配置项

#### CI/CD
- `.github/workflows/backend-ci.yml`：uv + ruff + format + mypy + pytest（含 postgres/redis service）
- `.github/workflows/frontend-ci.yml`：pnpm matrix（3 端）× lint + tsc + test + build
- `.github/workflows/android-ci.yml`：JDK 21 + Gradle wrapper 自动生成 + assembleDebug + unitTest
- `.github/pull_request_template.md`：含业务深度检查 & security review 勾选项

#### 文档
- `docs/CHANGELOG.md` / `docs/DECISIONS/README.md`（ADR 模板）/ `docs/UX_ISSUES.md`

### 验证结果
- 后端：ruff ✓ · format ✓ · pytest ✓（1 test）
- 前端 3 端：tsc --noEmit ✓ · next build ✓
- pnpm workspace：4 项目安装成功，postinstall 白名单已配置

---

## [0.0.1] — 2026-07-22

### Added
- 项目文档初始化（`docs/DEVELOPMENT_PLAN.md`、`AGENTS.md`、`README.md`）
- `.gitignore` 覆盖 Python / Node / Next.js / Android / Docker / IDE
- 配置 GitHub MCP + 4 个 marketplace + 28 个 plugins（feature-dev, pr-review-toolkit,
  frontend-design, playwright, superpowers, claude-session-driver, security-guidance 等）
