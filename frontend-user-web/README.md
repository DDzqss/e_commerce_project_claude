# frontend-user-web

JD-Clone 项目的**用户 Web 端**，面向普通消费者，用于商品浏览、购物车、下单、订单、售后等场景。

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
| 测试 | Vitest + @testing-library/react + jsdom |
| 包管理 | pnpm（monorepo 根统一管理） |

## 开发命令

```bash
# 在项目根目录：
pnpm --filter frontend-user-web dev
pnpm --filter frontend-user-web build
pnpm --filter frontend-user-web test
pnpm --filter frontend-user-web lint
pnpm --filter frontend-user-web typecheck

# 或者在本子目录内：
pnpm dev
pnpm build
pnpm test
pnpm lint
pnpm typecheck
```

## 目录结构

```
frontend-user-web/
├── src/
│   ├── app/               # Next.js App Router 页面 / layout
│   │   ├── layout.tsx     # 根 layout，注入 QueryClientProvider
│   │   ├── page.tsx       # 首页
│   │   └── globals.css    # Tailwind v4 入口 + @theme 主题变量
│   ├── components/        # 通用 UI 组件（预留 shadcn 风格）
│   ├── features/          # 按业务领域分模块（auth / cart / order / product ...）
│   ├── hooks/             # 通用 React hooks
│   ├── lib/               # API 客户端、工具函数、Provider
│   │   ├── api.ts         # ky 实例（统一 baseUrl / 拦截器 / 鉴权）
│   │   └── query-client.tsx  # QueryClient Provider（客户端组件）
│   └── types/             # 通用类型定义（ApiResponse<T> 等）
├── public/                # 静态资源
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs     # Tailwind v4 PostCSS 插件
├── eslint.config.mjs      # ESLint flat config
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

## 编码约定

- 全部使用 TypeScript，严格模式；避免 `any`
- 路径别名 `@/*` 指向 `src/*`
- 服务端组件默认，需要交互时再显式 `"use client"`
- 表单必须使用 react-hook-form + zod 校验；不接受裸 `<form>` + 手动状态
- 服务端数据一律走 react-query（`useQuery` / `useMutation`），不在组件里裸 fetch
- 请求统一通过 `@/lib/api` 中的 ky 实例，不允许在业务代码直接 import fetch/axios
- 样式优先使用 Tailwind 原子类；复杂组件抽到 `components/` 或 `features/*/components/`

## 主色说明

主色借鉴京东红但略作调整，避免直接复制：`--color-primary: #D0211A`。页面整体保持灰白低调基调，主色仅用于强调（按钮、价格、CTA、Badge）。

## 与其他 workspace 的接口约定

- 后端 API 响应统一为 `{ code, message, data }` 结构，参见 `src/types/index.ts` 中的 `ApiResponse<T>`
- 认证 token 采用 JWT（access + refresh），存储与刷新策略后续在 `src/features/auth/` 中实现
- 端到端类型对齐：后续引入后端 OpenAPI 生成 client（Phase 1 结束前）
