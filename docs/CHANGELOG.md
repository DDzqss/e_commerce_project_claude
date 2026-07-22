# CHANGELOG

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 规范。

版本号遵循语义化 + Phase 标识：`vX.Y.Z-phaseN`。

---

## [Unreleased]

### Added
- （下一个 Phase 待启动）

---

## [0.2.0-phase1] — 2026-07-22

### Phase 1：基础能力（认证 + RBAC + 商家入驻）

#### 契约先行
- `docs/API/phase-1-contracts.md`（600+ 行）：统一响应结构、四位错误码、三身份域（user/merchant/admin）、
  7 张表数据模型、20+ 端点、11 个 Phase 1 权限键、商家入驻状态机、JWT 规范、种子数据

#### Backend（backend/，共 30+ 新文件）
- **模型**：User / Shop / MerchantAccount / MerchantApplication / AdminUser / RefreshToken / AuditLog
- **Alembic 0001**：手写，7 张表 + 9 个 native enum + 完整 FK/index
- **Core**：`rbac.py`（Permission Enum + ROLE_PERMISSIONS 矩阵）+ `errors.py`（4 位错误码 + 全局 handler）
  + `redis.py` async client + `security.py` 升级（aud claim + opaque refresh + SHA256 哈希）
- **依赖注入**：`api/deps.py` 三个 `get_current_{user,merchant,admin}` + `require_permission` 工厂
- **服务层**：auth / user / merchant / merchant_application / audit（登录成功失败/密码变更/入驻全流程写审计）
- **端点**：29 个（user 域 13 + merchant 域 6 + admin 域 8 + common 2），Swagger 分 tags
- **入驻状态机**：apply → pending → (approve→approved / reject→rejected / withdraw→withdrawn)
  approve 事务内创建 Shop + MerchantAccount + 回填 approved_merchant_account_id
- **种子脚本**：`app/scripts/seed.py`（4 admin + 2 test user，幂等，production 拒运行）
- **测试**：6 组测试（auth_user / auth_merchant / auth_admin / rbac / merchant_application / forgot_password）
  用 aiosqlite + fakeredis，无需 Postgres/Redis 即可跑
- **依赖新增**：fakeredis (dev) / aiosqlite (dev)
- **反枚举**：登录合并"未知账号"与"密码错"为 1003；forgot-password 无论账号存不存在都返回 code=0

#### Frontend · User-Web（frontend-user-web/，26 新 + 7 改，11 测试）
- **Auth store**（zustand + persist）+ ky 客户端（Bearer 注入 + 401→refresh 单飞重放 + 失败跳登录）
- **通用组件**：Button / Input / PasswordInput / FormField / Toast / Skeleton / Modal + AuthLayout + RequireAuth
- **页面**：
  - `(auth)/{login,register,forgot-password,reset-password}` 完整流程
  - `account/profile` 我的资料（修改昵称 / 修改密码）
  - `account/merchant-apply` 商家入驻申请（表单 + 状态卡 + 历史列表 + 撤回）
- **依赖新增**：clsx / @testing-library/user-event / @tanstack/react-query-devtools

#### Frontend · Merchant-Web（frontend-merchant/，22 新 + 9 改，10 测试）
- Auth store + ky 客户端（同 user-web 模式，独立 store key `merchant-auth-v1`）
- **通用组件**：Button / Input / PasswordInput / FormField / Toast / Skeleton / Modal + AuthLayout + RequireAuth
- **页面**：
  - `(auth)/login` 商家登录（`login_name` + password，附"申请入驻"外链）
  - `(dashboard)/dashboard` 欢迎条 + Phase 路线图卡片 + 保留 4 张 0 值统计
  - `(dashboard)/shop` 店铺信息展示与编辑（name disabled，description/联系人可改）
  - `(dashboard)/account/change-password`
- **Sidebar**：Phase 2/3/4 项标"即将开放"badge
- **依赖新增**：clsx

#### Frontend · Admin-Web（frontend-admin/，22 新 + 7 改，12 测试）
- Auth store + admin session + RBAC 真实生效（去掉 `showAllForSkeleton`）
- **通用组件**：Button / Input / PasswordInput / FormField / Toast / Skeleton / Badge / Modal / Table + RequirePermission
- **页面**：
  - `(auth)/login` 平台管理员通道
  - `(console)/console/merchants/applications` 列表（状态 tab + 300ms 防抖搜索 + 分页 + URL sync）
  - `(console)/console/merchants/applications/[id]` 详情 + timeline + approve/reject 弹窗 +
    通过后**一次性明文展示**生成的 login_name + initial_password（黄色警告框）
  - `(console)/console/account/change-password`
- **Sidebar**：按 permissions 门控；仅"商家入驻审核"可用，其他 Phase 2+ 灰化
- **依赖新增**：clsx

#### 沉淀（AGENTS.md 新增 §11 填坑清单）
- macOS 大小写不敏感 vs Linux CI 大小写敏感
- pnpm 11 需 Node 22+；`pnpm/action-setup` 与 `packageManager` 冲突
- pnpm workspace 隐性 hoisting；每个 workspace 必须显式声明所有直接依赖
- Next.js `experimental.typedRoutes` 与 `string` href 类型冲突
- pydantic-settings Literal 字段严格
- ruff PT018 / S105 处理规范
- `next build` 类型检查比 `tsc --noEmit` 更严
- `.gitignore` 分层原则（Python 特有模式移入 backend/.gitignore；根只放跨端通用）

### 验证结果
- 后端：ruff ✓ · format ✓ · pytest（6 组测试全通过）· alembic --sql ✓
- 三前端：pnpm build ✓ · 各自 vitest ✓（合计 33 测试用例）

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
