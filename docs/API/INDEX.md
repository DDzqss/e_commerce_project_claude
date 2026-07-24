# API 契约索引 · JD-Clone

> 本项目采用 **契约优先（Contract-First）** 开发模式：每个 Phase 先定稿契约文档，Backend Agent 按此实现 API，Frontend Agents 按此对接。契约本身就是跨 Agent 的沟通语言。
>
> 若实现中发现契约不合理，**先改契约再改代码**，不允许两边默默偏离。

---

## 契约清单

| Phase | 主题 | 文档 | 核心内容 |
|---|---|---|---|
| **Phase 1** | 认证 + RBAC + 商家入驻 | [`phase-1-contracts.md`](phase-1-contracts.md) | 统一响应结构 · 4 位错误码 · 三身份域（user/merchant/admin）· 7 张表 · 20+ 端点 · 11 权限键 · JWT (HS256 + aud claim) · Refresh rotate · 商家入驻状态机 |
| **Phase 2** | 商品目录 + 上架审核 + 图片上传 | [`phase-2-contracts.md`](phase-2-contracts.md) | Category(3 级) / Brand / SPU / SKU · SPU 状态机 (draft → pending_review → approved / rejected / off_shelf) · 强关键字段编辑回审 · MinIO Presigned URL 直传 · 库存日志只写不改 |
| **Phase 3** | 交易核心（购物车 + 订单 + 支付模拟） | [`phase-3-contracts.md`](phase-3-contracts.md) | 7 张表 · 订单 6 态 × 4 角色触发矩阵 · 库存锁定规则 · **Idempotency-Key 强制** · 支付会话 partial UNIQUE · 超时扫描（30 min 未付 / 15 天未确认收货） · 订单快照策略 |
| **Phase 4** | 售后闭环（三方联动 + 平台仲裁 + 超时升级） | [`phase-4-contracts.md`](phase-4-contracts.md) | 3 类售后 (REFUND_ONLY / RETURN_REFUND / EXCHANGE) · **12 态状态机** · 4 类超时升级 · 6-stage 凭证系统 · 平台仲裁 3 outcome · 强制退款 · 催办频控 + 单次申诉 · 风控 30 天 3 单自动升级 |
| **Phase 5** | 评价 + 通知 + 地区 + 店铺主页 | [`phase-5-contracts.md`](phase-5-contracts.md) | 商品评价（先发后审 + 15 天/1 次编辑窗口） · 举报队列 · 站内信 60s 轮询 + 事件驱动写入 · 3 级地区表（34 省 + 304 市 + 258 区） · 商家店铺主页 |
| **Phase 6** | Android 客户端架构 | [`phase-6-android-architecture.md`](phase-6-android-architecture.md) | Kotlin/Compose 单模块分层 · AuthTokenManager (DataStore) + AuthInterceptor (Mutex 单飞 refresh) · NavRoutes 22 常量 · UiState + ViewModel 模板 · ApiEnvelope + 错误码中文映射 · Coil3 RemoteImage |

---

## 通用约定（沿用全 Phase）

- **响应结构**：`{ "code": int, "message": string, "data": any }`（HTTP status 与 `code` 同时反映成功/失败）
- **分页**：`?page=1&size=20` → `{ items, total, page, size }`
- **错误码**：4 位数字，模块化分段（1xxx auth · 2xxx user · 3xxx merchant · 5xxx generic · 6xxx-23xxx 业务模块）
- **JWT**：`Authorization: Bearer <access>` · `aud=user|merchant|admin` 强隔离
- **幂等**：`POST /orders` / `/payments` / `/aftersales` 强制携带 `Idempotency-Key` (8-120 chars)
- **审计**：所有 mutating 端点写 `audit_log`（actor_type = user/merchant/admin/system）

---

## 相关文档

- [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md) — 系统架构、状态机图、部署拓扑
- [`docs/CHANGELOG.md`](../CHANGELOG.md) — 每 Phase 交付内容
- [`docs/DEVELOPMENT_PLAN.md`](../DEVELOPMENT_PLAN.md) — 项目愿景与里程碑
- [`AGENTS.md`](../../AGENTS.md) §10 — 契约维护规程

---

**契约维护规则**（AGENTS §7.4 / §10）：
1. 契约文档一经 Phase 启动定稿，不轻易改；如需改必须 Orchestrator 与其他 Agent 同步
2. 版本号 = Phase 号；不追加 minor version，重大变更升 Phase
3. 契约偏差在对应 Phase 的 CHANGELOG 里显式标注，供后续追溯
