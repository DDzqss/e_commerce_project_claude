# Phase 4 API 契约 · 售后闭环（退款 / 退货退款 / 换货 · 三方联动 · 平台仲裁 · 超时升级 · 凭证系统）

> **契约优先**。Backend 按此实现，Frontend 按此对接。歧义先改契约再改代码。
>
> 版本：v1.0 · 生效范围：Phase 4 · 依赖 Phase 1（认证/RBAC）+ Phase 2（SKU/图片上传）+ Phase 3（订单/支付/订单状态机）

---

## 目录
1. [沿用与新增约定](#1-沿用与新增约定)
2. [三种售后类型](#2-三种售后类型)
3. [Phase 4 新增错误码](#3-phase-4-新增错误码)
4. [数据模型](#4-数据模型)
5. [售后状态机（12 态）](#5-售后状态机12-态)
6. [Phase 4 新增 RBAC 权限](#6-phase-4-新增-rbac-权限)
7. [User · 申请与操作](#7-user--申请与操作)
8. [Merchant · 审核与收货](#8-merchant--审核与收货)
9. [Admin · 仲裁与强制处理](#9-admin--仲裁与强制处理)
10. [凭证系统（图片上传复用 Phase 2）](#10-凭证系统图片上传复用-phase-2)
11. [超时升级与自动流转](#11-超时升级与自动流转)
12. [退款执行（模拟）](#12-退款执行模拟)
13. [订单侧联动](#13-订单侧联动)
14. [风控占位](#14-风控占位)
15. [种子数据](#15-种子数据)

---

## 1. 沿用与新增约定

- 沿用 Phase 1 响应结构、JWT `aud` 分域、RBAC 依赖注入
- 沿用 Phase 2 分页 / 金额存分 / MinIO 图片上传（object_key）
- 沿用 Phase 3 订单状态机、Idempotency-Key、cron 超时脚本、audit_log 审计
- **售后单号**：18 位字符串 `AS` + `YYYYMMDD` + 10 位随机数字，如 `AS202607230000001234`
- **金额一律用整数分**（`refund_amount_cents`）
- **售后单绑定订单**：一个 order 可以有 0..N 个 aftersales，但**同时只能有 1 个 active** 售后单（active = 非最终态）
- **部分退款**：Phase 4 支持"针对订单中某几件 order_item 部分退款"（`aftersales_items` 表存明细）

---

## 2. 三种售后类型

| 类型 | 触发条件 | 主流程 | 需寄回 | Phase 4 交付 |
|---|---|---|---|---|
| **REFUND_ONLY**（仅退款） | 订单未发货 or 已发货但未收到 | 用户申请 → 商家审核 → 平台/系统退款 | ❌ | ✅ |
| **RETURN_REFUND**（退货退款） | 用户已确认收货，商品有问题 | 用户申请 → 商家同意 → 用户寄回 → 商家收货 → 退款 | ✅ | ✅ |
| **EXCHANGE**（换货） | 用户已确认收货，尺码/颜色错等 | 用户申请 → 商家同意 → 用户寄回 → 商家收货 → 商家再发货 → 用户再收货 | ✅ | ✅ |

**允许发起的订单状态**：

| 售后类型 | 允许的订单状态 |
|---|---|
| REFUND_ONLY | `paid`（未发货）/ `shipped`（发货了但未确认）|
| RETURN_REFUND | `shipped` / `completed` |
| EXCHANGE | `shipped` / `completed` |

订单未支付（`pending_payment`）→ 用户直接取消订单，不走售后流程。
订单 `cancelled` → 不可发起售后。

---

## 3. Phase 4 新增错误码

| 段 | 用途 |
|---|---|
| **15xxx** | 售后申请（`15001` 售后单不存在 / `15002` 无权访问此售后单 / `15003` 售后状态不允许当前操作 / `15004` 订单不允许发起此类型售后 / `15005` 订单已有 active 售后单 / `15006` 退款金额超过订单可退金额 / `15007` 售后类型与订单状态不匹配 / `15008` 未选择任何 order_item / `15009` 售后单已进入平台仲裁不可撤销）|
| **16xxx** | 凭证上传（`16001` 凭证数量超上限 8 张 / `16002` 凭证不属于此售后单）|
| **17xxx** | 物流回填（`17001` 快递单号无效 / `17002` 售后单尚未同意退货 / `17003` 售后单已回填过物流不可再回填）|
| **18xxx** | 仲裁（`18001` 尚未升级至平台不能仲裁 / `18002` 仲裁已完成 / `18003` 强制退款金额非法）|

---

## 4. 数据模型

### 4.1 售后单 Aftersales

```
aftersales
├─ id                        BIGINT PK
├─ aftersales_no             VARCHAR(32) UNIQUE NOT NULL  -- AS202607230000001234
├─ order_id                  BIGINT FK → orders(id) NOT NULL
├─ user_id                   BIGINT FK → users(id) NOT NULL   -- 冗余
├─ shop_id                   BIGINT FK → shops(id) NOT NULL   -- 冗余
├─ type                      ENUM('refund_only','return_refund','exchange') NOT NULL
├─ status                    ENUM (见 §5，共 12 态) NOT NULL
├─ reason_category           ENUM('quality_issue','wrong_item','damage_in_transit','not_as_described',
                                  'no_longer_needed','duplicate_purchase','other') NOT NULL
├─ reason_note               TEXT NOT NULL                    -- 用户申请说明（10-500 字）
├─ refund_amount_cents       INTEGER NOT NULL                 -- 用户申请的退款金额（针对 REFUND_ONLY/RETURN_REFUND）
├─ actual_refund_cents       INTEGER NULLABLE                 -- 商家/仲裁最终确定金额（可能少于申请）
│
│   -- 商家审核
├─ merchant_reviewed_at      TIMESTAMPTZ NULLABLE
├─ merchant_review_note      TEXT NULLABLE                    -- 通过时可选，驳回时必填 ≥ 5 字
├─ merchant_review_deadline  TIMESTAMPTZ NOT NULL             -- 创建时 = now + 72h；到点未审核触发升级
│
│   -- 退货物流（RETURN_REFUND / EXCHANGE）
├─ return_address            TEXT NULLABLE                    -- 商家同意时后端填入
├─ return_carrier            VARCHAR(60) NULLABLE             -- 用户回填
├─ return_tracking_no        VARCHAR(60) NULLABLE
├─ return_shipped_at         TIMESTAMPTZ NULLABLE
├─ return_ship_deadline      TIMESTAMPTZ NULLABLE             -- 商家同意时设 = now + 7 day；到点未寄回 → 关闭
│
│   -- 商家收货
├─ merchant_received_at      TIMESTAMPTZ NULLABLE
├─ merchant_receive_deadline TIMESTAMPTZ NULLABLE             -- 用户填单号时设 = now + 15 day；到点未收货 → 自动认为已收货
├─ merchant_refuse_receive   BOOLEAN NOT NULL DEFAULT FALSE
├─ merchant_refuse_note      TEXT NULLABLE
│
│   -- 换货专用（EXCHANGE）
├─ exchange_carrier          VARCHAR(60) NULLABLE             -- 商家再发货时填
├─ exchange_tracking_no      VARCHAR(60) NULLABLE
├─ exchange_shipped_at       TIMESTAMPTZ NULLABLE
├─ exchange_confirm_deadline TIMESTAMPTZ NULLABLE             -- 商家再发货时 = now + 15 day
├─ exchange_confirmed_at     TIMESTAMPTZ NULLABLE
│
│   -- 平台仲裁
├─ escalated_at              TIMESTAMPTZ NULLABLE             -- 被升级到平台的时间
├─ escalation_reason         ENUM('merchant_timeout','user_appeal','risk_flagged','manual') NULLABLE
├─ arbitrator_admin_id       BIGINT FK → admin_users(id) NULLABLE
├─ arbitrated_at             TIMESTAMPTZ NULLABLE
├─ arbitration_conclusion    TEXT NULLABLE                    -- 客服仲裁结论
├─ arbitration_outcome       ENUM('side_with_user','side_with_merchant','partial_refund','other') NULLABLE
│
│   -- 退款执行
├─ refunded_at               TIMESTAMPTZ NULLABLE             -- 实际退款成功时间
├─ refund_txn_no             VARCHAR(64) NULLABLE             -- 模拟退款流水号
│
│   -- 结束
├─ closed_at                 TIMESTAMPTZ NULLABLE
├─ close_reason              ENUM('user_cancelled','completed','user_ship_timeout','arbitration_closed',
                                  'auto_confirmed','system_closed') NULLABLE
│
│   -- 催办 / 申诉冗余计数
├─ nudge_count               INTEGER NOT NULL DEFAULT 0       -- 用户已催办次数
├─ last_nudged_at            TIMESTAMPTZ NULLABLE
├─ appeal_count              INTEGER NOT NULL DEFAULT 0       -- 用户已申诉次数
│
├─ created_at, updated_at, deleted_at

INDEX (order_id, deleted_at)
INDEX (user_id, status, created_at DESC)
INDEX (shop_id, status, created_at DESC)
INDEX (status, merchant_review_deadline)   -- 超时扫描
INDEX (status, return_ship_deadline)
INDEX (status, merchant_receive_deadline)
INDEX (status, exchange_confirm_deadline)
INDEX (status, escalated_at)               -- 客服工作台
UNIQUE (order_id) WHERE deleted_at IS NULL AND status NOT IN ('closed','completed_refunded','completed_exchanged')
   -- 一个订单同时只有 1 个 active 售后单
```

### 4.2 售后明细 AftersalesItem（部分退款用）

```
aftersales_items
├─ id                     BIGINT PK
├─ aftersales_id          BIGINT FK → aftersales(id) ON DELETE CASCADE NOT NULL
├─ order_item_id          BIGINT FK → order_items(id) NOT NULL
├─ quantity               INTEGER NOT NULL                 -- 申请退的数量 (1..order_item.quantity)
├─ refund_amount_cents    INTEGER NOT NULL                 -- 该条明细的退款金额（= unit_price × quantity）
├─ created_at
UNIQUE (aftersales_id, order_item_id)
INDEX (aftersales_id)
```

### 4.3 售后状态历史 AftersalesStatusHistory

```
aftersales_status_history
├─ id                   BIGINT PK
├─ aftersales_id        BIGINT FK → aftersales(id) ON DELETE CASCADE NOT NULL
├─ from_status          VARCHAR(48) NULLABLE
├─ to_status            VARCHAR(48) NOT NULL
├─ actor_type           ENUM('user','merchant','admin','system') NOT NULL
├─ actor_id             BIGINT NULLABLE
├─ note                 TEXT NULLABLE
├─ created_at
INDEX (aftersales_id, created_at)
```

### 4.4 售后凭证 AftersalesEvidence

```
aftersales_evidences
├─ id                   BIGINT PK
├─ aftersales_id        BIGINT FK → aftersales(id) ON DELETE CASCADE NOT NULL
├─ uploader_type        ENUM('user','merchant','admin') NOT NULL
├─ uploader_id          BIGINT NOT NULL
├─ stage                ENUM('apply','merchant_review','user_return','merchant_receive',
                             'exchange_ship','appeal','arbitration') NOT NULL
├─ image_url            VARCHAR(255) NOT NULL              -- MinIO object_key
├─ note                 VARCHAR(200) NULLABLE
├─ created_at
INDEX (aftersales_id, stage)
```

单个售后单凭证上限 **8 张 / 每 stage**（应用层校验）。

### 4.5 售后消息 AftersalesMessage（Phase 4 简化，仅催办/申诉记录）

```
aftersales_messages
├─ id                   BIGINT PK
├─ aftersales_id        BIGINT FK → aftersales(id) ON DELETE CASCADE NOT NULL
├─ sender_type          ENUM('user','merchant','admin','system') NOT NULL
├─ sender_id            BIGINT NULLABLE
├─ kind                 ENUM('nudge','appeal','reply','system_notice') NOT NULL
├─ content              TEXT NOT NULL
├─ created_at
INDEX (aftersales_id, created_at)
```

---

## 5. 售后状态机（12 态）

```
                     ┌──────────────────────────┐
                     │ pending_merchant_review  │
                     └───────────┬──────────────┘
                                 │
       ┌─────────────┬───────────┼────────────┬──────────────┐
       │ user cancel │ merchant  │ merchant   │ merchant     │ system 72h
       ▼             │ approve   │ reject     │ approve      │ timeout
 ┌───────────┐       │           │ (+note)    │ (return)     │
 │user_      │       │(refund_   │            │              ▼
 │cancelled  │       │ only)     │            │      ┌──────────────────┐
 └───────────┘       │           │            │      │ admin_arbitrating│
                     ▼           ▼            ▼      └──────┬───────────┘
              ┌────────────┐ ┌────────────┐ ┌───────────────────┐
              │ refunding  │ │merchant_   │ │merchant_agreed_    │
              │            │ │rejected    │ │waiting_return      │
              └─────┬──────┘ └────┬───────┘ └───────┬────────────┘
                    │             │                 │
              (mock refund       user appeal        user 7day         user ship
               succeeded)         (single time)     timeout            (fill tracking)
                    ▼             ▼                 ▼                  ▼
             ┌──────────────┐ ┌───────────────┐ ┌────────────┐  ┌──────────────────┐
             │completed_    │ │admin_         │ │system_     │  │return_shipped_    │
             │refunded      │ │arbitrating    │ │closed      │  │waiting_receive    │
             └──────────────┘ └──────┬────────┘ └────────────┘  └────────┬─────────┘
                                    ▼                                    │
                              ...(见下)                                   │
                                                                        merchant
                                                       ┌──────────────┬──receive───────────────┐
                                                       │ refuse-receive                        │
                                                       ▼             ▼ confirm             ▼ 15day
                                                ┌───────────────┐  (return_refund)      (auto confirm)
                                                │admin_         │  → refunding          → refunding
                                                │arbitrating    │  (exchange)           (exchange 类同)
                                                └───────────────┘  → merchant_agreed_
                                                                   waiting_ship
                                                                          │
                                                                    merchant ship
                                                                          ▼
                                                                ┌────────────────────────┐
                                                                │exchange_shipped_       │
                                                                │waiting_receive         │
                                                                └───────────┬────────────┘
                                                                            │
                                                            ┌───────────────┼──────────────┐
                                                          user confirm   admin resolve   15d auto
                                                            ▼               ▼             ▼
                                                    ┌────────────────┐  (see arb)    (auto confirm)
                                                    │completed_      │
                                                    │exchanged       │
                                                    └────────────────┘

    admin_arbitrating 分支的最终态：
        - side_with_user →  admin_resolved_refunded  →  (触发退款)
        - side_with_merchant → admin_resolved_rejected
        - partial_refund → admin_resolved_partial  →  (触发部分退款)
```

**12 态清单**（对齐 `AftersalesStatus` enum）：

| 值 | 含义 |
|---|---|
| `pending_merchant_review` | 等待商家审核（初始态）|
| `merchant_rejected` | 商家拒绝（用户可申诉 1 次）|
| `merchant_agreed_waiting_return` | 商家同意退货，等用户寄回（RETURN_REFUND / EXCHANGE）|
| `return_shipped_waiting_receive` | 用户已寄回，等商家收货 |
| `merchant_agreed_waiting_ship` | 商家已收货（EXCHANGE 分支），准备再发货 |
| `exchange_shipped_waiting_receive` | 商家已再发货，等用户收货（EXCHANGE 尾声）|
| `refunding` | 触发退款执行中（几乎瞬时，模拟）|
| `admin_arbitrating` | 已升级至平台，等客服仲裁 |
| `completed_refunded` | 退款完成（最终态）|
| `completed_exchanged` | 换货完成（最终态）|
| `user_cancelled` | 用户撤销（最终态）|
| `system_closed` | 系统关闭（用户超时未寄回等，最终态）|

### 5.1 关键规则

- **同订单同时只能有 1 个 active 售后**：完成/关闭的可再申请
- **申诉次数**：`merchant_rejected` 状态下用户可申诉 1 次；进入 `admin_arbitrating` 后不能再申诉
- **仲裁不可撤销**：一旦 `admin_arbitrating`，用户 15009；商家也不能审核
- **退款执行**：`refunding` 状态由服务层内部触发；成功立刻转 `completed_refunded`，失败保持 `refunding` 供 admin 手动处理（Phase 4 模拟必成功）
- **催办**：仅在 `pending_merchant_review` 状态可催（次数无硬上限，但 24h 内最多 3 次）

---

## 6. Phase 4 新增 RBAC 权限

| 权限键 | 分配给 |
|---|---|
| `user:aftersales:create` | 任何 user |
| `user:aftersales:read_own` | 任何 user |
| `user:aftersales:cancel_own` | 任何 user |
| `user:aftersales:submit_tracking` | 任何 user |
| `user:aftersales:confirm_exchange` | 任何 user |
| `user:aftersales:nudge` | 任何 user |
| `user:aftersales:appeal` | 任何 user |
| `merchant:aftersales:read_shop` | SHOP_OWNER, SHOP_OPERATOR, SHOP_SUPPORT |
| `merchant:aftersales:review` | SHOP_OWNER, SHOP_OPERATOR |
| `merchant:aftersales:confirm_receive` | SHOP_OWNER, SHOP_OPERATOR |
| `merchant:aftersales:ship_exchange` | SHOP_OWNER, SHOP_OPERATOR |
| `merchant:aftersales:add_note` | SHOP_OWNER, SHOP_OPERATOR, SHOP_SUPPORT |
| `admin:aftersales:read_all` | SUPER, BUSINESS, CUSTOMER_SERVICE |
| `admin:aftersales:arbitrate` | SUPER, CUSTOMER_SERVICE |
| `admin:aftersales:force_refund` | SUPER, CUSTOMER_SERVICE |
| `admin:aftersales:add_note` | SUPER, CUSTOMER_SERVICE |

---

## 7. User · 申请与操作

### 7.1 发起售后

`POST /api/v1/user/orders/{order_id}/aftersales`
Headers: `Idempotency-Key`（防重复申请）

**请求**：
```json
{
  "type": "return_refund",
  "reason_category": "quality_issue",
  "reason_note": "商品有明显划痕，非物流损坏",
  "items": [
    { "order_item_id": 5001, "quantity": 2 }
  ],
  "refund_amount_cents": 39600,   // = order_item.unit_price × quantity；后端校验一致
  "evidence_image_keys": ["aftersales/2026/07/23/xxxx.jpg"]
}
```

**服务端校验**：
- 订单归属当前用户
- 订单状态允许此类型（见 §2 表）
- 订单当前无 active 售后
- items 属于该订单
- refund_amount ≤ 各 item 的 unit_price × quantity 之和
- reason_note 10-500 字
- evidence 图片数量 0-8 张

**响应**：201 + `AftersalesDetailOut`

### 7.2 我的售后单列表

`GET /api/v1/user/aftersales?status=&type=&keyword=&page&size`
- keyword 匹配 `aftersales_no` / order_no / 商品标题
- 默认按 `created_at DESC`

### 7.3 售后单详情

`GET /api/v1/user/aftersales/{id}` — 完整字段 + items + status_history + evidences + messages

### 7.4 用户撤销

`POST /api/v1/user/aftersales/{id}/cancel`
- 允许状态：`pending_merchant_review`, `merchant_agreed_waiting_return`（未寄回前），`merchant_rejected`（拒绝后不申诉直接撤销）
- 不允许：`return_shipped_waiting_receive` 及之后
- Body: `{ "cancel_note": "..." }` 可选

### 7.5 用户回填物流（寄回商品）

`POST /api/v1/user/aftersales/{id}/submit-tracking`
- 允许状态：`merchant_agreed_waiting_return`
- Body: `{ "carrier": "SF", "tracking_no": "SF1234567890" }`
- 回填后：状态 → `return_shipped_waiting_receive`；设 `merchant_receive_deadline = now + 15day`

### 7.6 用户确认换货完成

`POST /api/v1/user/aftersales/{id}/confirm-exchange`
- 允许状态：`exchange_shipped_waiting_receive`
- 状态 → `completed_exchanged`；`closed_at = now` / `close_reason = 'completed'`

### 7.7 催办

`POST /api/v1/user/aftersales/{id}/nudge`
- 允许状态：`pending_merchant_review`
- 频控：24h 内最多 3 次；否则返回 5003
- 写 aftersales_messages(kind='nudge')，`nudge_count += 1`

### 7.8 申诉（升级至平台）

`POST /api/v1/user/aftersales/{id}/appeal`
- 允许状态：`merchant_rejected`
- 只能申诉 1 次（`appeal_count = 0 → 1`）
- Body: `{ "reason": "...", "evidence_image_keys": [...] }` reason ≥ 20 字
- 状态 → `admin_arbitrating`；`escalation_reason='user_appeal'`；`escalated_at = now`

### 7.9 增加凭证

`POST /api/v1/user/aftersales/{id}/evidences`
- Body: `{ "stage": "apply|user_return|appeal", "image_key": "...", "note": "" }`
- 8 张 / stage 上限

---

## 8. Merchant · 审核与收货

### 8.1 列表 / 详情

- `GET /api/v1/merchant/aftersales?status=&type=&overdue_soon=&keyword=&page&size`
  - `overdue_soon=true` 过滤"审核 deadline < 24h"
  - 默认按 `merchant_review_deadline ASC`（临期最上）
- `GET /api/v1/merchant/aftersales/{id}` — 完整详情（含用户信息 + evidences + messages）

### 8.2 同意 / 拒绝

`POST /api/v1/merchant/aftersales/{id}/approve`
- 允许状态：`pending_merchant_review`
- Body:
  ```json
  {
    "actual_refund_cents": 39600,   // 可小于用户申请值
    "return_address": "浙江省杭州市西湖区XX路XX号",   // RETURN_REFUND/EXCHANGE 必填
    "review_note": "同意退款"
  }
  ```
- REFUND_ONLY → 状态 → `refunding`（触发退款）
- RETURN_REFUND/EXCHANGE → 状态 → `merchant_agreed_waiting_return`；`return_ship_deadline = now + 7day`

`POST /api/v1/merchant/aftersales/{id}/reject`
- 允许状态：`pending_merchant_review`
- Body: `{ "review_note": "..." }` review_note ≥ 5 字必填
- 状态 → `merchant_rejected`

### 8.3 确认收货 / 拒收（RETURN_REFUND / EXCHANGE 主流程）

`POST /api/v1/merchant/aftersales/{id}/confirm-received`
- 允许状态：`return_shipped_waiting_receive`
- Body: `{ "note": "...", "evidence_image_keys": [...] }` optional
- RETURN_REFUND → 状态 → `refunding`
- EXCHANGE → 状态 → `merchant_agreed_waiting_ship`（等商家再发货）
- `merchant_received_at = now`

`POST /api/v1/merchant/aftersales/{id}/refuse-receive`
- 允许状态：`return_shipped_waiting_receive`
- Body: `{ "refuse_note": "...", "evidence_image_keys": [...] }` refuse_note ≥ 10 字
- 状态 → `admin_arbitrating`；`escalation_reason='merchant_refuse_receive'`（新增 escalation_reason 值）

> **注**：`escalation_reason` 值实际共 5 种：`merchant_timeout` / `user_appeal` / `risk_flagged` / `manual` / `merchant_refuse_receive`。契约 §4.1 已列 4 种，补充第 5 种。

### 8.4 换货再发货（EXCHANGE 尾声）

`POST /api/v1/merchant/aftersales/{id}/ship-exchange`
- 允许状态：`merchant_agreed_waiting_ship`
- Body: `{ "carrier": "SF", "tracking_no": "SF9876543210" }`
- 状态 → `exchange_shipped_waiting_receive`；`exchange_confirm_deadline = now + 15day`

### 8.5 备注

`POST /api/v1/merchant/aftersales/{id}/note`
- Body: `{ "note": "..." }` 覆盖写 `merchant_review_note`
- 任意状态可写（不改状态）

---

## 9. Admin · 仲裁与强制处理

### 9.1 列表 / 详情

- `GET /api/v1/admin/aftersales?status=&type=&shop_id=&user_id=&escalation_reason=&keyword=&page&size`
  - 默认按 `escalated_at DESC NULLS LAST`（仲裁台优先看已升级）
- `GET /api/v1/admin/aftersales/{id}` — 完整信息（含 admin_note、所有 messages）

### 9.2 认领仲裁

`POST /api/v1/admin/aftersales/{id}/take-over`
- 允许状态：`admin_arbitrating`（arbitrator_admin_id 为空时）
- 效果：`arbitrator_admin_id = 当前 admin.id`；不改状态
- 若已被别的 admin 认领 → 返回错误（但不阻塞，只是提示）

### 9.3 仲裁裁决

`POST /api/v1/admin/aftersales/{id}/resolve`
- 允许状态：`admin_arbitrating`（且当前 admin 已认领）
- Body:
  ```json
  {
    "outcome": "side_with_user" | "side_with_merchant" | "partial_refund",
    "conclusion": "客服仲裁结论（≥ 20 字）",
    "actual_refund_cents": 39600,   // outcome != side_with_merchant 时必填
    "evidence_image_keys": []
  }
  ```
- `side_with_user` → 状态 → `refunding`（触发全额退款）
- `partial_refund` → 状态 → `refunding`（触发部分退款）
- `side_with_merchant` → 状态 → `system_closed` / `close_reason='arbitration_closed'`

### 9.4 强制退款（超越商家意见）

`POST /api/v1/admin/aftersales/{id}/force-refund`
- 允许状态：非最终态皆可
- Body: `{ "amount_cents": 39600, "note": "..." }`
- 状态 → `refunding`；写 audit + 明确标记"admin 强制"

### 9.5 内部备注 / 消息

`POST /api/v1/admin/aftersales/{id}/note`
- Body: `{ "note": "..." }` — 内部备注（对用户/商家隐藏）
- 通过 aftersales_messages(kind='reply', sender_type='admin') 写入

### 9.6 大盘统计

`GET /api/v1/admin/aftersales/stats/overview`
```json
{
  "pending_review_count": 12,
  "escalated_pending_count": 8,       // admin_arbitrating 且 arbitrator 为空
  "in_progress_count": 25,             // 所有非终态
  "resolved_today_count": 3,
  "avg_resolution_hours": 18.5
}
```

---

## 10. 凭证系统（图片上传复用 Phase 2）

- 前端调 Phase 2 的 `POST /api/v1/merchant/uploads/presign`（用户端需要**新增一个 user 版**：`POST /api/v1/user/uploads/presign`，权限 `user:aftersales:create`）
- purpose 枚举扩展：`aftersales_apply` / `aftersales_user_return` / `aftersales_merchant_receive` / `aftersales_exchange_ship` / `aftersales_appeal` / `aftersales_arbitration`
- 前端 PUT 直传 MinIO → 拿到 object_key → 写进业务请求
- 后端 `aftersales_evidences` 表存 object_key；渲染时前端拼 `NEXT_PUBLIC_IMAGE_CDN`

### 10.1 用户上传接口（Phase 2 补充）

`POST /api/v1/user/uploads/presign` (**Phase 4 新增**)

Body 与 Phase 2 merchant 版一致。权限：任何登录用户。

---

## 11. 超时升级与自动流转

Phase 3 已有 `app/scripts/process_timeouts.py`。Phase 4 **扩展**它，加入售后维度：

1. **商家 72h 未审核** → 状态 `pending_merchant_review` 且 `merchant_review_deadline < now`
   - 事务：状态 → `admin_arbitrating`；`escalation_reason='merchant_timeout'`；`escalated_at=now`
   - 写系统消息 aftersales_messages(kind='system_notice', sender_type='system')

2. **用户 7 天未寄回** → 状态 `merchant_agreed_waiting_return` 且 `return_ship_deadline < now`
   - 状态 → `system_closed`；`close_reason='user_ship_timeout'`

3. **商家收货 15 天未确认（用户已寄回）** → 状态 `return_shipped_waiting_receive` 且 `merchant_receive_deadline < now`
   - 视为默认收货
   - RETURN_REFUND → 状态 → `refunding`
   - EXCHANGE → 状态 → `merchant_agreed_waiting_ship`

4. **换货用户 15 天未确认收货** → 状态 `exchange_shipped_waiting_receive` 且 `exchange_confirm_deadline < now`
   - 状态 → `completed_exchanged`；`close_reason='auto_confirmed'`

脚本运行方式沿用 Phase 3：`uv run python -m app.scripts.process_timeouts`；admin 端有 `POST /api/v1/admin/tasks/process-timeouts` 手动触发。

**幂等**：每类扫描都用 `WHERE status = X AND deadline < now`，转态后 WHERE 条件不满足重跑不误伤。

---

## 12. 退款执行（模拟）

Phase 4 无真实支付网关，**模拟退款必然成功**：

- 触发点：状态转到 `refunding` 时
- 效果（同事务）：
  1. 从 order.paid_at 找到对应订单
  2. 找到 order 的 succeeded PaymentSession（Phase 3 表）
  3. 写一个"模拟退款"字段：
     - `aftersales.refund_txn_no = "REFUND-{hex}"`
     - `aftersales.refunded_at = now`
  4. 状态 → `completed_refunded`
  5. 写 audit_log(action='system.aftersales.refund_succeeded')
- **订单侧联动**（见 §13）

模拟层不实际写 payment_sessions 状态（保持 Phase 3 的 `succeeded`），只在 aftersales 记录退款流水号。这样订单历史保留原支付记录，退款单独看 aftersales 表。

**真实实现路径预留**：在 refund_service 里留一个 `simulate=True` 参数；Phase 后期接真实支付网关时改为 False，走网关退款 API。

---

## 13. 订单侧联动

售后完成后订单状态怎么办？

| Aftersales 最终态 | Order 状态变化 |
|---|---|
| `completed_refunded`（全额退款）| Order → `closed`（Phase 3 已保留字段），写 order_status_history |
| `completed_refunded`（部分退款）| Order 状态**不变**（保持 completed），只在 order 上加冗余标记 `has_partial_refund=TRUE`（Phase 4 追加字段）|
| `completed_exchanged` | Order 状态**不变**（保持 completed）|
| `user_cancelled` / `system_closed` / `merchant_rejected`（未申诉）| Order 状态**不变** |

**Order 表追加字段**（Phase 4 alembic 0004 里对 Phase 3 的 orders 表 alter）：
```
orders.has_partial_refund   BOOLEAN NOT NULL DEFAULT FALSE
orders.total_refunded_cents INTEGER NOT NULL DEFAULT 0
```

---

## 14. 风控占位

Phase 4 不做真实风控，但预留：

- 短期高频退款检测（同用户 30 天内 >= 3 单退款）：申请时若命中，插入 aftersales 时 `escalation_reason='risk_flagged'` + 自动 `escalated_at=now` + 直接状态 → `admin_arbitrating`（跳过商家审核）
- 该规则通过服务层 `risk_service.assess_aftersales_request(user)` 返回布尔值决定
- 阈值走 config：`AFTERSALES_RISK_WINDOW_DAYS` (=30) / `AFTERSALES_RISK_THRESHOLD` (=3)

---

## 15. 种子数据

追加到 `app/scripts/seed.py`：

- 给 Phase 3 已 completed 的示例订单加 1 条 `completed_refunded` 售后单（模拟历史）
- 给 shop1 的 1 张 shipped 订单加 1 条 `pending_merchant_review` 售后单（供 merchant 联调）
- 给 admin 工作台留 1 条 `admin_arbitrating` 状态的售后单（供 admin 联调）
- 每条售后都有 1-2 张凭证（用占位 key，如 `aftersales/seed/example-1.jpg`）

---

## 附录 A：本 Phase 明确不做

- 真实支付网关退款（模拟即可）
- 换货商品变价（换货新 SKU 与原 SKU 价格不同 → Phase 后期）
- 售后消息实时聊天（Phase 4 只有催办/申诉/系统通知）
- 真实风控（只有基础频次检测占位）
- 售后单撤销后重开（当前 `user_cancelled` 是最终态；用户可就同一订单再发起新售后单）
- 售后通知短信/邮件（用 logger 打印）
- 售后单导出 / 报表（后期做）

## 附录 B：Phase 5 会依赖的字段

- `aftersales.actual_refund_cents` / `aftersales.refund_txn_no` → Phase 5 商品评价里"用户已退款"标签
- `orders.has_partial_refund` / `orders.total_refunded_cents` → 我的订单页显示"含退款"角标
