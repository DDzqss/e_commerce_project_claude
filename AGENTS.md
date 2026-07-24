# AGENTS.md — 多智能体协作与项目开发规范

> 本文档定义 **JD-Clone 电商平台** 项目中所有智能体（Agents）的分工、协作方式、Git 工作流、可用 Skills 与开发纪律。
> 所有参与本项目的 AI 智能体（Claude Code 主体 + Subagents）与人类协作者必须遵守本文档。
>
> 版本：v1.0 | 更新日期：2026-07-22

---

## 目录

1. [核心开发纪律](#1-核心开发纪律)
2. [Git 版本管理与协同规范](#2-git-版本管理与协同规范)★重点
3. [Multi-Agent 分工策略](#3-multi-agent-分工策略)★重点
4. [各分支职责与负责 Agent 对照表](#4-各分支职责与负责-agent-对照表)★重点
5. [可用 Skills / Plugins / MCP 清单（已配置）](#5-可用-skills--plugins--mcp-清单本项目实际已配置)
6. [后续可选补充](#6-后续可选补充)
7. [Agent 协作规程](#7-agent-协作规程)
8. [代码提交与 PR 规范](#8-代码提交与-pr-规范)
9. [业务深度思考纪律](#9-业务深度思考纪律)
10. [文档与知识沉淀](#10-文档与知识沉淀)
11. [填坑清单（历次 Phase 沉淀）](#11-填坑清单历次-phase-沉淀)★

---

## 1. 核心开发纪律

### 1.1 不可协商的红线（Hard Rules）

1. **永远不要在未经用户确认的情况下 `git push --force`、`reset --hard`、删除分支或写入生产环境。**
2. **每完成一个开发阶段（Phase），必须完成 Git 提交并推送到远端仓库。** 未推送不算完成。
3. **任何修改数据库结构的 PR 必须包含 Alembic 迁移脚本，禁止手改表结构。**
4. **禁止将秘钥、`.env`、私钥、数据库转储文件提交到 Git。**
5. **所有 API 变更必须同步更新 OpenAPI schema（FastAPI 自动生成）和前端 API 客户端类型。**
6. **不允许绕过 pre-commit hooks（`--no-verify` 除非用户明确要求）。**

### 1.2 每个 Phase 结束时的强制动作

按顺序执行，缺一不可：

1. 运行所有测试（后端 pytest、前端 vitest、e2e playwright）并全绿
2. 运行 `/security-review` 对本 Phase 变更做安全审查
3. 运行 `/simplify` 对新增代码做简化审查
4. 更新 `docs/CHANGELOG.md`
5. 更新 `docs/DEVELOPMENT_PLAN.md` 中对应 Phase 的完成状态
6. 提交并推送到远端
7. 打 Tag：`git tag vX.Y.0-phaseN && git push --tags`
8. 在 GitHub 上创建 Release Notes

---

## 2. Git 版本管理与协同规范 ★

### 2.1 仓库策略

推荐使用 **Monorepo**（单一仓库多 workspace）便于统一版本与联调；如团队规模较大，也可采用 **Multi-repo**（每端一个仓库）。本项目默认 Monorepo，结构：

```
e_commerce_project_claude/
├── backend/                    # FastAPI 后端
├── frontend-user-web/          # 用户 Web 端
├── frontend-merchant/          # 商家后台
├── frontend-admin/             # 管理员后台
├── android-app/                # Android 客户端
├── docs/                       # 全局文档
├── infra/                      # Docker、CI/CD 配置
├── .github/                    # GitHub Actions workflows
├── AGENTS.md                   # 本文档
└── README.md
```

### 2.2 分支策略（GitFlow 简化版）

```
main                (受保护，只接受来自 release/* 或 hotfix/* 的合并)
  ↑
release/vX.Y.0      (发布前的稳定分支)
  ↑
develop             (集成分支，所有 feature 合并到这里)
  ↑
├── feature/backend-auth
├── feature/backend-order
├── feature/user-web-cart
├── feature/merchant-product
├── feature/admin-refund-review
├── feature/android-login
├── bugfix/order-status-race
└── hotfix/critical-security-fix   (直接从 main 拉出，修复后合回 main + develop)
```

**分支命名规则**：

| 前缀 | 用途 | 示例 |
|---|---|---|
| `feature/` | 新功能 | `feature/backend-order-refund` |
| `bugfix/` | 非紧急 bug | `bugfix/cart-quantity-negative` |
| `hotfix/` | 生产紧急修复 | `hotfix/auth-token-leak` |
| `refactor/` | 重构 | `refactor/service-layer-async` |
| `docs/` | 文档 | `docs/api-order-spec` |
| `chore/` | 杂项 | `chore/upgrade-deps` |

**分支名称还应包含端侧标识**，便于多 agent 并行：
- `feature/backend-*` — 后端
- `feature/user-web-*` — 用户 Web
- `feature/merchant-*` — 商家后台
- `feature/admin-*` — 管理员后台
- `feature/android-*` — Android

### 2.3 保护规则（GitHub Settings）

- `main` 分支：
  - 禁止直接 push
  - 需要 PR + 至少 1 个 review approval
  - 需要 CI 全绿
  - 需要分支为最新
- `develop` 分支：
  - 禁止 force push
  - 需要 PR + CI 通过

### 2.4 Commit 消息规范（Conventional Commits）

格式：`<type>(<scope>): <subject>`

| type | 用途 |
|---|---|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 文档 |
| `style` | 代码风格（不影响功能） |
| `refactor` | 重构 |
| `test` | 测试 |
| `chore` | 构建/依赖 |
| `perf` | 性能优化 |

**scope 示例**：`backend`、`user-web`、`merchant`、`admin`、`android`、`api`、`db`

示例：
```
feat(backend): 新增订单退款状态机与超时任务

- 支持 6 种退款状态流转
- 商家 72h 未响应自动升级至客服
- 增加 order_status_history 审计表

Refs: #123
```

### 2.5 每阶段推送流程（强制）

```bash
# 1. 确保在正确的 feature 分支
git status
git branch --show-current

# 2. 运行测试（示例）
cd backend && pytest
cd ../frontend-user-web && pnpm test

# 3. 提交
git add <specific-files>   # 禁止 git add .
git commit -m "feat(backend): ..."

# 4. rebase 最新 develop
git fetch origin
git rebase origin/develop

# 5. 推送
git push origin feature/backend-order-refund

# 6. 创建 PR 到 develop（使用 gh CLI）
gh pr create --base develop --title "feat(backend): 订单退款状态机" --body "..."
```

### 2.6 阶段合并到 develop 后

```bash
# 从 develop 打 tag
git checkout develop
git pull
git tag v0.3.0-phase3 -m "Phase 3: 交易核心完成"
git push --tags

# 发布分支（发版前）
git checkout -b release/v0.3.0
```

---

## 3. Multi-Agent 分工策略 ★

本项目**必须采用 Multi-Agent 并行开发**以提高效率。以下为智能体角色划分：

### 3.1 核心 Agent 角色

| Agent 角色 | 职责 | 使用的 subagent_type |
|---|---|---|
| **Orchestrator（主 Claude）** | 任务分派、Phase 协调、PR 合并决策 | 主体 |
| **Planner Agent** | 每个 Phase/大功能的实现方案设计 | `Plan` |
| **Backend Agent** | FastAPI 后端开发 | `general-purpose`（携带后端上下文） |
| **User-Web Agent** | 用户 Web 端开发 | `general-purpose`（携带前端上下文） |
| **Merchant-Web Agent** | 商家后台开发 | `general-purpose` |
| **Admin-Web Agent** | 管理员后台开发 | `general-purpose` |
| **Android Agent** | Android App 开发 | `general-purpose`（配合 Kotlin LSP plugin） |
| **Explorer Agent** | 定位代码、跨模块引用查找 | `Explore` |
| **Reviewer Agent** | PR 审查、代码简化审查 | `general-purpose` + `/review` skill |
| **Security Agent** | 每 Phase 结束的安全审计 | `general-purpose` + `/security-review` |
| **Test Agent** | 单元测试、E2E 测试编写 | `general-purpose` |
| **Docs Agent** | API 文档、CHANGELOG、README 维护 | `general-purpose` |

### 3.2 并行策略

**规则**：同一 Phase 内互相独立的任务，Orchestrator 应在**同一条消息**中启动多个 Agent 并行执行。

**典型并行编排**（Phase 3 交易核心）：

```
Orchestrator 一次性并发启动：
├── Backend Agent A: 订单表结构 + 状态机核心
├── Backend Agent B: 购物车 API
├── User-Web Agent: 购物车页面 + 下单流程 UI
├── Merchant-Web Agent: 订单处理列表 UI
├── Admin-Web Agent: 订单总览 Dashboard UI
└── Docs Agent: OpenAPI schema 同步 + API 文档
```

**依赖关系**：
- API 契约先行：Backend Agent 完成 schema 定义后，前端 Agent 才能开始接入
- Orchestrator 负责判断依赖并串/并
- 各端 UI 可先用 Mock 数据开发，与后端并行

### 3.3 每个 Agent 启动时的标准提示词（模板）

Orchestrator 启动 subagent 时，prompt 必须包含：

```
[身份] 你是 <角色名> Agent，负责 <具体模块>。
[分支] 请在分支 <feature/xxx> 上工作。若不存在则先创建。
[规范] 严格遵守 AGENTS.md 与 DEVELOPMENT_PLAN.md。
[任务]
  1. <具体任务 1>
  2. <具体任务 2>
[输入] 已知信息：<数据库 schema、上游 API 契约、UI 设计稿等>
[输出] 完成后：
  - 提交至分支
  - 生成本次改动摘要（< 200 字）
  - 列出未完成/阻塞项
[禁止] 不得推送到 main/develop；不得修改其他模块代码
```

### 3.4 Agent 沟通协议

- Agent 之间**不直接通信**，全部通过 Orchestrator 中转
- 通过 Git 分支和 PR 描述作为"沟通日志"
- 关键决策记录到 `docs/DECISIONS/` 目录（ADR - Architecture Decision Record）

---

## 4. 各分支职责与负责 Agent 对照表 ★

### 4.1 Phase 0：项目筹备

| 分支 | 内容 | Agent |
|---|---|---|
| `chore/init-monorepo` | 目录结构、pnpm workspace、README | Orchestrator |
| `chore/backend-skeleton` | FastAPI 骨架、pyproject.toml、Alembic | Backend |
| `chore/frontend-skeleton-user-web` | Next.js 骨架 | User-Web |
| `chore/frontend-skeleton-merchant` | Next.js 骨架 | Merchant-Web |
| `chore/frontend-skeleton-admin` | Next.js 骨架 | Admin-Web |
| `chore/android-skeleton` | Android Studio 项目 | Android |
| `chore/ci-cd-setup` | GitHub Actions workflows | Orchestrator |
| `chore/docker-compose` | 本地开发环境 | Backend |

### 4.2 Phase 1：基础能力

| 分支 | 内容 | Agent |
|---|---|---|
| `feature/backend-auth` | 用户/商家/管理员认证、JWT、Refresh Token | Backend |
| `feature/backend-rbac` | 角色权限模型、依赖注入校验 | Backend |
| `feature/backend-merchant-onboarding` | 商家入驻申请、审核 API | Backend |
| `feature/user-web-auth` | 登录/注册/找回密码 UI | User-Web |
| `feature/merchant-auth` | 商家登录 + 入驻申请 UI | Merchant-Web |
| `feature/admin-auth` | 管理员登录 + 商家审核 UI | Admin-Web |
| `feature/ui-kit` | 三端共享设计规范、通用组件 | User-Web（主导） |

### 4.3 Phase 2：商品与浏览

| 分支 | 内容 | Agent |
|---|---|---|
| `feature/backend-product-model` | SPU/SKU/Category/Brand 模型 | Backend |
| `feature/backend-product-crud` | 商品增删改查 API | Backend |
| `feature/backend-search` | 商品搜索/筛选 API | Backend |
| `feature/backend-inventory` | 库存 API | Backend |
| `feature/user-web-product` | 商品列表/详情/搜索页 | User-Web |
| `feature/merchant-product` | 商品上架/编辑/库存管理 | Merchant-Web |
| `feature/admin-product-review` | 商品审核、下架 | Admin-Web |

### 4.4 Phase 3：交易核心 ★

| 分支 | 内容 | Agent |
|---|---|---|
| `feature/backend-cart` | 购物车 API | Backend |
| `feature/backend-order-model` | 订单模型 + 状态历史表 | Backend |
| `feature/backend-order-flow` | 下单/取消/关闭 + 状态机 | Backend |
| `feature/backend-payment-mock` | 模拟支付网关 | Backend |
| `feature/backend-order-timeout-tasks` | 超时未支付/超时未收货任务 | Backend |
| `feature/user-web-cart` | 购物车 UI | User-Web |
| `feature/user-web-checkout` | 结算下单 UI | User-Web |
| `feature/user-web-order-list` | 我的订单 | User-Web |
| `feature/merchant-order` | 订单处理台 | Merchant-Web |
| `feature/admin-order-overview` | 订单大盘、干预操作 | Admin-Web |

### 4.5 Phase 4：售后闭环 ★

| 分支 | 内容 | Agent |
|---|---|---|
| `feature/backend-refund-model` | 售后表 + 状态机 + 凭证 | Backend |
| `feature/backend-refund-flow` | 申请/审核/仲裁 API | Backend |
| `feature/backend-refund-timeout` | 商家超时升级、用户失联自动收货 | Backend |
| `feature/user-web-refund` | 售后申请、进度、催办、申诉 | User-Web |
| `feature/merchant-refund` | 售后审核、拒绝理由、上传凭证 | Merchant-Web |
| `feature/admin-refund-arbitration` | 客服仲裁台、强制退款 | Admin-Web |

### 4.6 Phase 5：辅助功能

| 分支 | 内容 | Agent |
|---|---|---|
| `feature/backend-review` | 商品评价 API | Backend |
| `feature/backend-notification` | 站内信 + 事件订阅 | Backend |
| `feature/backend-address` | 地址簿 + 地区数据 | Backend |
| `feature/user-web-review` | 评价 UI | User-Web |
| `feature/merchant-shop` | 店铺主页管理 | Merchant-Web |
| `feature/admin-review-moderation` | 评价审核 | Admin-Web |

### 4.7 Phase 6：Android App（并行）

| 分支 | 内容 | Agent |
|---|---|---|
| `feature/android-auth` | 登录/注册 | Android |
| `feature/android-product` | 商品浏览 | Android |
| `feature/android-cart-checkout` | 购物车与下单 | Android |
| `feature/android-order-refund` | 订单与售后 | Android |

### 4.8 Phase 7：打磨与测试

| 分支 | 内容 | Agent |
|---|---|---|
| `test/backend-integration` | 后端集成测试补齐 | Test |
| `test/e2e-playwright` | 前端 E2E 测试 | Test |
| `perf/backend-optimize` | 慢查询优化、索引补充 | Backend |
| `fix/ui-polish-*` | UI/UX 细节打磨 | 各前端 |
| `docs/final-*` | 文档终稿 | Docs |
| `chore/security-hardening` | 安全加固 | Security |

---

## 5. 可用 Skills / Plugins / MCP 清单（本项目实际已配置）

### 5.1 已配置 MCP Servers

| MCP | 类型 | 用途 |
|---|---|---|
| **github** | HTTP (`api.githubcopilot.com/mcp/`) | 仓库管理、Issue/PR 操作、代码搜索 |

### 5.2 内置可调用 Skills（无需安装）

| Skill | 用途 | 本项目场景 |
|---|---|---|
| **officecli** | 处理 .docx / .xlsx / .pptx | 生成交付文档、汇报 PPT |
| **update-config** | 修改 Claude Code settings.json | 配置 hooks、允许命令 |
| **keybindings-help** | 自定义快捷键 | — |
| **simplify** | 审查代码简洁性 | 每个 Phase 结束 |
| **fewer-permission-prompts** | 减少权限打扰 | 项目初期 |
| **loop** | 定时循环运行 prompt | 轮询构建/测试 |
| **claude-api** | Claude API 应用构建 | 若加入 AI 客服 |
| **init** | 生成 CLAUDE.md | 每个 subpackage |
| **review** | 审查 PR | 每次 PR 合并前 |
| **security-review** | 分支安全审查 | 每 Phase 结束、认证/支付变更 |

### 5.3 已安装 Marketplace Plugins（★ 已装）

**来自 `claude-plugins-official`：**

| 插件 | 用途 | 项目场景 |
|---|---|---|
| **feature-dev** | 完整功能开发流程 | 每个 feature 分支启动 |
| **pr-review-toolkit** | PR 审查完整工具集 | 每次 PR 合并前 |
| **commit-commands** | 智能 commit 消息 | 统一 commit 规范 |
| **security-guidance** | 安全指导 + 差分审查 | 认证、支付、权限模块 |
| **session-report** | 会话汇报生成 | Phase 结束汇报 |
| **claude-md-management** | CLAUDE.md 维护 | 各 workspace 文档 |
| **hookify** | 生成 Claude Code hooks | 自动 lint/test |
| **pyright-lsp** | Python 类型检查 LSP | 后端开发 |
| **typescript-lsp** | TypeScript LSP | 前端开发 |
| **kotlin-lsp** | Kotlin LSP | Android 开发 |
| **frontend-design** | 生成生产级前端设计 | 三端 UI 打磨 |
| **playwright** | Playwright MCP | E2E 测试 |
| **modern-web-guidance** | 现代 web 最佳实践 | 全前端 |
| **superpowers** | 多智能体协作核心库 | TDD、调试、协作模式 |
| **logfire** | FastAPI 自动观测 | 后端追踪、日志 |
| **postman** | API 生命周期管理 | 后端 API 契约 |

**来自 `anthropic-agent-skills`：**

| 插件 | 用途 | 项目场景 |
|---|---|---|
| **document-skills** | Office 文档处理套装 | 需求文档、导出 |
| **example-skills** | 示例 skills 合集（含 skill-creator 等） | 自定义 skill 开发 |
| **claude-api** | Claude API SDK 文档 | 若集成 AI 特性 |

**来自 `trailofbits/skills-curated`（社区权威 marketplace，467+ stars）：**

| 插件 | 用途 | 项目场景 |
|---|---|---|
| **planning-with-files** | 基于文件的多步骤规划 | 复杂功能规划 |
| **openai-gh-fix-ci** | 修复失败的 GitHub CI 检查 | CI 故障排查 |
| **openai-gh-address-comments** | 响应 PR review 评论 | PR 迭代 |
| **openai-security-threat-model** | 仓库级威胁建模 | 认证/支付模块 |
| **openai-security-best-practices** | 语言/框架特定安全审查 | 每 Phase 安全审计 |
| **python-code-simplifier** | Python 代码简化 | 后端重构 |
| **security-awareness** | 安全威胁识别 | 日常开发感知 |

**来自 `obra/superpowers-marketplace`（1.1k+ stars）：**

| 插件 | 用途 | 项目场景 |
|---|---|---|
| **claude-session-driver** | ★★ 通过 tmux 启动/控制其他 Claude Code sessions 作为 worker | Multi-Agent 并行开发的核心工具 |
| **superpowers-chrome** | 直接 CDP 访问 Chrome | UI 调试、真实浏览器操作 |
| **episodic-memory** | 跨会话语义搜索 | 长项目回忆历史决策 |

### 5.4 已配置 Marketplaces

```
- anthropic-agent-skills           (官方)
- claude-plugins-official          (官方)
- skills-curated                   (trailofbits, 社区权威)
- superpowers-marketplace          (obra, 最热门)
```

### 5.5 每阶段标准 Skill 组合

```
# 开始新 feature 时
/feature-dev              # 规划实现路径
/planning-with-files      # 生成多步骤计划

# 开发过程中
/superpowers              # 复杂问题时启用 TDD/协作模式
/frontend-design          # 前端页面设计
/logfire                  # 后端可观测性接入

# 提交前
/commit-commands          # 生成规范 commit
/simplify / python-code-simplifier  # 代码简化
/security-guidance        # 增量安全审查

# PR 阶段
/pr-review-toolkit        # PR 全面审查
/review                   # 补充审查
/openai-gh-address-comments  # 响应 review 评论
/openai-gh-fix-ci         # 修复 CI

# Phase 结束
/security-review + /openai-security-best-practices  # 安全审计
/openai-security-threat-model  # 威胁建模（认证/支付相关）
/session-report           # 生成 Phase 汇报
/init / claude-md-management  # 更新各 workspace CLAUDE.md
```

### 5.6 Multi-Agent 关键工具

- **claude-session-driver** — 通过 tmux 派生独立 Claude Code session，让 Orchestrator 真正驱动多个并行 Agent（超越单会话的 subagent 限制）
- **superpowers** — 提供 subagent 驱动的开发框架
- **Agent 工具 + subagent_type** — Orchestrator 一条消息中派多个 subagent 并发工作

---

## 6. 后续可选补充

如需扩展，还可考虑安装：

| 插件 | 来源 | 用途 |
|---|---|---|
| **linear** | claude-plugins-official | Linear 任务管理集成 |
| **atlassian** | claude-plugins-official | Jira/Confluence 集成 |
| **prisma** | claude-plugins-official | 备选 ORM（本项目用 SQLAlchemy 不装） |
| **skill-creator** | 已在 example-skills 内 | 沉淀本项目专属 skill |
| **mcp-server-dev** | claude-plugins-official | 自定义 MCP 开发 |

**红线**：任何第三方 marketplace 添加前必须核验：
1. GitHub star ≥ 100（或来自可信组织）
2. 最近 3 个月有活跃提交
3. 无可疑代码（下载后先看 hooks/scripts）

---

## 7. Agent 协作规程

### 7.1 Orchestrator 每日启动流程

1. 阅读 `docs/DEVELOPMENT_PLAN.md` 确认当前 Phase
2. 阅读 `docs/CHANGELOG.md` 了解昨日进度
3. `git status` + `git log --oneline -10` 检查工作树状态
4. 拉取远端 `git fetch --all --prune`
5. 列出今日待办（TaskCreate）
6. 决定哪些任务并行、哪些串行
7. 启动对应 Agents

### 7.2 阻塞处理

- Agent 遇到阻塞（如需要业务决策、依赖未就绪），必须**立即返回**并附：
  - 阻塞原因
  - 至少 2 个可选方案 + 各自 trade-off
  - 推荐方案
- Orchestrator 使用 `AskUserQuestion` 与用户确认后再继续

### 7.3 上下文隔离

- 每个 Agent 只关注自己的分支和模块
- 跨模块信息通过 Orchestrator 提供的"上下文包"传递
- 严禁 Agent 直接改动其他模块代码（会造成合并冲突）

---

## 8. 代码提交与 PR 规范

### 8.1 PR 模板（`.github/pull_request_template.md`）

```markdown
## 关联
- Phase: <N>
- Issue: #<issue_number>
- 分支: <feature/xxx>

## 变更摘要
<1-3 句话>

## 变更类型
- [ ] feat / fix / refactor / docs / test / chore

## 涉及端侧
- [ ] backend
- [ ] user-web
- [ ] merchant-web
- [ ] admin-web
- [ ] android

## 数据库变更
- [ ] 无
- [ ] 包含 Alembic 迁移（脚本已附）

## 测试
- [ ] 单元测试
- [ ] 集成测试
- [ ] E2E 测试
- [ ] 手动测试（截图/录屏）

## 业务深度检查
- [ ] 已考虑正常流程
- [ ] 已考虑异常流程（超时、失败、并发）
- [ ] 已考虑权限（三角色视角）
- [ ] 已考虑体验细节（loading/error/empty 状态）

## Security Review
- [ ] 已运行 /security-review（无高危项）

## 部署备注
<如需环境变量、数据迁移等>
```

### 8.2 Review Checklist（Reviewer Agent 使用）

- [ ] 代码符合项目规范（lint 通过）
- [ ] 无硬编码（配置项进 env）
- [ ] 无秘钥泄露
- [ ] 错误处理完整（无裸 `except:`）
- [ ] API 输入用 Pydantic Schema 校验
- [ ] 数据库操作用参数化（无 SQL 注入）
- [ ] 权限校验齐全
- [ ] 测试覆盖到分支
- [ ] 文档同步
- [ ] 无死代码/无用注释

---

## 9. 业务深度思考纪律

### 9.1 每个功能开始前必回答的问题

**Orchestrator 向 Agent 派发任务前，必须先回答**：

1. **三角色视角**：用户、商家、管理员分别如何使用这个功能？
2. **状态维度**：涉及哪些状态？状态之间怎么流转？非法流转怎么拦截？
3. **异常维度**：
   - 网络断开、并发冲突？
   - 某一方超时不响应？
   - 某一方作恶？
4. **联动维度**：
   - 该功能会触发哪些其他功能？（如：下单 → 减库存 → 通知商家）
   - 出错回滚谁负责？
5. **体验维度**：
   - 页面 loading / error / empty 三态是否齐全？
   - 操作路径是否 ≤ 3 步？
   - 是否有反馈（toast / 弹窗 / 状态变化）？

### 9.2 参考"订单退款"案例

见 `docs/DEVELOPMENT_PLAN.md` 第 6 节。**所有 P0 模块都必须按此深度设计。**

### 9.3 定期"体验巡检"

每个 Phase 结束前，Orchestrator 派发 **Explorer + Reviewer Agent** 联合做一次"体验巡检"：

- 以真实用户身份操作一遍主流程
- 记录不顺畅的细节到 `docs/UX_ISSUES.md`
- 下 Phase 优先修复

---

## 10. 文档与知识沉淀

### 10.1 必须维护的文档

| 文档 | 位置 | 更新时机 |
|---|---|---|
| 开发规划 | `docs/DEVELOPMENT_PLAN.md` | 每 Phase 完成时 |
| Agent 协作 | `AGENTS.md`（本文件） | 每次流程调整 |
| 变更日志 | `docs/CHANGELOG.md` | 每次合并到 develop |
| 架构决策 | `docs/DECISIONS/ADR-XXX.md` | 每个重大决策 |
| API 契约 | 后端自动生成的 OpenAPI 文档 | 每次 API 变更 |
| 数据库 ER 图 | `docs/db/ERD.md` | 每次表结构变更 |
| UX 问题清单 | `docs/UX_ISSUES.md` | 巡检时 |
| 子项目 CLAUDE.md | 各 workspace 根目录 | 项目结构变动时 |

### 10.2 CLAUDE.md 建议（每个 workspace 一份）

内容包括：
- 该 workspace 的目的与范围
- 目录结构说明
- 常用命令（启动、测试、构建）
- 编码约定
- 常见问题
- 与其他 workspace 的接口约定

使用 `/init` skill 快速生成初版。

---

## 11. 附录：快速命令备忘

```bash
# 启动后端
cd backend && uvicorn app.main:app --reload

# 启动用户 Web 端
cd frontend-user-web && pnpm dev

# 全部启动
docker-compose up

# 数据库迁移
cd backend && alembic revision --autogenerate -m "add order table"
alembic upgrade head

# 运行测试
cd backend && pytest -v
cd frontend-user-web && pnpm test

# Git 常用
git status
git switch -c feature/backend-order-refund
git commit -m "feat(backend): ..."
git push -u origin HEAD
gh pr create --base develop
```

---

## 11. 填坑清单（历次 Phase 沉淀）

本节记录在实战中踩过的坑与对应对策，避免后续 Phase 与新增 Agent 重复失误。**Agent 在启动前应先扫一遍相关分类。**

### 11.1 跨平台 / 大小写敏感

| 坑 | 症状 | 对策 |
|---|---|---|
| macOS 大小写不敏感 vs Linux CI 敏感 | 本地 build 通过，CI import 报 "Cannot find module" | Agent 在提交前必须跑 `git ls-files <dir>` 核对文件是否真的入库；命名一律 kebab-case 或明确规则 |
| `.gitignore` 使用过宽的通用词 | Python venv 的 `lib/` 规则误伤前端 `src/lib/`；本地 Mac 无感、Linux CI 报缺文件 | **各语言/框架规则放到对应 workspace 的 `.gitignore`**，根 `.gitignore` 只放跨端通用（OS/IDE/.env/logs/db 卷）|
| 文件路径含大写字母被 rename 大小写 | git 不感知，需要 `git mv -f` 或双步 rename | Agent 一开始就选定命名，避免大小写变更 |

### 11.2 Node / pnpm / Next.js

| 坑 | 症状 | 对策 |
|---|---|---|
| pnpm 11+ 需要 Node ≥ 22（用了 `node:sqlite`） | CI `ERR_UNKNOWN_BUILTIN_MODULE: node:sqlite` | `.nvmrc` 与 CI 都用 Node 22+；`package.json.engines.node` 声明 `>=22` |
| `pnpm/action-setup` 的 `version:` 与 `packageManager` 冲突 | CI 报 "Multiple versions of pnpm specified" | 只在一处指定：优先用 `packageManager: pnpm@x.y.z`，action 不传 `version` |
| pnpm workspace 隐性 hoisting 让本地"能跑"但 CI 挂 | `@eslint/eslintrc` 被 A workspace 用了但只在 B workspace 声明；本地 pnpm 从 A 找到，CI strict resolution 找不到 | **每个 workspace 必须显式声明它 import 的所有包**，即便看起来在别处已装 |
| Next.js `experimental.typedRoutes` 与 `string` href 类型不兼容 | `Type 'string' is not assignable to type 'UrlObject \| RouteImpl<string>'` | 要么全端统一开启并把 href 类型改为 `Route`；要么 Phase 0/1 不开，留到统一改造 |
| Tailwind CSS 4 抛弃 `tailwind.config.ts` | 用旧格式配置无效 | 全部主题变量放在 `globals.css` 的 `@import "tailwindcss"` + `@theme { ... }`，PostCSS 用 `@tailwindcss/postcss` |
| `next lint` 在 Next 15 已 deprecated | 有 warning，Next 16 会删除 | Phase 2/3 迁移到 `eslint` CLI（`next-lint-to-eslint-cli` codemod） |

### 11.3 Python / FastAPI / uv

| 坑 | 症状 | 对策 |
|---|---|---|
| pydantic-settings 的 `Literal` 字段严格 | CI 传了非枚举值（如 `ENVIRONMENT=test`）就报 validation error | Settings 枚举字段要在文档写清可选值；CI 配置里的值必须匹配 |
| `MINIO_SECRET_KEY = "minioadmin"` 触发 ruff S105 | ruff 认为是硬编码密码 | 加 `# noqa: S105  dev-only default; production must override via env` 注释说明 |
| ruff PT018 禁止一行内多断言 | `assert x in body and isinstance(...)` 被拆 | 每个断言独占一行 |
| **`bcrypt` 5.0+ 与 `passlib` 1.7.x 不兼容** | 测试报 `ValueError: password cannot be longer than 72 bytes` 即使密码很短 | pin `bcrypt>=4.0,<5.0`（passlib 停更多年未适配 bcrypt 4+ 的 API 变化）；长期方案是直接用 `bcrypt` 库或迁移到 `argon2-cffi` |
| **SQLAlchemy 2.0 async 缺 greenlet** | 报 `ValueError: the greenlet library is required`；本地已装可能碰巧有，CI 全新装必挂 | 依赖里显式声明 `sqlalchemy[asyncio]` **或** `greenlet>=3.0`；两个都写更保险 |
| **SQLite 不给 `BigInteger` 自增** | 用 aiosqlite 跑测试报 `NOT NULL constraint failed: users.id`；Postgres 无碍 | `BigInteger().with_variant(Integer, "sqlite")` 定义 `BigIntId` 类型；PK 与 FK 全部用这个 |
| **`session.flush()` 后 Pydantic 序列化访问 `updated_at`** | `MissingGreenlet: greenlet_spawn has not been called` — 因 `onupdate=func.now()` 需要 refresh 才能拿到新值 | 状态变更后写 `await session.refresh(row)` 再返回 |
| **Agent 本地 `.venv` 缓存旧依赖** | Agent 本地 pytest pass，CI 全新装挂 4 类问题 | Agent 在启动前必须 `uv sync --refresh --all-extras` 或删掉 `.venv` 重装；Orchestrator 派活时明确要求 |
| **CI ruff 版本比 Agent 本地新** | 本地 `ruff check` 全绿，CI 报 25 个 PLC0415 / RUF001 / PT018 | 在 `ruff.toml` `ignore` 里加合理规则（PLC0415 局部 import 用于避免循环依赖；PLR0911 状态机 dispatcher 多返回是常态）；或本地 `uv run ruff --version` 与 CI 对齐 |
| **`order_no` 等业务 ID 唯一冲突重试破坏外层事务** | INSERT 时 UNIQUE violation → 外层事务被标脏无法继续 | 用 `session.begin_nested()` (SAVEPOINT) 包裹 INSERT + `secrets.randbelow` 重试；失败可回退到 SAVEPOINT 而非顶层事务 |
| **Partial UNIQUE index (`WHERE is_default=TRUE`) 声明位置** | SQLAlchemy 模型层用 `UniqueConstraint(postgresql_where=...)` 声明时，SQLite `create_all` 会退化为全表 UNIQUE 破坏"多条历史 default"测试 | **只在 Alembic 迁移里 `op.execute("CREATE UNIQUE INDEX ... WHERE ...")`**；模型层不声明；应用层加 `_clear_other_defaults` 兜底 |
| **SQLite 存 timezone-naive datetime** | Postgres 读回来是 aware，SQLite 读回来是 naive；datetime 比较报 `TypeError: can't compare offset-naive and offset-aware` | 服务层写 `_as_aware(dt)` 小工具补 UTC；只在读到数据库结果时补，写入统一用 aware |
| **Pydantic 字段与 ORM 列名不一致（如 `session_id` vs `id`）** | 想让接口输出 `session_id` 但 ORM 是 `id` | `Field(alias="id")` + `model_config = ConfigDict(populate_by_name=True, from_attributes=True)` |

### 11.4 CI/CD

| 坑 | 症状 | 对策 |
|---|---|---|
| 三端前端 CI matrix 只装依赖一次会互相污染 | — | 用 `pnpm --frozen-lockfile` 一次装完 workspace，然后 `pnpm --filter <ws>` 执行各步骤 |
| `next build` 的类型检查比 `tsc --noEmit` 更严 | 本地 tsc 过，CI build 挂 | Agent 完成前必须本地跑 `pnpm --filter <ws> build`，不能只跑 tsc |
| **CI ruff / formatter 版本几乎每次都比本地新** | Phase 3 (PLC0415/RUF001/PT018) → Phase 5 (C420/S110/ASYNC240/新 formatter) 反复挂 | Agent 交付前必须 `uv sync --refresh --all-extras` 拉新 ruff，再跑 `ruff check .` + `ruff format --check .`；本地缓存严禁作为"绿了"的依据 |
| **Agent API 中断** | 长任务 agent 因厂商 API InternalServerException 中断 | 用 `SendMessage(agentId, focused-prompt)` 缩小 scope 续跑（Phase 4 Admin agent 首创），比重启节省大量 tokens |
| **Kotlin package 路径 vs import 路径不一致** | Agent 在 `data/network/ApiEnvelope.kt`（包 `data.network`）声明了 `PageData`，但 5 处消费者从 `data.network.dto.PageData` 导 → Kotlin 编译 "Unresolved reference" | 交付前 `grep -r "import com.jdclone" ..` 与实际文件所在包一致性核对；Agent 尤其 Android 需自检 |
| **Compose Material3 experimental API 缺 OptIn** | `SecondaryTabRow` / `PrimaryTabRow` / `TopAppBar` / `PullToRefresh` 需要 `@OptIn(ExperimentalMaterial3Api::class)`；CI kotlinc 严格模式视 error | Agent 用 M3 未稳定 API 时**必须在函数或文件级加 OptIn**；或整个模块 `-opt-in=` compiler flag |
| **Android 多 agent 并行 → NavHost/ApiService 冲突严重** | 3 agent 并行改 `MainActivity`/`AppNavGraph`/`ApiService.kt` 会互相破坏 | Android 复杂客户端项目**用单 agent 全权交付**（配合 SendMessage 续跑处理 API 错误），避免多 agent 抢改共享基建 |

### 11.5 Agent 行为规范增强（Prompt 模板必附）

启动 subagent 时，除 §3.3 标准模板外，**必须额外强调**：

```
【交付前自检】
1. 跑 `git ls-files <你的目录>` 核对所有交付文件都已被 git 追踪，尤其是 lib/、utils/ 等易被 .gitignore 误伤的目录
2. 后端：跑 `uv run ruff check .` + `uv run pytest -v`；前端：跑 `pnpm --filter <ws> tsc --noEmit` + `pnpm --filter <ws> build`
3. 显式列出你新增依赖的 npm/PyPI 包，Orchestrator 需据此更新 lockfile
4. 命名一律 kebab-case（文件）、snake_case（Python）、camelCase（JS/TS 变量）、PascalCase（组件/类）
5. 主动汇报**契约偏差点**：若你发现契约不明确、必须假定或调整某字段/端点，在返回时**单独列出**，Orchestrator 用于对齐其他 agent
```

### 11.5.1 中断 agent 的恢复策略

**Phase 4 教训**：Admin agent 因供应商 API `InternalServerException` 中断 2 次。

- **首选：SendMessage 续跑**（`SendMessage(to=agentId, message=...)`）比重启新 agent 便宜得多，因为它保留 transcript
- **续跑提示词要缩小 scope**：先 `git ls-files` 或 `Bash ls` 确认已产出文件，只让它做剩余部分
- 续跑提示词末尾加"如果又遇到 API 错误，直接返回你写到哪里就 OK"避免陷入死循环
- 若 SendMessage 续跑连续失败 2 次以上，才考虑 fresh 新 agent（此时提示词要明确"已完成 X / 只做 Y"）

### 11.6 沉淀更新流程

每个 Phase 完成后，Orchestrator 必须：
1. 回顾本 Phase 遇到的所有 CI 挂/回滚/返工
2. 提炼 1-3 条填坑规则加到本节
3. 相应更新对应 workspace 的 `CLAUDE.md`（如有）
4. 与 Phase merge commit 一起提交

---

**本文档为 JD-Clone 项目所有 AI Agent 与人类协作者的行动准则。**
**变更本文档需经 Orchestrator 与用户共同确认。**
