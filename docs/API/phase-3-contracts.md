# Phase 3 API 契约 · 交易核心（地址簿 / 购物车 / 下单 / 订单状态机 / 支付模拟 / 物流模拟 / 超时任务）

> **契约优先**。Backend 按此实现，Frontend 按此对接。歧义先改契约再改代码。
>
> 版本：v1.0 · 生效范围：Phase 3 · 依赖 Phase 1（认证/RBAC/JWT）+ Phase 2（SPU/SKU/库存）

---

## 目录
1. [沿用与新增约定](#1-沿用与新增约定)
2. [Phase 3 新增错误码](#2-phase-3-新增错误码)
3. [数据模型](#3-数据模型)
4. [订单状态机](#4-订单状态机)
5. [Phase 3 新增 RBAC 权限](#5-phase-3-新增-rbac-权限)
6. [User · 地址簿](#6-user--地址簿)
7. [User · 购物车](#7-user--购物车)
8. [User · 下单与订单管理](#8-user--下单与订单管理)
9. [User · 支付模拟](#9-user--支付模拟)
10. [Merchant · 订单处理](#10-merchant--订单处理)
11. [Admin · 订单大盘与干预](#11-admin--订单大盘与干预)
12. [超时任务扫描](#12-超时任务扫描)
13. [库存锁定与释放规则](#13-库存锁定与释放规则)
14. [幂等性（Idempotency-Key）](#14-幂等性idempotency-key)
15. [种子数据](#15-种子数据)

---

## 1. 沿用与新增约定

- 沿用 Phase 1 的统一响应结构、JWT `aud` 分域、RBAC 依赖注入
- 沿用 Phase 2 的分页格式、金额存分（`_cents` 后缀）、软删
- **本 Phase 引入 `Idempotency-Key` 请求头**（见 §14），用于 `POST /user/orders` 与 `POST /user/orders/{id}/pay` 等风险端点
- **订单 ID 长度**：`BIGINT` 但用户看到的是 18 位字符串（`202607230000001234`）— 格式 `YYYYMMDD` + 10 位序号。数据库 PK 独立自增；前端展示与 URL 用字符串 order_no
- **物流模拟**：Phase 3 不接真实物流；商家发货时手填快递公司 + 快递单号，系统"假装"轨迹（simulate 3 个节点：已揽收/运输中/已签收）；用户端展示这些节点

---

## 2. Phase 3 新增错误码

| 段 | 用途 |
|---|---|
| **11xxx** | 地址（`11001` 地址不存在 / `11002` 无权访问此地址） |
| **12xxx** | 购物车（`12001` cart item 不存在 / `12002` SKU 已失效不可加购 / `12003` 数量超库存 / `12004` 数量超单次上限 999） |
| **13xxx** | 订单（`13001` 订单不存在 / `13002` 无权访问此订单 / `13003` 订单状态不允许此操作 / `13004` 库存不足下单失败 / `13005` 购物车为空 / `13006` 未选中任何 SKU / `13007` 收货地址无效 / `13008` 订单已过支付截止时间 / `13009` idempotency key 冲突 / `13010` 快递单号格式无效 / `13011` 已取消订单不可再操作） |
| **14xxx** | 支付（`14001` 支付 session 不存在 / `14002` 支付已完成/已失败不可重试 / `14003` 支付渠道不支持 / `14004` 模拟支付失败） |

---

## 3. 数据模型

### 3.1 地址簿 Address

```
addresses
├─ id                BIGINT PK
├─ user_id           BIGINT FK → users(id) NOT NULL
├─ receiver_name     VARCHAR(60)  NOT NULL
├─ receiver_phone    VARCHAR(20)  NOT NULL
├─ province          VARCHAR(40)  NOT NULL      -- 省
├─ city              VARCHAR(40)  NOT NULL      -- 市
├─ district          VARCHAR(40)  NOT NULL      -- 区/县
├─ detail            VARCHAR(200) NOT NULL      -- 详细地址
├─ postal_code       VARCHAR(10)  NULLABLE
├─ is_default        BOOLEAN NOT NULL DEFAULT FALSE
├─ created_at, updated_at, deleted_at
INDEX (user_id, deleted_at)
PARTIAL UNIQUE (user_id) WHERE is_default = TRUE AND deleted_at IS NULL
```

**约束**：每用户至多 1 个默认地址；地址总数上限 20 条（应用层校验）；地区数据不做级联，前端直接文本填（Phase 5 优化）

### 3.2 购物车 CartItem

购物车用**单表存储**（不建 Cart 主表），一条 = 一个用户的一件 SKU：

```
cart_items
├─ id                BIGINT PK
├─ user_id           BIGINT FK → users(id) NOT NULL
├─ sku_id            BIGINT FK → skus(id) NOT NULL
├─ quantity          INTEGER NOT NULL           -- 1..999
├─ selected          BOOLEAN NOT NULL DEFAULT TRUE   -- 结算时是否选中
├─ created_at, updated_at
UNIQUE (user_id, sku_id)      -- 加购同一 SKU 只增数量
INDEX (user_id)
```

**"失效商品"判定**（读时计算）：
- SKU 或 SPU 被软删
- SPU.status ≠ approved（下架、审核中、驳回）
- SKU.is_active = FALSE
- SKU.stock < 1（库存已空）

失效商品仍在购物车（不主动删除，让用户看到并决定），但：
- 前端展示灰化 + "已失效" 标签
- 后端在响应里带 `status: valid | invalid` 与 `invalid_reason` 字段
- 结算时**自动跳过失效商品**（且报警提示 "有 N 件商品已失效")

### 3.3 订单 Order

```
orders
├─ id                BIGINT PK
├─ order_no          VARCHAR(32) UNIQUE NOT NULL    -- "202607230000001234" 展示用
├─ user_id           BIGINT FK → users(id) NOT NULL
├─ shop_id           BIGINT FK → shops(id) NOT NULL   -- 每个订单归属一家店铺
├─ status            ENUM('pending_payment','paid','shipped','completed','cancelled','closed') NOT NULL
├─ subtotal_cents    INTEGER NOT NULL               -- 商品总价（不含运费）
├─ shipping_fee_cents INTEGER NOT NULL DEFAULT 0    -- Phase 3 固定 0 或按契约 §8 计算规则
├─ total_cents       INTEGER NOT NULL               -- subtotal + shipping - discount
├─ discount_cents    INTEGER NOT NULL DEFAULT 0     -- Phase 3 恒为 0
├─ receiver_name     VARCHAR(60) NOT NULL           -- 快照，防用户改地址后订单看不到
├─ receiver_phone    VARCHAR(20) NOT NULL
├─ receiver_address  VARCHAR(400) NOT NULL          -- "province+city+district+detail" 拼接快照
├─ user_note         TEXT NULLABLE                  -- 用户下单备注（收货说明）
├─ merchant_note     TEXT NULLABLE                  -- 商家给用户的备注（如"感谢下单"）
├─ admin_note        TEXT NULLABLE                  -- 管理员干预备注（对用户不可见）
├─ payment_deadline_at TIMESTAMPTZ NOT NULL         -- 下单时 = now + 30min；超时自动 cancel
├─ paid_at           TIMESTAMPTZ NULLABLE
├─ shipped_at        TIMESTAMPTZ NULLABLE
├─ auto_complete_at  TIMESTAMPTZ NULLABLE           -- 发货时设 = now + 15day；超时自动 complete
├─ completed_at      TIMESTAMPTZ NULLABLE
├─ cancelled_at      TIMESTAMPTZ NULLABLE
├─ cancel_reason     ENUM('user_cancel','payment_timeout','merchant_cancel','admin_intervene','out_of_stock') NULLABLE
├─ cancel_note       TEXT NULLABLE
├─ shipping_carrier  VARCHAR(60) NULLABLE           -- "SF"/"YTO"/etc
├─ tracking_no       VARCHAR(60) NULLABLE
├─ idempotency_key   VARCHAR(120) NULLABLE          -- 客户端幂等；UNIQUE(user_id, idempotency_key)
├─ created_at, updated_at

INDEX (user_id, created_at DESC)     -- 我的订单
INDEX (shop_id, status, created_at DESC)   -- 商家订单
INDEX (status, payment_deadline_at)  -- 超时扫描
INDEX (status, auto_complete_at)     -- 自动确认扫描
UNIQUE (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL
```

### 3.4 订单商品 OrderItem

```
order_items
├─ id                BIGINT PK
├─ order_id          BIGINT FK → orders(id) NOT NULL   -- ON DELETE CASCADE
├─ sku_id            BIGINT FK → skus(id) NOT NULL     -- 保留引用（不 CASCADE，SKU 软删仍能追溯）
├─ spu_id            BIGINT FK → spus(id) NOT NULL
├─ shop_id           BIGINT FK → shops(id) NOT NULL    -- 冗余，方便统计
├─ spu_title         VARCHAR(200) NOT NULL             -- 快照
├─ sku_specs         JSONB NOT NULL                    -- 快照
├─ sku_image         VARCHAR(255) NULLABLE             -- 快照（sku.image or spu.main_image）
├─ unit_price_cents  INTEGER NOT NULL                  -- 下单时的价格快照
├─ quantity          INTEGER NOT NULL
├─ subtotal_cents    INTEGER NOT NULL                  -- unit_price × quantity
├─ created_at
INDEX (order_id)
INDEX (sku_id)
INDEX (spu_id)
```

**为什么大量快照**：真实电商里 SKU 价格 / 商品名 / 图 会变；订单必须保留下单当时的状态供追溯与售后。

### 3.5 订单状态历史 OrderStatusHistory

```
order_status_history
├─ id                BIGINT PK
├─ order_id          BIGINT FK → orders(id) ON DELETE CASCADE NOT NULL
├─ from_status       VARCHAR(24) NULLABLE       -- 首条为 NULL
├─ to_status         VARCHAR(24) NOT NULL
├─ actor_type        ENUM('user','merchant','admin','system') NOT NULL
├─ actor_id          BIGINT NULLABLE            -- system 时 NULL
├─ note              TEXT NULLABLE
├─ created_at
INDEX (order_id, created_at)
```

用户/商家/管理员的订单详情页都展示"订单时间轴"，从此表读。

### 3.6 支付会话 PaymentSession（模拟）

```
payment_sessions
├─ id                BIGINT PK
├─ order_id          BIGINT FK → orders(id) NOT NULL
├─ channel           ENUM('mock_alipay','mock_wechat','mock_bank') NOT NULL
├─ amount_cents      INTEGER NOT NULL
├─ status            ENUM('pending','succeeded','failed','expired') NOT NULL DEFAULT 'pending'
├─ external_txn_no   VARCHAR(64) NULLABLE       -- 模拟外部单号
├─ failure_reason    VARCHAR(200) NULLABLE
├─ created_at, updated_at, completed_at
UNIQUE (order_id, status) WHERE status = 'pending'   -- 一个订单同时只有 1 个 pending 支付
INDEX (order_id)
```

**说明**：每次用户"发起支付"生成一条 pending session；成功 or 失败后 status 更新；订单 pay endpoint 用 session 关联。

### 3.7 物流轨迹 ShipmentEvent（模拟）

```
shipment_events
├─ id                BIGINT PK
├─ order_id          BIGINT FK → orders(id) NOT NULL
├─ event_type        ENUM('picked_up','in_transit','arrived_city','out_for_delivery','delivered') NOT NULL
├─ description       VARCHAR(200) NOT NULL
├─ event_time        TIMESTAMPTZ NOT NULL
├─ created_at
INDEX (order_id, event_time)
```

**Phase 3 简化**：商家发货时后端一次性生成 3 条事件（picked_up now / in_transit now+1h / delivered now+2h）用于用户看到"仿真"物流。真实电商这些由物流公司回调写入。

---

## 4. 订单状态机

```
                   [用户下单]
                        │
                (创建订单 + 锁库存 + 30min 支付 deadline)
                        ▼
              ┌──────────────────┐
              │ pending_payment  │──(30min 到 or 用户主动取消)──> ┌──────────┐
              └──────────────────┘                                 │cancelled │
                        │                                          └──────────┘
                (用户点击"立即支付" + mock 成功)                          ▲
                        ▼                                                │
              ┌──────────────────┐                                       │
              │      paid        │──(商家主动取消 or admin 干预)─────────┘
              └──────────────────┘
                        │
                (商家点"发货" + 填快递单号，
                 系统生成 shipment_events 与 auto_complete_at = now+15day)
                        ▼
              ┌──────────────────┐
              │     shipped      │──(15day 到 or 用户"确认收货")──> ┌──────────┐
              └──────────────────┘                                    │completed │
                                                                      └──────────┘
                                                                            │
                                                              (Phase 4: 申请售后)
```

**辅助状态 `closed`**：Phase 3 保留字段但不使用（Phase 4 售后完成后订单状态转 closed）。

### 4.1 各角色允许的状态变更

| 触发者 | 从状态 | 到状态 | 端点 |
|---|---|---|---|
| **User** 主动取消 | pending_payment | cancelled | POST /user/orders/{id}/cancel |
| **User** 主动确认收货 | shipped | completed | POST /user/orders/{id}/confirm-receipt |
| **User** 发起支付 | pending_payment | (paid 通过 pay endpoint) | POST /user/orders/{id}/pay |
| **System 超时** | pending_payment | cancelled | 扫描脚本 |
| **System 超时** | shipped | completed | 扫描脚本 |
| **Merchant** 发货 | paid | shipped | POST /merchant/orders/{id}/ship |
| **Merchant** 取消（缺货） | paid | cancelled | POST /merchant/orders/{id}/cancel |
| **Admin** 干预取消 | pending_payment / paid | cancelled | POST /admin/orders/{id}/cancel |
| **Admin** 手动推进物流 | shipped | shipped（增加 shipment event） | POST /admin/orders/{id}/logistics/simulate |

**非法状态变更** → 13003

### 4.2 库存对状态的联动

- 下单成功（pending_payment）：`sku.stock -= qty`，`sku.locked_stock += qty`（"锁库存"）；写 inventory_log（reason=`sale`, related_order_id=order.id, delta=-qty）
- 取消订单（不论谁触发）：`sku.stock += qty`，`sku.locked_stock -= qty`；写 inventory_log（reason=`refund_return`, delta=+qty；系统触发 operator_type=`system`）
- 订单完成（shipped → completed）：`sku.sold_count += qty` + `spu.sales_count += qty`；`locked_stock -= qty`（此时不还库存，销售完成）

---

## 5. Phase 3 新增 RBAC 权限

| 权限键 | 分配给 |
|---|---|
| `user:address:manage` | 任何 user |
| `user:cart:manage` | 任何 user |
| `user:order:create` | 任何 user |
| `user:order:read_own` | 任何 user |
| `user:order:cancel_own` | 任何 user |
| `user:order:confirm_receipt` | 任何 user |
| `merchant:order:read_shop` | SHOP_OWNER, SHOP_OPERATOR, SHOP_SUPPORT |
| `merchant:order:ship` | SHOP_OWNER, SHOP_OPERATOR |
| `merchant:order:cancel_shop` | SHOP_OWNER |
| `merchant:order:add_note` | SHOP_OWNER, SHOP_OPERATOR, SHOP_SUPPORT |
| `admin:order:read_all` | SUPER_ADMIN, BUSINESS_ADMIN, CUSTOMER_SERVICE_ADMIN |
| `admin:order:intervene` | SUPER_ADMIN, CUSTOMER_SERVICE_ADMIN | -- 强制取消、修改物流等
| `admin:order:add_note` | SUPER_ADMIN, CUSTOMER_SERVICE_ADMIN |

---

## 6. User · 地址簿

- `GET /api/v1/user/addresses` — 列出当前用户所有地址（不分页；上限 20 条），default 排最前
- `GET /api/v1/user/addresses/{id}` — 详情
- `POST /api/v1/user/addresses` — 创建
  ```json
  {
    "receiver_name": "张三", "receiver_phone": "13800001234",
    "province": "浙江省", "city": "杭州市", "district": "西湖区",
    "detail": "文三路 100 号 A 楼 3 层",
    "postal_code": "310012", "is_default": true
  }
  ```
  - is_default=true 时自动清掉其他记录的 default
  - 超过 20 条 → 5001
- `PATCH /api/v1/user/addresses/{id}` — 编辑
- `DELETE /api/v1/user/addresses/{id}` — 软删；若是 default，删除后不自动指定新 default
- `POST /api/v1/user/addresses/{id}/set-default` — 单独设默认

权限：`user:address:manage`

---

## 7. User · 购物车

### 7.1 加购 / 更新数量

- `POST /api/v1/user/cart/items`
  ```json
  { "sku_id": 5001, "quantity": 2 }
  ```
  - 若已存在同 sku 记录：quantity 相加（且校验 ≤ 999）
  - 校验：SKU 存在 + SPU 已 approved + SKU is_active + 库存 ≥ 累加后 quantity
  - 若 SKU 状态异常返回 12002（前端提示"商品已下架"）
- `PATCH /api/v1/user/cart/items/{id}`
  ```json
  { "quantity": 5, "selected": true }
  ```
  - 至少一个字段
- `DELETE /api/v1/user/cart/items/{id}` — 移除
- `POST /api/v1/user/cart/items/batch-delete` — `{ "ids": [1,2,3] }`
- `POST /api/v1/user/cart/select-all` — `{ "selected": true }` 全选/全不选
- `DELETE /api/v1/user/cart/invalid` — 一键清除失效商品

### 7.2 查询购物车

`GET /api/v1/user/cart`

响应按**店铺分组**：

```json
{
  "code": 0, "message": "ok",
  "data": {
    "groups": [
      {
        "shop": { "id": 12, "name": "小李杂货铺" },
        "items": [
          {
            "id": 111,
            "sku_id": 5001,
            "quantity": 2,
            "selected": true,
            "status": "valid",
            "invalid_reason": null,
            "sku": {
              "id": 5001,
              "spu_id": 1001,
              "sku_code": "RED-L",
              "specs": {"color":"红","size":"L"},
              "price_cents": 9900,
              "original_price_cents": 12900,
              "stock": 12,
              "image": "spu/xxx.jpg",
              "is_active": true
            },
            "spu": {
              "id": 1001,
              "title": "iPhone 20 Pro",
              "main_image": "spu/xxx.jpg",
              "status": "approved"
            }
          }
        ],
        "subtotal_cents_selected": 19800    // 该店铺选中项小计
      }
    ],
    "total_cents_selected": 19800,   // 全部店铺选中项总计
    "total_selected_count": 2,       // 选中 SKU 件数（按 quantity）
    "invalid_count": 3               // 失效商品数
  }
}
```

权限：`user:cart:manage`

---

## 8. User · 下单与订单管理

### 8.1 结算预览（下单前）

`POST /api/v1/user/orders/preview`

**请求**：
```json
{
  "cart_item_ids": [111, 112, 115],   // 选中的购物车项（可能跨店铺）
  "address_id": 88
}
```

**行为**：
- 校验 cart_item 均属当前用户
- 校验 每个 item 的 SKU 仍 valid 且 库存足够
- 按 shop_id 分组
- 计算每店 subtotal / shipping_fee（Phase 3 恒为 0）/ total
- **不生成订单，只返回预览数据**

**响应**：
```json
{
  "data": {
    "address": { ... UserAddress ... },
    "groups_by_shop": [
      {
        "shop": {...},
        "items": [ ...同 cart items 结构 ],
        "subtotal_cents": 19800,
        "shipping_fee_cents": 0,
        "total_cents": 19800
      }
    ],
    "grand_total_cents": 19800,
    "warnings": [
      { "type": "invalid_sku", "message": "商品「XXX」已失效，已自动跳过", "cart_item_id": 115 },
      { "type": "stock_short", "message": "商品「YYY」库存不足", "cart_item_id": 112 }
    ]
  }
}
```

如有 warning 中 `stock_short` 或 `invalid_sku`，前端弹窗提示并阻止提交。

### 8.2 创建订单

`POST /api/v1/user/orders`

**Headers**：`Idempotency-Key: <uuid>` 必须

**请求**：（与 preview 相同 payload + 可选 user_note）
```json
{
  "cart_item_ids": [111, 112],
  "address_id": 88,
  "user_note": "请工作日送达"
}
```

**服务端事务**：
1. 校验 idempotency_key 未被同一 user 用过（否则返回之前的订单结果 → 13009）
2. 校验 cart items + address（同 preview）
3. 按 shop_id 分组，**每组创建一个 order**（订单表 + order_items 表）
4. 生成 order_no（`YYYYMMDD` + 10 位序号）
5. 快照商品字段（unit_price、spu_title、sku_specs、image）
6. **同事务扣减库存 + 锁库存 + 写 inventory_log**
7. 写 order_status_history（None → pending_payment，actor=user）
8. **删除对应的 cart_items**（下单后从购物车移除）
9. 写 audit_log

**响应**：
```json
{
  "data": {
    "orders": [
      { "id": 1001, "order_no": "202607230000001234", "total_cents": 19800, "shop": {...}, "payment_deadline_at": "..." }
    ]
  }
}
```

**错误**：
- 13004：任何一个 SKU 库存不足（整批回滚）
- 13005：cart_item_ids 空
- 13006：没有任何有效项（全部失效）
- 13007：address 不属于当前用户
- 13009：idempotency 冲突

### 8.3 我的订单

- `GET /api/v1/user/orders?status=&keyword=&page&size` — 分页列表
  - status 可以传单值或多值（`status=pending_payment,paid`）
  - keyword：匹配 order_no 或 商品 title
  - 默认排序 created_at DESC
  - **列表接口 lazy check**：查询时若发现 pending_payment 且 payment_deadline_at 已过，就把它标记为 cancelled（在返回前处理）
- `GET /api/v1/user/orders/{id}` — 详情：完整字段 + items + status_history + shipment_events + payment_sessions
  - 只能查自己的（13002）

### 8.4 用户操作

- `POST /api/v1/user/orders/{id}/cancel`
  - 允许状态：`pending_payment`
  - 请求：`{ "cancel_note": "不想买了" }` (可选)
  - 事务：更新 status + 释放库存 + 写 history + 释放锁的 idempotency
- `POST /api/v1/user/orders/{id}/confirm-receipt`
  - 允许状态：`shipped`
  - 事务：status → completed；SKU.sold_count / SPU.sales_count 更新
- `GET /api/v1/user/orders/{id}/shipment` — 查看物流轨迹（返回 shipment_events 列表 + carrier/tracking_no）

---

## 9. User · 支付模拟

### 9.1 创建支付会话

`POST /api/v1/user/orders/{id}/pay`

**Headers**：`Idempotency-Key`（避免重复扣款）

**请求**：
```json
{ "channel": "mock_alipay" }
```

**行为**：
- 校验 order 属于用户 + status=pending_payment + 未过 deadline（否则 13008）
- 若已有 pending session，返回该 session（幂等）
- 否则新建 payment_session
- **Phase 3 模拟策略**：不立刻标记 succeeded，而是返回一个 `session_id` + `mock_pay_url`；前端展示 "模拟支付页" 让用户点"支付成功"/"支付失败"

**响应**：
```json
{
  "data": {
    "session_id": 88001,
    "channel": "mock_alipay",
    "amount_cents": 19800,
    "mock_pay_url": "/mock-payment/88001",   // 前端路由到模拟支付页
    "expires_at": "..."
  }
}
```

### 9.2 用户操作模拟支付

`POST /api/v1/user/payment-sessions/{session_id}/mock-succeed`
`POST /api/v1/user/payment-sessions/{session_id}/mock-fail`

**succeed 行为**：
- 校验 session 属于当前用户 + status=pending + 订单未过 deadline
- 事务：session.status=succeeded / order.status=paid / order.paid_at=now
- 写 order_status_history、audit_log
- 返回订单最新状态

**fail 行为**：
- session.status=failed / failure_reason="模拟支付失败：用户点击了失败按钮"
- 订单状态**不变**（还是 pending_payment，用户可重试）

### 9.3 查询支付状态

`GET /api/v1/user/payment-sessions/{session_id}` — 供前端 mock 支付页轮询/hydrate 用

权限：`user:order:*`（各按端点）

---

## 10. Merchant · 订单处理

### 10.1 订单列表

`GET /api/v1/merchant/orders?status=&keyword=&start_date=&end_date=&page&size`
- status 支持多值（`status=paid,shipped`）
- keyword：匹配 order_no / receiver_name / receiver_phone
- 默认 status=paid（待发货）
- 只返回属于当前商家 shop_id 的订单
- **lazy check**：不动 pending_payment 超时（那是用户视角）

### 10.2 订单详情

`GET /api/v1/merchant/orders/{id}` — 同 user 端字段，但过滤：
- 不显示 payment_session 的 external_txn_no
- 显示 admin_note = FALSE（隐藏 admin 干预备注）
- items / status_history / shipment_events 都返回

### 10.3 商家操作

- `POST /api/v1/merchant/orders/{id}/ship`
  ```json
  {
    "carrier": "SF" | "YTO" | ..., 
    "tracking_no": "SF1234567890"
  }
  ```
  - 允许状态：`paid`
  - carrier 与 tracking_no 都必填；tracking_no 长度 6-30 字符 + 校验[A-Za-z0-9]（否则 13010）
  - 事务：order.status=shipped / shipping_carrier / tracking_no / shipped_at / auto_complete_at = now+15day
  - **同事务生成 3 条 shipment_events**（picked_up now / in_transit now+1h / delivered now+2h — 模拟物流）
  - 写 history + audit
  
- `POST /api/v1/merchant/orders/{id}/cancel`
  - 允许状态：`paid` （已支付但发不出货，如缺货）
  - `{ "cancel_note": "抱歉库存不足，稍后会退款" }` 必填
  - cancel_reason = "merchant_cancel"
  - 事务：status=cancelled / 释放锁库存 / 写 history
  - **注意**：paid → cancelled 意味着钱没退给用户；Phase 3 视为"用户会走 Phase 4 售后流程"退款。本 Phase 只做订单侧状态变更。
  
- `POST /api/v1/merchant/orders/{id}/note`
  - `{ "merchant_note": "感谢您的购买，如有疑问随时联系" }`
  - 覆盖式更新

- `GET /api/v1/merchant/orders/stats/summary` — 商家看板数字
  ```json
  {
    "pending_payment_count": 12,
    "paid_pending_ship_count": 8,   // 待发货
    "shipped_count": 45,
    "completed_today_count": 3,
    "revenue_today_cents": 128000
  }
  ```

---

## 11. Admin · 订单大盘与干预

- `GET /api/v1/admin/orders?status=&shop_id=&user_id=&keyword=&start_date=&end_date=&page&size`
  - keyword 匹配 order_no / receiver_name / receiver_phone / user email/phone
  - 查所有店铺
  - 权限：`admin:order:read_all`

- `GET /api/v1/admin/orders/{id}` — 完整信息（含 admin_note、payment_sessions.external_txn_no、audit trail）

- `POST /api/v1/admin/orders/{id}/cancel`
  - 允许状态：`pending_payment` 或 `paid` （已发货后不能取消，需走售后）
  - `{ "cancel_note": "..." }` 必填
  - cancel_reason = "admin_intervene"
  - 释放库存
  - 权限：`admin:order:intervene`

- `POST /api/v1/admin/orders/{id}/note`
  - `{ "admin_note": "..." }` 内部备注，用户/商家不可见
  - 权限：`admin:order:add_note`

- `POST /api/v1/admin/orders/{id}/logistics/simulate`
  - 允许状态：`shipped`
  - `{ "event_type": "in_transit", "description": "已到达杭州转运中心" }`
  - 手动追加一条 shipment_event（模拟推进）
  - 权限：`admin:order:intervene`

- `GET /api/v1/admin/orders/stats/overview` — 平台大盘
  ```json
  {
    "orders_today_count": 128,
    "orders_today_gmv_cents": 25600000,
    "pending_payment_count": 42,
    "pending_ship_count": 18,
    "shipped_count": 234,
    "cancelled_today_count": 6
  }
  ```

---

## 12. 超时任务扫描

Phase 3 采用 **cron 扫描脚本**（不引入 ARQ/Celery）。

**脚本**：`backend/app/scripts/process_timeouts.py`

**功能**：
1. 扫描 `orders WHERE status='pending_payment' AND payment_deadline_at < now()` → 事务内 status=cancelled + 释放库存 + 写 history + cancel_reason='payment_timeout'
2. 扫描 `orders WHERE status='shipped' AND auto_complete_at < now()` → 事务内 status=completed + 更新 sold_count/sales_count + 写 history
3. 每类操作**批处理**（每批 100 条，避免长事务）
4. **幂等**（重跑不会错乱）

**运行方式**：
- 手动：`uv run python -m app.scripts.process_timeouts`
- 生产：cron 每 1-5 分钟跑一次
- 也可以做成 admin 端一个"运行超时扫描"按钮供调试用（Phase 3 加个 admin-only 端点 `POST /api/v1/admin/tasks/process-timeouts`）

**辅助 just-in-time check**：
- 用户 GET /user/orders 时对 pending_payment 且 deadline 过期的做即时取消（避免用户看到"待支付"其实早该 cancel）
- 商家 GET /merchant/orders 时同理

---

## 13. 库存锁定与释放规则

Phase 2 SKU 表已有 `stock` + `locked_stock` + `sold_count`。Phase 3 使用规则：

| 事件 | stock 变化 | locked_stock 变化 | sold_count 变化 |
|---|---|---|---|
| 下单成功 | -qty | +qty | 0 |
| 取消订单（任何原因） | +qty | -qty | 0 |
| 支付成功 | 0 | 0 | 0 |
| 发货 | 0 | 0 | 0 |
| 完成订单（确认收货 or 超时） | 0 | -qty | +qty |

**注意**：`stock` 是"可售库存"（含锁定），`locked_stock` 是"已锁定尚未真正扣减"。
- 前端展示：**可售 = stock**（下单成功后就已扣掉了 qty）
- 完成订单时：从"锁定"转为"销售"，即 locked_stock -= qty + sold_count += qty，stock 不变

（本设计等价于"下单立即扣减 stock，用 locked_stock 记录待发货的部分供业务方追踪"。真实电商也有先只锁不减、支付后才减的策略，Phase 3 选择更简单的直减方式，避免超卖）

---

## 14. 幂等性（Idempotency-Key）

### 14.1 适用端点

必须支持 `Idempotency-Key` header：
- `POST /user/orders` （下单）
- `POST /user/orders/{id}/pay` （创建支付会话）

### 14.2 实现方式

- Key 是客户端生成的 UUID / nanoid，长度 8-120 字符
- Server 端：
  - 下单：`orders.idempotency_key` 上 UNIQUE(user_id, idempotency_key)；已存在则返回原订单（200，data 相同）
  - 支付：`payment_sessions` 上没有 idempotency 字段，用 `UNIQUE(order_id, status) WHERE status='pending'` 保证 —— 已有 pending session 就返回它
- 若无 Idempotency-Key header：返回 422（要求必须传）

### 14.3 客户端策略

- 前端点"提交订单"按钮时生成一个 uuid 存 useState / ref
- 请求失败重试时用同一个 key（防重复下单）
- 成功后清 key

---

## 15. 种子数据

在 `app/scripts/seed.py` 追加：

- 给 seed 的 2 个 test user（13800000001、13800000002）各插 2 条示例地址
- 给 shop1 追加 2 个已完成的历史订单（status=completed）与 1 个待发货订单（status=paid）
- 保留 Phase 2 seed 的 SPU/SKU 数据

---

## 附录 A：本 Phase 明确不做

- 真实支付网关接入（支付宝/微信 API）
- 真实物流公司 API 接入 / webhook
- 优惠券 / 满减 / 打折 / 会员价
- 拼团 / 秒杀 / 预售
- 运费计算（Phase 3 = 0；Phase 后期按地区 / 重量算）
- 发票（简化：预留字段，Phase 4/5 补）
- 分账（订单支付分给商家的会计流程）
- 售后 / 退款 / 退货 / 换货（Phase 4 全流程）
- 客服消息（Phase 5 站内信）

## 附录 B：Phase 4 会依赖的字段

- `orders.status = 'completed'` → 用户可申请售后
- `orders.status = 'shipped'` → 用户可申请"仅退款"（收到货前）
- `order_items.subtotal_cents` → 部分退款金额基准
- `orders.closed` 状态 → Phase 4 售后完成后订单转此
