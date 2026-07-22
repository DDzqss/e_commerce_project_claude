# frontend-admin

JD-Clone 项目的**平台管理员后台**，面向平台运营方内部人员，用于商家审核、商品审核、订单干预、售后仲裁、用户与权限管理、系统日志查看等场景。

> 本端仅供内部使用，通常部署在内网 / VPN 后，独立于面向消费者的用户端与商家端。

## 端口

- 开发端口：**3002**（避免与 user-web `3000`、merchant `3001` 冲突）

```bash
pnpm dev   # 等价于 next dev -p 3002
```

## 支持的角色 (RBAC)

依据 `docs/DEVELOPMENT_PLAN.md` 第 5.1 节，本后台支持以下四类平台侧角色：

| 枚举 | 中文名 | 主要职责 |
|---|---|---|
| `SUPER_ADMIN` | 超级管理员 | 所有权限，包括权限分配、系统级配置 |
| `BUSINESS_ADMIN` | 业务管理员 | 商家审核、商品审核、订单大盘、店铺违规处理 |
| `CUSTOMER_SERVICE_ADMIN` | 客服管理员 | 售后仲裁、用户投诉处理、代客发起退款 |
| `TECH_ADMIN` | 技术管理员 | 系统配置、日志、权限分配（不涉及业务干预） |

角色定义与权限判定见 `src/lib/rbac.ts`。当前为占位实现，Phase 1 引入真实鉴权后再补齐 `hasPermission` 与后端 `/api/v1/admin/auth/me` 对齐。

## 技术栈

| 层级 | 选型 |
|---|---|
| 框架 | Next.js 15+（App Router） |
| UI | React 19 |
| 语言 | TypeScript（strict） |
| 样式 | Tailwind CSS 4（新配置格式，配置写在 `src/app/globals.css`） |
| 状态管理 | Zustand（客户端状态）+ @tanstack/react-query（服务端状态） |
| 表单 | react-hook-form + zod（校验） |
| HTTP 客户端 | ky |
| 图表 | Recharts |
| 测试 | Vitest + @testing-library/react + jsdom |
| 包管理 | pnpm（monorepo 根统一管理） |

## 开发命令

```bash
# 在项目根目录：
pnpm --filter frontend-admin dev
pnpm --filter frontend-admin build
pnpm --filter frontend-admin test
pnpm --filter frontend-admin lint
pnpm --filter frontend-admin typecheck

# 或者在本子目录内：
pnpm dev        # http://localhost:3002
pnpm build
pnpm test
pnpm lint
pnpm typecheck
```

## 目录结构

```
frontend-admin/
├── src/
│   ├── app/                       # Next.js App Router 页面 / layout
│   │   ├── layout.tsx             # 根 layout，注入 QueryClientProvider
│   │   ├── page.tsx               # 根路径 → 重定向到 /console
│   │   ├── globals.css            # Tailwind v4 入口 + @theme 主题变量
│   │   └── (console)/             # 后台管理路由组
│   │       ├── layout.tsx         # 左侧 sidebar + 顶部 header + main
│   │       └── console/
│   │           └── page.tsx       # 首页占位（4 个统计卡片）
│   ├── components/
│   │   └── console/               # 后台专用组件（Sidebar / Header / StatCard）
│   ├── features/                  # 按业务领域分模块
│   │                              # （merchant / product-review / order-overview
│   │                              #  / refund-arbitration / user / rbac / log ...）
│   ├── hooks/                     # 通用 React hooks
│   ├── lib/                       # API 客户端、工具函数、Provider
│   │   ├── api.ts                 # ky 实例（X-Client: admin-web，401 触发登出）
│   │   ├── query-client.tsx       # QueryClient Provider（客户端组件）
│   │   └── rbac.ts                # AdminRole 枚举 + hasPermission 占位
│   └── types/                     # 通用类型（ApiResponse<T> 等）
├── public/                        # 静态资源
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
├── eslint.config.mjs
├── vitest.config.ts
└── .env.example
```

## 环境变量

复制 `.env.example` 为 `.env.local` 后填入本地开发配置：

```bash
cp .env.example .env.local
```

主要变量：

- `NEXT_PUBLIC_API_BASE_URL` — 后端 API 地址（默认 `http://localhost:8000/api/v1`）
- `NEXT_PUBLIC_SITE_NAME` — 站点名称，显示在标题栏
- `NEXT_PUBLIC_ENABLE_DEBUG` — 是否启用开发调试面板

## 设计语言

管理端追求 **严肃、信息密度高、可扫读**：

- 主色：`--color-primary: #0f172a`（深灰蓝），不使用高饱和红/橙，避免与消费者端混淆
- 强调色 `--color-danger`：仅用于「拒绝 / 强制退款 / 高危仲裁」等破坏性操作
- 表格默认紧凑行高（36px），字号 13/14px，支持批量操作栏
- 侧边导航按业务域分组，支持折叠；顶部固定 header 展示当前用户 + 角色 badge
- 数据看板采用 Recharts，配色遵循中性调色板

与消费者端（`frontend-user-web` 京东红）、商家端（`frontend-merchant` 运营绿/蓝）在视觉上明确区分。

## 编码约定

- 全部使用 TypeScript，严格模式；避免 `any`
- 路径别名 `@/*` 指向 `src/*`
- 服务端组件默认，需要交互时再显式 `"use client"`
- 表单必须使用 react-hook-form + zod 校验；不接受裸 `<form>` + 手动状态
- 服务端数据一律走 react-query（`useQuery` / `useMutation`），不在组件里裸 fetch
- 请求统一通过 `@/lib/api` 中的 ky 实例，请求头带 `X-Client: admin-web`
- 权限控制统一走 `@/lib/rbac` 中的 `hasPermission(role, action)`，禁止在组件里硬编码角色判断

## 与其他 workspace 的接口约定

- 后端 API 响应统一为 `{ code, message, data }` 结构，参见 `src/types/index.ts` 中的 `ApiResponse<T>`
- 管理员 JWT 与用户/商家 JWT 隔离签发（`aud: admin`），后端 `/api/v1/admin/*` 仅接受管理员 token
- 所有破坏性操作（强制退款、封禁店铺、下架商品）后端必须记录审计日志，前端调用时携带 `X-Reason` 头（Phase 1 落地）
