# frontend-merchant

JD-Clone 电商平台的 **商家后台（Merchant Web）** — 面向入驻商家的后台管理界面，采用侧边栏 Dashboard 布局。

- 技术栈：Next.js 15 (App Router) + React 19 + TypeScript (strict) + Tailwind CSS 4
- 状态管理：Zustand + @tanstack/react-query
- 表单：react-hook-form + zod
- 图表：recharts（用于销售看板等数据可视化）
- 网络：ky
- 端口：**3001**（与用户 Web 端 3000、管理员后台 3002 区分）
- 主色：`#1a56db`（专业蓝，区别于用户端的红色）

## 目标用户

入驻本平台的商家，包含三种角色：

| 角色 | 说明 |
|---|---|
| `OWNER`（店铺管理员） | 店铺所有权限 |
| `OPERATOR`（店铺运营） | 商品/订单管理 |
| `SUPPORT`（店铺客服） | 仅订单查询/售后处理 |

详见根目录 `docs/DEVELOPMENT_PLAN.md` 第 5 节。

## 目录结构

```
frontend-merchant/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # 全局根布局（含 QueryClientProvider）
│   │   ├── page.tsx                # 根路由，重定向到 /dashboard
│   │   ├── globals.css             # Tailwind 4 全局样式 + 主题变量
│   │   └── (dashboard)/            # dashboard 组合布局（sidebar + main）
│   │       ├── layout.tsx
│   │       └── dashboard/page.tsx  # 商家看板首页
│   ├── components/
│   │   └── dashboard/              # Sidebar / StatCard 等 dashboard 专用组件
│   ├── features/                   # 业务模块（订单、商品、店铺、售后等）
│   ├── hooks/                      # 通用 hooks
│   ├── lib/                        # ky 客户端、query-client 等基础设施
│   └── types/                      # 公用类型 (ApiResponse / MerchantRole 等)
└── public/                         # 静态资源
```

## 常用命令

```bash
pnpm install            # 首次安装依赖（在 monorepo 根执行）
pnpm --filter frontend-merchant dev        # 启动开发服务 (http://localhost:3001)
pnpm --filter frontend-merchant build      # 生产构建
pnpm --filter frontend-merchant start      # 生产启动
pnpm --filter frontend-merchant lint       # ESLint
pnpm --filter frontend-merchant typecheck  # tsc --noEmit
pnpm --filter frontend-merchant test       # Vitest
```

## 环境变量

复制 `.env.example` 为 `.env.local` 并按需修改，参见文件内说明。

## 与其他 workspace 的关系

- 后端 API：`backend/`（FastAPI，默认 http://localhost:8000）
- 用户 Web：`frontend-user-web/`（端口 3000）
- 管理员后台：`frontend-admin/`（端口 3002）

商家后台仅调用后端 `/api/merchant/*` 系列 API，权限校验以后端返回的 JWT + 角色为准。
