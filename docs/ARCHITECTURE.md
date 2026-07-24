# 系统架构 · JD-Clone

> 本文档描述 JD-Clone 电商平台的整体架构、模块划分、部署拓扑与关键设计决策。
> 详细的 API 契约见 [docs/API/INDEX.md](API/INDEX.md)；开发流程与规范见 [AGENTS.md](../AGENTS.md)。
>
> 版本：v1.0 · 更新日期：2026-07-24

---

## 1. 项目概览

**JD-Clone** 是一个复刻京东（JD.com）业务生态的多端电商平台，覆盖 **用户 Web / Android / 商家后台 / 管理员后台** 四个客户端加一个 **FastAPI 后端**。核心理念是 **"做深做透"**：不追求功能数量，但每个模块必须覆盖三角色协作、状态机、异常流程与超时机制。项目按 Phase 0-7 迭代交付，最终打 `v1.0.0` 主版本 tag。

---

## 2. 技术栈总览

| 层级 | 技术 | 说明 |
|---|---|---|
| **前端 · 用户 Web** | Next.js 15 + React 19 + TypeScript strict + Tailwind CSS 4 | 端口 3000 · 主色 `#D0211A` |
| **前端 · 商家后台** | Next.js 15 + React 19 + Tailwind CSS 4 + Recharts | 端口 3001 · 主色 `#1a56db` |
| **前端 · 管理员后台** | Next.js 15 + React 19 + Tailwind CSS 4 | 端口 3002 · 主色 `#0f172a` |
| **前端共通** | Zustand + TanStack Query + ky + React Hook Form + Zod + Vitest | pnpm workspace |
| **Android App** | Kotlin 2.0 + Jetpack Compose (M3) + Hilt + Retrofit + OkHttp + Coil3 + DataStore | 消费者端，对接 Phase 1-5 后端 |
| **后端** | FastAPI 0.115 + SQLAlchemy 2.0 (async) + Alembic + PostgreSQL 16 + Redis 7 + MinIO | Python 3.12 · uv 依赖 |
| **认证** | JWT (HS256, 15 min access) + opaque refresh token (48-byte, SHA-256 hash 落库) | 三 audience：user / merchant / admin |
| **基础设施** | Docker Compose · GitHub Actions · Nginx（生产） · 5 marketplace 40+ plugins | monorepo |
| **测试** | pytest + pytest-asyncio + httpx（后端） · Vitest（三前端） · Playwright（E2E · Phase 7 引入） · Compose Test（Android） | — |

---

## 3. 系统架构图

```mermaid
flowchart TB
    subgraph Clients [客户端层]
        UW[用户 Web · Next.js<br/>:3000]
        MW[商家后台 · Next.js<br/>:3001]
        AW[管理员后台 · Next.js<br/>:3002]
        AND[Android App · Compose]
    end

    subgraph Gateway [反向代理/网关]
        NGX[Nginx<br/>限流 · 路由 · 静态]
    end

    subgraph Backend [FastAPI 后端 · :8000]
        API[api/v1<br/>user/merchant/admin/common]
        SVC[services/<br/>业务逻辑]
        REPO[repositories/<br/>数据访问]
        MDL[models/<br/>SQLAlchemy ORM]
        WKR[workers/<br/>超时扫描 cron]
        CORE[core/<br/>config · security · rbac · errors · idempotency]
    end

    subgraph Data [数据层]
        PG[(PostgreSQL 16<br/>业务数据)]
        RD[(Redis 7<br/>会话 · 验证码 · 幂等)]
        M3[(MinIO<br/>S3 兼容 · 图片)]
    end

    UW & MW & AW --> NGX
    AND -.HTTPS.-> NGX
    NGX --> API
    API --> SVC
    SVC --> REPO
    REPO --> MDL
    SVC --> CORE
    WKR --> SVC
    MDL --> PG
    CORE --> RD
    SVC --> M3
```

---

## 4. 后端分层

```mermaid
flowchart LR
    subgraph API [api/v1]
        UA[user/*]
        MA[merchant/*]
        AA[admin/*]
        CA[common/*]
    end

    subgraph Deps [FastAPI 依赖注入]
        AUTH[get_current_user<br/>get_current_merchant<br/>get_current_admin]
        RBAC[require_*_permission]
        IDMP[require_idempotency_key]
        DB[get_db]
    end

    subgraph Services [业务逻辑]
        S1[auth_service]
        S2[catalog_service]
        S3[order_service]
        S4[payment_service]
        S5[aftersales_service]
        S6[review_service]
        S7[notification_service]
        S8[audit_service]
    end

    subgraph Repos [数据访问层]
        R1[repositories/*]
    end

    subgraph Models [ORM 模型]
        M1[models/*<br/>+ IdMixin/TimestampMixin/SoftDeleteMixin]
    end

    API --> Deps
    API --> Services
    Services --> Repos
    Services --> S8
    Repos --> Models
```

**分层原则**（`AGENTS.md` §4）：
- `api/`：路由 + Schema 校验 + 依赖注入（认证 / 权限 / 幂等），**不写业务逻辑**
- `services/`：业务事务的最小闭环 — 状态机、库存联动、审计写入、事件发布
- `repositories/`：DB 查询封装（本项目 Phase 1-6 大部分直接在 service 内查询，未强制分离）
- `models/`：SQLAlchemy declarative + Enum + 复合索引 + partial UNIQUE
- `workers/`：cron 触发的批处理（超时扫描等），本 Phase 用脚本 + 外部 cron 触发，未接 ARQ / Celery

---

## 5. 认证时序图（JWT + Refresh 单飞）

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant API as FastAPI
    participant DB as Postgres
    participant R as Redis

    Note over C,R: 登录
    C->>API: POST /auth/login {identifier, password}
    API->>DB: SELECT user by identifier
    API->>API: bcrypt.verify(password, hash)
    API->>DB: INSERT refresh_tokens (sha256_hash, expires_at=30d)
    API-->>C: {access_token(15min), refresh_token}

    Note over C,R: 正常调用
    C->>API: GET /user/orders  Authorization: Bearer <access>
    API->>API: jwt.decode(access, aud=user)
    API-->>C: 200 {items}

    Note over C,R: Access 过期 · Refresh 单飞
    C->>API: GET /user/orders  Authorization: Bearer <access>
    API-->>C: 401 {code:1002 TOKEN_EXPIRED}
    Note over C: ky client mutex 单飞
    C->>API: POST /auth/refresh {refresh_token}
    API->>DB: SELECT refresh_tokens WHERE token_hash=?
    API->>DB: UPDATE refresh_tokens SET revoked_at=NOW()
    API->>DB: INSERT refresh_tokens (new)
    API-->>C: {access_token(new), refresh_token(new)}
    C->>API: (retry) GET /user/orders  Authorization: Bearer <new access>
    API-->>C: 200 {items}
```

**关键点**
- Access = 15 min HS256 JWT，携带 `aud=user|merchant|admin` 隔离三身份域
- Refresh = 48-byte opaque `secrets.token_urlsafe`，DB 只存 SHA-256 hex；每次 refresh **rotate**（旧 token 标 revoked）
- 客户端（ky / Retrofit AuthInterceptor）用 Mutex 保证并发请求命中同一次 refresh
- 密码变更 / reset-password / 主动登出 → revoke 所有该用户的 refresh token

---

## 6. 订单状态机（Phase 3）

```mermaid
stateDiagram-v2
    [*] --> pending_payment: user create
    pending_payment --> paid: 支付成功
    pending_payment --> cancelled: user cancel<br/>OR admin force cancel<br/>OR 30min 超时
    paid --> shipped: merchant ship + tracking_no
    paid --> cancelled: user cancel(before ship)<br/>OR admin force cancel
    shipped --> completed: user confirm receipt<br/>OR 15d 自动确认
    completed --> [*]
    cancelled --> [*]

    note right of pending_payment
        cancel_reason ∈ {
          user_cancel,
          timeout,
          admin_force_cancel,
          out_of_stock,
          system_close
        }
    end note
```

- 触发主体：`user` / `merchant` / `admin` / `system`，均写 `order_status_history` + `audit_log`
- 库存联动：`paid` 锁库存（stock ↓ / locked_stock ↑）；`shipped` locked→sold；`cancelled` 全部释放
- 超时扫描：`app/scripts/process_timeouts.py`（30 min 未付 + 15 天未确认收货）

---

## 7. 售后状态机（Phase 4 · 12 态）

```mermaid
stateDiagram-v2
    [*] --> pending_merchant_review: user apply<br/>(REFUND_ONLY / RETURN_REFUND / EXCHANGE)

    pending_merchant_review --> merchant_rejected: merchant reject
    pending_merchant_review --> refunding: merchant agree (REFUND_ONLY)
    pending_merchant_review --> merchant_agreed_waiting_return: agree (RETURN_REFUND / EXCHANGE)
    pending_merchant_review --> admin_arbitrating: 商家 72h 超时<br/>OR user appeal<br/>OR risk auto-escalate

    merchant_rejected --> admin_arbitrating: user appeal (1 次)
    merchant_rejected --> [*]

    merchant_agreed_waiting_return --> return_shipped_waiting_receive: user 寄回 (tracking_no)
    merchant_agreed_waiting_return --> system_closed: user 7 天未寄回

    return_shipped_waiting_receive --> refunding: merchant confirm received (RETURN_REFUND)
    return_shipped_waiting_receive --> merchant_agreed_waiting_ship: merchant confirm received (EXCHANGE)
    return_shipped_waiting_receive --> admin_arbitrating: merchant 拒收 15 天

    merchant_agreed_waiting_ship --> exchange_shipped_waiting_receive: merchant ship (tracking_no)
    exchange_shipped_waiting_receive --> completed_exchanged: user confirm<br/>OR 15d auto

    refunding --> completed_refunded: refund_service (mock success)
    refunding --> admin_arbitrating: refund 失败重试

    admin_arbitrating --> completed_refunded: admin arbitrate side_with_user<br/>OR partial_refund<br/>OR force_refund
    admin_arbitrating --> merchant_rejected: admin side_with_merchant
    admin_arbitrating --> [*]

    pending_merchant_review --> user_cancelled: user cancel (未进 arbitrating)
    user_cancelled --> [*]
    completed_refunded --> [*]
    completed_exchanged --> [*]
    system_closed --> [*]
```

- **触发方**：`user` / `merchant` / `admin` / `system` — 每次转换均写 `aftersales_status_history` + `aftersales_messages`
- **凭证**：`aftersales_evidences` 按 6 stage 分类（apply / merchant_review / user_return / merchant_receive / admin_arbitration / user_appeal）
- **超时升级**：4 类（详见 `app/scripts/process_timeouts.py`）
- **风控**：30 天 3 单自动升级到 `admin_arbitrating`（`risk_service`）
- **平台仲裁**：3 outcome × 强制退款金额校验 × 结论 ≥20 字 × 二次勾选"不可撤销"

详细契约见 [phase-4-contracts.md](API/phase-4-contracts.md)。

---

## 8. 部署拓扑

### 8.1 本地开发（docker-compose）

```
┌─ postgres:16-alpine   :5432
├─ redis:7-alpine       :6379
├─ minio:latest         :9000 (API) · :9001 (Console)
├─ minio-init           初始化 jdclone-public / jdclone-private bucket
└─ backend (uvicorn)    :8000
```

前端不进 docker，本地 `pnpm dev:*` 起 3000/3001/3002。

### 8.2 生产建议拓扑（未部署）

```mermaid
flowchart LR
    subgraph Edge
        CDN[CDN<br/>静态/图片]
        LB[负载均衡<br/>HTTPS 终结]
    end

    subgraph AppTier
        UW1[Web-User × N<br/>Vercel / Node SSR]
        MW1[Web-Merchant × N]
        AW1[Web-Admin × N]
        API1[FastAPI × N<br/>uvicorn workers]
        CRON[Timeout Worker<br/>cron / ARQ]
    end

    subgraph DataTier
        PGP[(Postgres · 主从)]
        RDP[(Redis · Sentinel)]
        S3[(S3 / MinIO 集群)]
    end

    CDN --> LB
    LB --> UW1 & MW1 & AW1
    UW1 & MW1 & AW1 --> API1
    API1 --> PGP & RDP & S3
    CRON --> API1
```

**未做（Phase 7 明确不做）**：K8s manifest / Helm chart / 监控栈 / CDN 接入 / TLS 证书自动化 —— 属项目后期工作。

---

## 9. 关键设计决策（ADR-style 摘要）

| # | 决策 | 理由 | Phase |
|---|---|---|---|
| **ADR-1** | Monorepo（pnpm workspace + backend + android-app） | 联调便利、契约同步、CI 一次装 | 0 |
| **ADR-2** | JWT 分三个 `aud`（user/merchant/admin）而非 role claim | 域隔离，防止用户 token 误用为 admin；解码时强制指定 aud | 1 |
| **ADR-3** | Refresh token = opaque 随机串（非 JWT）+ SHA-256 hash 落库 | 服务端可以吊销；即便 DB 泄露也不可反推明文 | 1 |
| **ADR-4** | RBAC 硬编码 Permission StrEnum + role→set 映射 | 契约层面清晰可 diff；避免 DB 权限爆炸；后期可迁移 | 1 |
| **ADR-5** | 状态机 + 状态历史表（`order_status_history` / `aftersales_status_history`） | 时间轴可视化 + 审计溯源；业务时间轴与 audit_log 互补 | 3 / 4 |
| **ADR-6** | Idempotency-Key 强制 + DB UNIQUE 兜底 | 客户端重试 / 网络抖动不产生重复订单 / 退款；前端 sessionStorage 持久 | 3 / 4 |
| **ADR-7** | `session.begin_nested()` SAVEPOINT 包裹 order_no 冲突重试 | UNIQUE 冲突不破外层事务；避免整个下单流程回滚 | 3 |
| **ADR-8** | Partial UNIQUE index 只在 Alembic 里 `op.execute` 声明，不在 SQLAlchemy 模型层 | SQLite `create_all` 会退化为全表 UNIQUE，破坏测试 | 3 |
| **ADR-9** | 图片上传走 MinIO Presigned URL（前端直传） | 减轻后端流量；aioboto3 生成 15 min TTL 的 PUT URL | 2 |
| **ADR-10** | 订单 items 冗余 SPU/SKU 快照字段 | 商家改价 / 下架不影响历史订单展示与售后追溯 | 3 |
| **ADR-11** | 售后凭证按 6 stage 分类存储 | 支持 4 角色不同视角查看不同 stage 证据；仲裁时集中呈现 | 4 |
| **ADR-12** | 站内信事件驱动写入 | 售后 approve / 评价新增 / 举报处理等业务事件自动 fanout；解耦 | 5 |
| **ADR-13** | Android 单 agent 全权交付 + SendMessage 续跑 | 多 agent 并行改 NavHost/ApiService 冲突高；单 agent 减少集成成本 | 6 |
| **ADR-14** | 手机号 admin 端明文 / user & merchant 端 `138****1234` 脱敏 | 平台仲裁需要联系用户；用户/商家端保护隐私 | 3 / 4 |

---

## 10. 更多参考

- API 契约索引：[docs/API/INDEX.md](API/INDEX.md)
- Phase 划分与里程碑：[docs/DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md)
- 变更日志：[docs/CHANGELOG.md](CHANGELOG.md)
- 安全审查：[docs/SECURITY_AUDIT.md](SECURITY_AUDIT.md)
- 协作者上手：[docs/CONTRIBUTING.md](CONTRIBUTING.md)
- Multi-Agent 协作规范：[AGENTS.md](../AGENTS.md)
