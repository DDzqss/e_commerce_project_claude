# Phase 7 · 打磨与测试范围

> Phase 7 是项目最后一 phase — **收官**。不做新功能，只补测试、优化、安全、文档、体验。
> 完成后打 `v1.0.0` 项目终版 tag。
>
> 版本：v1.0 · 生效范围：Phase 7 · 依赖 Phase 0-6

---

## 目录
1. [目标](#1-目标)
2. [不做](#2-不做)
3. [Playwright E2E 测试](#3-playwright-e2e-测试)
4. [后端性能与集成测试](#4-后端性能与集成测试)
5. [三端 UI/UX 打磨](#5-三端-uiux-打磨)
6. [安全审查与加固](#6-安全审查与加固)
7. [文档终稿](#7-文档终稿)
8. [Agent 分工](#8-agent-分工)

---

## 1. 目标

- **可信度**：核心购物路径有 E2E 测试兜底（登录 → 浏览 → 加购 → 结算 → 支付 → 订单确认 → 售后申请）
- **性能**：常用列表接口 500ms 内响应（1000 SPU 数据规模），无 N+1 查询
- **一致性**：三前端 loading / error / empty 状态样式统一，主色/间距/字号一致
- **可访问性**：核心按钮 aria-label、表单 tab 顺序合理
- **安全**：CORS 白名单、Secret 环境变量、SQL 参数化、XSS 防护、RBAC 严丝合缝
- **文档**：新协作者可 30 分钟看完 README + ARCHITECTURE 上手；所有历史 Phase contract 保留供追溯

---

## 2. 不做

- 新业务功能（评价发表 App 端 / 图片上传 App 端 等 Phase 6 明确遗留）
- 真实支付/物流对接（永远是模拟）
- WebSocket 实时通知
- iOS / 商家 App / Admin App
- 大规模数据量（≥ 1M SPU）性能调优（Phase 后期做）
- CDN 接入 / 边缘缓存
- 监控接入（Grafana / Sentry / Prometheus）

---

## 3. Playwright E2E 测试

### 3.1 部署

**新 workspace**：`e2e/`（monorepo pnpm workspace 下）
- `e2e/package.json`：`@playwright/test` 依赖
- `e2e/playwright.config.ts`：baseURL 从 env 读取；user-web=3000 / merchant=3001 / admin=3002
- `e2e/tests/*.spec.ts`：分模块测试文件
- `e2e/README.md`：如何本地跑（`docker compose up -d && pnpm dev:*` 然后 `pnpm --filter e2e test`）

### 3.2 CI 策略

**只做 `playwright test --list` + `pnpm playwright install --with-deps` 校验**，不实际跑（避免 CI 需要起完整后端栈）。真实 E2E 由人工在本地跑。
CI 修改 `.github/workflows/e2e-ci.yml`（新增）— 每次 PR 触发一次 list 校验，保证 config 语法正确。

### 3.3 测试清单

**user-web 主路径**（4 个 spec）：
1. `auth.spec.ts`：注册 → 登录 → 修改昵称 → 登出
2. `shopping.spec.ts`：浏览类目 → 搜索 → 详情 → 加购 → 结算 → 模拟支付成功 → 我的订单确认
3. `orders.spec.ts`：订单列表 tab 切换 → 详情 timeline → 用户取消 pending_payment
4. `aftersales.spec.ts`：completed 订单发起退货申请 → 我的售后详情

**merchant smoke**（1 个 spec）：
5. `merchant.spec.ts`：登录 → 待发货订单列表 → 详情 → 发货填单号

**admin smoke**（1 个 spec）：
6. `admin.spec.ts`：登录 → 商家入驻审核列表 → 通过一个

---

## 4. 后端性能与集成测试

### 4.1 索引审计

用 `EXPLAIN ANALYZE` 排查以下热点接口是否走 index：
- `GET /catalog/spus?category_id=X&sort=newest` — 应走 `(status, category_id, published_at DESC)` 复合索引
- `GET /user/orders?status=X` — 应走 `(user_id, status, created_at DESC)`
- `GET /merchant/orders?shop_id=X&status=Y` — 应走 `(shop_id, status, created_at DESC)`
- `GET /admin/aftersales?status=admin_arbitrating&escalation_reason=X` — 应走 `(status, escalated_at DESC)`

补：Alembic `0006_phase7_perf_indexes.py` 补齐缺失的复合索引 + 冗余字段（如 `spus.sales_count` 已存在，`shops.rating` Phase 5 已加）。

### 4.2 N+1 查询消除

排查 Repository 代码：
- `list_spus` / `list_orders` / `list_aftersales` 详情字段是否用 `selectinload` 预加载关联

### 4.3 集成测试

`backend/tests/test_integration_shopping_flow.py` — 端到端 pytest：
- 注册 user → 加购 → 下单 → 模拟支付 → 商家发货 → 用户收货 → 完整状态验证
- 一个 test 覆盖 8-10 个端点

### 4.4 后端负载测试（可选）

不做。留到 phase 后期用 Locust。

---

## 5. 三端 UI/UX 打磨

### 5.1 一致性

- Toast 统一位置（右上或底部固定）、错误红色、成功绿色、警告橙色
- Empty state 用统一组件（Phase 3 已有 `EmptyState`）+ 引导 CTA
- Skeleton 骨架统一样式（灰色渐变动画）
- Button loading state（disabled + spinner）
- Error 屏统一（含"重试"按钮）

### 5.2 可访问性

- 表单 label 与 input 用 `htmlFor` 关联
- 按钮加 `aria-label` 若只有图标
- Modal 加 focus trap 与 Escape 关闭
- Tab 顺序合理

### 5.3 移动响应式

- Phase 7 简化：**只做桌面 1280+**（架构原则）
- 移动端由 Android 承担；Web 端不做 responsive
- 但 header 与 sidebar 在窄屏至少不横向溢出（min-width: 1280px 显示 warning 或滚动）

### 5.4 主色与配色

- 三端主色沿用（user #D0211A / merchant #1a56db / admin #0f172a）
- 破坏性用 `--color-danger`（红）
- 成功用 `--color-success`（绿）
- 提示用 `--color-warning`（橙）

---

## 6. 安全审查与加固

### 6.1 检查清单

- **CORS**：backend `CORS_ORIGINS` 白名单严格（不允许 `*`）
- **Secret 管理**：所有秘钥用 env；`.env.example` 只放占位；`SECRET_KEY` 长度 ≥ 32
- **SQL 注入**：SQLAlchemy 全部参数化（`text()` 用得少且必带 bind params）
- **XSS**：Phase 2 `description` 用 `dangerouslySetInnerHTML` 是已知偏差；Phase 7 若时间够加 DOMPurify
- **RBAC**：`admin:*` 权限矩阵严格；所有 mutating 端点校验 `require_permission`
- **敏感字段脱敏**：手机号在 user/merchant 端展示 `138****1234`；admin 明文（业务需要，日志不打印）
- **Idempotency**：`POST /orders` / `/pay` / `/aftersales` 强制 Idempotency-Key
- **Rate limiting**：Phase 7 不做（Phase 后期加 slowapi）
- **JWT**：access TTL 短（Phase 1 已配 2h）+ refresh rotate 已就位
- **密码**：bcrypt(rounds=12) 已就位
- **Nested transaction**：SAVEPOINT 用于 order_no 重试（Phase 3 已就位）
- **审计**：所有 mutating 写 `audit_log`
- **反枚举**：登录/forgot-password 已合并错误码

### 6.2 加固

按 checklist 逐条 audit；发现问题在 Phase 7 内修复。

### 6.3 工具

用 `/security-review` skill 对 develop 分支自动 audit，输出报告到 `docs/SECURITY_AUDIT.md`。

---

## 7. 文档终稿

### 7.1 更新

- `README.md`：项目概览、快速开始、目录结构、里程碑 tag 列表
- `docs/ARCHITECTURE.md`（新）：系统架构图、模块划分、技术选型、部署拓扑
- `docs/CONTRIBUTING.md`（新）：分支策略、commit 规范、PR 流程、run tests 本地流程
- `docs/CHANGELOG.md`：追加 v1.0.0 条目
- `docs/DEVELOPMENT_PLAN.md`：所有 Phase 标 ✅ 完成状态
- `AGENTS.md`：追加 Phase 7 沉淀

### 7.2 API 契约

`docs/API/phase-1..6-contracts.md` 已存在 → 保留；追加 `docs/API/INDEX.md` 索引所有 phase 契约。

### 7.3 交付性检查

- 新协作者 clone repo → `docker-compose up && pnpm dev:user-web` 30 min 内跑起来
- 所有 README 命令都可执行

---

## 8. Agent 分工

Phase 7 派 **4 个 subagent 并行**：

### Agent A（E2E Playwright）
- 新 workspace `e2e/`
- 6 spec 文件（user-web 4 + merchant 1 + admin 1）
- `.github/workflows/e2e-ci.yml` 只做 install + list 校验
- README

### Agent B（Backend Perf + 集成测试）
- Alembic `0006_phase7_perf_indexes.py` 补索引
- Repository selectinload 消除 N+1
- `test_integration_shopping_flow.py` 端到端 pytest
- `docs/PERF_NOTES.md`（可选）

### Agent C（三端 UI/UX 一致性）
- 三前端 Toast / EmptyState / Skeleton / Error 组件对齐样式
- 表单 accessibility（label htmlFor + aria）
- Modal focus trap
- 主色 / 破坏色变量统一
- 各端 CHANGELOG-per-frontend note（可选）

### Agent D（Security audit + 文档终稿）
- 对照 §6.1 checklist 逐条 audit；输出 `docs/SECURITY_AUDIT.md`
- 发现严重问题当场修（否则 flag）
- 写 `docs/ARCHITECTURE.md`（架构图 + 模块 + 部署）
- 写 `docs/CONTRIBUTING.md`
- 更新 `README.md` 加 里程碑 tag 表 + Quick Start 校对
- 更新 `docs/DEVELOPMENT_PLAN.md` 标 Phase 完成
- 追加 `docs/API/INDEX.md`
- CHANGELOG.md 追加 v1.0.0

---

## 附录 A：Phase 7 结束的产物

- v1.0.0 tag（项目主版本发布）
- v0.8.0-phase7 tag（内部 phase 标记）
- `docs/SECURITY_AUDIT.md` + `docs/ARCHITECTURE.md` + `docs/CONTRIBUTING.md`
- e2e/ workspace（可运行 E2E 测试）
- 后端 pytest 数量增加（integration test）
- 三前端 UI 一致性提升

## 附录 B：本 Phase 之后的可选（不属于交付）

- CDN + 图片压缩
- 全文搜索升级 Meilisearch
- 后台 worker（ARQ）替换 cron 脚本
- 监控（Grafana + Loki + Prometheus）
- iOS / 商家 App / Admin App
- 真实支付网关（微信/支付宝 SDK）
