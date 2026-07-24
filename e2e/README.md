# e2e — Playwright End-to-End Tests

> Phase 7 交付。覆盖 user-web / merchant / admin 三端的核心路径。

## 目录

- [快速开始](#快速开始)
- [Spec 列表](#spec-列表)
- [环境变量](#环境变量)
- [账号说明](#账号说明)
- [常见问题](#常见问题)

## 快速开始

在项目**根目录**：

```bash
# 1. 起完整栈（Postgres/Redis/MinIO/后端）
docker compose up -d

# 2. 灌种子数据（若尚未跑过；重复跑无害）
docker compose exec backend python -m app.scripts.seed

# 3. 启动三前端（三个终端 或 tmux）
pnpm dev:user-web   # localhost:3000
pnpm dev:merchant   # localhost:3001
pnpm dev:admin      # localhost:3002

# 4. 安装 Playwright 浏览器（首次）
pnpm --filter e2e exec playwright install --with-deps chromium

# 5. 跑测试
pnpm --filter e2e test                 # 全跑
pnpm --filter e2e test --project=user-web
pnpm --filter e2e test tests/auth.spec.ts
pnpm --filter e2e test --headed        # 带浏览器界面
pnpm --filter e2e test --ui            # Playwright UI 模式
```

失败 report 会写到 `e2e/playwright-report/`，跑完可用：

```bash
pnpm --filter e2e report
```

## Spec 列表

| 文件 | Project | test 数 | 覆盖 |
| --- | --- | --- | --- |
| `tests/auth.spec.ts` | user-web | 1 | 注册 → 修改昵称 → 登出 → 再登录 |
| `tests/shopping.spec.ts` | user-web | 1 | 匿名浏览 → 加购触发登录 → 结算 → 模拟支付 → 订单 paid |
| `tests/orders.spec.ts` | user-web | 1 | 待付款 tab → 详情 → 用户取消订单 |
| `tests/aftersales.spec.ts` | user-web | 1 | completed 订单发起 return_refund 申请 |
| `tests/merchant.spec.ts` | merchant | 1 | 商家登录 → paid 订单发货 |
| `tests/admin.spec.ts` | admin | 1 | 管理员登录 → 商家入驻审核 |

**合计 6 个 test。** 每个 spec 只做 1 个 test，先保证跑通，卷不动就先不卷。

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `E2E_USER_WEB_URL` | `http://localhost:3000` | 用户端 baseURL |
| `E2E_MERCHANT_URL` | `http://localhost:3001` | 商家端 baseURL |
| `E2E_ADMIN_URL` | `http://localhost:3002` | 管理端 baseURL |
| `E2E_USER_IDENTIFIER` | `13800000001` | seed 用户手机号 |
| `E2E_USER_PASSWORD` | `Test1234` | seed 用户密码 |
| `E2E_MERCHANT_LOGIN_NAME` | `shop1_owner` | seed 商家登录名 |
| `E2E_MERCHANT_PASSWORD` | `Merch1234` | seed 商家密码 |
| `E2E_ADMIN_USERNAME` | `super` | seed 超级管理员 |
| `E2E_ADMIN_PASSWORD` | `super_pwd_change_me` | seed 管理员密码 |
| `CI` | (unset) | 设置后启用 retry=1 + workers=1 |

## 账号说明

三端 seed 账号均由 `backend/app/scripts/seed.py` 自动创建：

- **用户** · 手机 `13800000001` · 密码 `Test1234`
- **商家** · 登录名 `shop1_owner` · 密码 `Merch1234`
- **管理员** · 用户名 `super` · 密码 `super_pwd_change_me`（**仅 dev**）

`auth.spec` 会**注册新账号**（手机号用时间戳生成），不复用 seed 用户，避免污染。
其它 spec 复用 seed 用户/商家/管理员进入登录态。

## CI

`.github/workflows/e2e-ci.yml` 只做两件事：

1. `pnpm install --frozen-lockfile`
2. `pnpm --filter e2e exec playwright install --with-deps chromium`
3. `pnpm --filter e2e exec playwright test --list`

**不实际跑测试**——因为 CI 上起完整后端栈成本大。语法/依赖出问题会被 `--list` 提前发现。真实 E2E 由人工在本地或预发环境跑。

## 常见问题

### `auth.spec` 失败：注册接口 6002 手机号已注册
清理 DB 重灌 seed：`docker compose exec backend python -m app.scripts.seed --reset`。或使用不同的时间戳跑（一般不会撞，除非同一秒跑了两次）。

### `shopping.spec` 停在 `/checkout` 报"请添加地址"
seed 用户默认应带一个地址；若被人为删掉了请重新灌 seed 或在 `/account/addresses` 手工添一个。

### `merchant.spec` 找不到 paid 订单
`shopping.spec` 跑成功一次会产生新的 paid 订单；或跑 `seed` 时会预置若干 paid 订单。

### `orders.spec` / `aftersales.spec` 报 skip
表明该状态下 seed 无数据，属预期（`test.skip`），非失败。想强制跑：手工先走一遍 `shopping.spec`。

### Playwright 找不到浏览器
```bash
pnpm --filter e2e exec playwright install --with-deps chromium
```
