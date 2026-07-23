# Phase 2 API 契约 · 商品与浏览（Category / Brand / SPU / SKU / 上架审核 / 库存 / 图片上传）

> **契约优先**。Backend Agent 按此实现；三个 Frontend Agent 按此对接。
> 若实现中发现不合理先改本文档再改代码。
>
> 版本：v1.0 · 生效范围：Phase 2 · 依赖 Phase 1 的错误码/JWT/RBAC 规范

---

## 目录
1. [沿用与新增约定](#1-沿用与新增约定)
2. [Phase 2 新增错误码](#2-phase-2-新增错误码)
3. [数据模型](#3-数据模型)
4. [商品状态机（SPU 生命周期）](#4-商品状态机spu-生命周期)
5. [RBAC 权限清单（Phase 2 新增）](#5-rbac-权限清单phase-2-新增)
6. [Admin · 类目与品牌管理](#6-admin--类目与品牌管理)
7. [Admin · 商品审核](#7-admin--商品审核)
8. [Merchant · 商品与 SKU 管理](#8-merchant--商品与-sku-管理)
9. [Merchant · 图片上传（MinIO Presigned URL）](#9-merchant--图片上传minio-presigned-url)
10. [Merchant · 库存管理](#10-merchant--库存管理)
11. [User · 商品浏览与搜索](#11-user--商品浏览与搜索)
12. [索引与性能约束](#12-索引与性能约束)
13. [种子数据](#13-种子数据)

---

## 1. 沿用与新增约定

- 沿用 Phase 1 的统一响应结构 `{code, message, data}`、JWT `aud` 分域、RBAC dependency injection
- 沿用 Phase 1 的分页格式：`?page=1&size=20` → `{items, total, page, size}`
- **金额一律用整数分**（`price_cents: int`）传输与存储，避免浮点精度问题
- **图片 URL 统一存 MinIO object key**（不含 host），前端渲染时拼 `${NEXT_PUBLIC_IMAGE_CDN}/${key}`；本地开发直接指向 `http://localhost:9000/jdclone-public/`
- **软删**：所有商品/SKU/类目/品牌都支持软删（`deleted_at IS NULL` 过滤）

---

## 2. Phase 2 新增错误码

| 段 | 用途 |
|---|---|
| **4xxx** | Admin 相关（沿用 Phase 1） |
| **6xxx** | 类目/品牌（6001 类目不存在 / 6002 类目已被使用不可删 / 6003 层级超限 / 6011 品牌不存在 / 6012 品牌 slug 冲突）|
| **7xxx** | 商品 SPU（7001 SPU 不存在 / 7002 无权操作此 SPU / 7003 SPU 状态不允许此操作 / 7004 至少需要一个 SKU 才能提审 / 7005 SPU 已下架）|
| **8xxx** | SKU（8001 SKU 不存在 / 8002 SKU code 在此 SPU 下已存在 / 8003 SKU 库存不足 / 8004 SPU 未通过审核，SKU 不可上架）|
| **9xxx** | 库存（9001 库存日志不存在 / 9002 调整量非法 / 9003 库存操作原因非法）|

新增段：**10xxx** 上传相关：`10001` 文件类型不允许 / `10002` 文件过大 / `10003` presigned URL 已过期或验证失败

**注意**：`9xxx` 之前被"服务端错误"占用，从 Phase 2 起将其挪到 `50xxx`（backend 需同步更新 errors.py）；`9xxx` 段留给库存业务。若怕破坏兼容，用 `95xx` 库存段也可。**约定用 `95xx`（如 `9501` 库存不足），`9000` 保留为通用服务端错误。**

> **决策**：本 Phase 库存业务用 `95xx` 段，避免与已发布的 `9xxx` 服务端错误段冲突。

修订后 Phase 2 错误码：
- `6xxx` 类目/品牌
- `7xxx` SPU
- `8xxx` SKU
- `9500-9599` 库存
- `10000-10999` 上传

---

## 3. 数据模型

### 3.1 类目 Category

```
categories
├─ id                BIGINT PK
├─ parent_id         BIGINT FK → categories(id) NULLABLE  -- NULL 表示根类目
├─ name              VARCHAR(60) NOT NULL
├─ slug              VARCHAR(60) UNIQUE NOT NULL          -- URL 用，如 "phones"
├─ level             SMALLINT NOT NULL                    -- 1/2/3 (最大 3 级)
├─ path              VARCHAR(120) NOT NULL                -- "1/12/125" 便于查询子树
├─ icon_url          VARCHAR(255) NULLABLE                -- MinIO object key
├─ sort_order        INTEGER NOT NULL DEFAULT 0
├─ is_visible        BOOLEAN NOT NULL DEFAULT TRUE
├─ created_at, updated_at, deleted_at
UNIQUE (parent_id, name) WHERE deleted_at IS NULL
CHECK (level BETWEEN 1 AND 3)
CHECK ((parent_id IS NULL AND level = 1) OR (parent_id IS NOT NULL AND level > 1))
```

### 3.2 品牌 Brand

```
brands
├─ id                BIGINT PK
├─ name              VARCHAR(80) UNIQUE NOT NULL
├─ slug              VARCHAR(80) UNIQUE NOT NULL
├─ logo_url          VARCHAR(255) NULLABLE                -- MinIO object key
├─ description       TEXT NULLABLE
├─ sort_order        INTEGER NOT NULL DEFAULT 0
├─ is_visible        BOOLEAN NOT NULL DEFAULT TRUE
├─ created_at, updated_at, deleted_at
```

### 3.3 SPU（标准产品单位）

```
spus
├─ id                BIGINT PK
├─ shop_id           BIGINT FK → shops(id) NOT NULL
├─ category_id       BIGINT FK → categories(id) NOT NULL   -- 只允许挂在叶子类目（level=3）
├─ brand_id          BIGINT FK → brands(id) NULLABLE       -- 部分商品可能无品牌
├─ title             VARCHAR(200) NOT NULL
├─ subtitle          VARCHAR(200) NULLABLE                 -- 促销语/短描述
├─ description       TEXT NULLABLE                         -- 富文本 HTML（Phase 2 不做 XSS 过滤，纯文本即可）
├─ main_image        VARCHAR(255) NOT NULL                 -- MinIO object key
├─ images            JSONB NOT NULL DEFAULT '[]'::jsonb    -- Array[str]：额外的展示图片，最多 8 张
├─ spec_axes         JSONB NOT NULL DEFAULT '[]'::jsonb    -- Array[str]：定义 SKU 的规格轴，如 ["color","size"]；空数组表示单规格
├─ status            ENUM('draft','pending_review','approved','rejected','off_shelf') NOT NULL DEFAULT 'draft'
├─ reviewer_admin_id BIGINT FK → admin_users(id) NULLABLE
├─ review_note       TEXT NULLABLE
├─ reviewed_at       TIMESTAMPTZ NULLABLE
├─ sales_count       INTEGER NOT NULL DEFAULT 0            -- 冗余销量（Phase 3 订单成交时更新）
├─ view_count        INTEGER NOT NULL DEFAULT 0            -- 冗余浏览数
├─ min_price_cents   INTEGER NOT NULL DEFAULT 0            -- 冗余：所有 active SKU 最小价，方便列表页排序
├─ max_price_cents   INTEGER NOT NULL DEFAULT 0
├─ published_at      TIMESTAMPTZ NULLABLE                  -- 首次审核通过时间
├─ created_at, updated_at, deleted_at

INDEX (shop_id, status)
INDEX (category_id, status)     -- 类目页
INDEX (brand_id, status)        -- 品牌页
INDEX (status, published_at DESC)  -- "最新上架"
```

### 3.4 SKU

```
skus
├─ id                BIGINT PK
├─ spu_id            BIGINT FK → spus(id) NOT NULL
├─ sku_code          VARCHAR(60) NOT NULL                  -- 商家自定义，UNIQUE(spu_id, sku_code)
├─ specs             JSONB NOT NULL DEFAULT '{}'::jsonb    -- {color:"红", size:"L"}；键必须是 spu.spec_axes 子集
├─ price_cents       INTEGER NOT NULL                      -- 现价
├─ original_price_cents INTEGER NULLABLE                   -- 划线价（可选，> price_cents）
├─ stock             INTEGER NOT NULL DEFAULT 0            -- 当前可用库存（考虑锁定后剩余）
├─ locked_stock      INTEGER NOT NULL DEFAULT 0            -- 已被订单锁定尚未扣减的（Phase 3 用）
├─ sold_count        INTEGER NOT NULL DEFAULT 0            -- 累计已售
├─ image             VARCHAR(255) NULLABLE                 -- 若 null 用 spu.main_image
├─ is_active         BOOLEAN NOT NULL DEFAULT TRUE         -- 商家可禁用某个 SKU 不影响其他
├─ created_at, updated_at, deleted_at
UNIQUE (spu_id, sku_code) WHERE deleted_at IS NULL
CHECK (price_cents > 0)
CHECK (stock >= 0)
```

### 3.5 库存日志 InventoryLog

```
inventory_logs
├─ id                BIGINT PK
├─ sku_id            BIGINT FK → skus(id) NOT NULL
├─ delta             INTEGER NOT NULL                      -- 正为进货/调增；负为出货/调减
├─ balance_after     INTEGER NOT NULL                      -- 变更后的 stock（快照）
├─ reason            ENUM('purchase','sale','refund_return','adjust','initial') NOT NULL
├─ operator_type     ENUM('merchant','admin','system') NOT NULL
├─ operator_id       BIGINT NULLABLE                       -- merchant_account.id / admin_user.id
├─ note              TEXT NULLABLE
├─ related_order_id  BIGINT NULLABLE                       -- Phase 3 关联订单 ID（暂时留空）
├─ created_at

INDEX (sku_id, created_at DESC)
```

**约束**：`inventory_logs` 表**只写不改不删**（真实场景是审计追溯用的）；库存值以 `skus.stock` 为准，`inventory_logs` 记录变化流水。

---

## 4. 商品状态机（SPU 生命周期）

```
     [商家新建]
         │
     ┌───▼───┐
     │ draft │──(商家编辑无限制)──> draft
     └───┬───┘
         │ (商家点"提交审核"；要求 spu 有 ≥1 个 SKU)
         ▼
     ┌────────────┐
     │pending_review│ ────(admin approve)────> ┌─────────┐
     └────────────┘                             │approved│ ──(商家/管理员下架)──> ┌───────────┐
         │                                      └─────────┘                        │off_shelf │
         │ (admin reject +note)                     ▲                              └───────────┘
         ▼                                          │(商家"重新上架")                 │
     ┌────────┐ ──(商家改后重新提交)──> pending      │                              │
     │rejected│                                     └──────────────────────────────┘
     └────────┘
```

**关键规则**：
- **draft/rejected 状态下可任意编辑**任何字段
- **approved/off_shelf 状态下编辑关键字段**（title/category_id/main_image/spec_axes）**需重新提审**，非关键字段（subtitle/description/images/SKU 价格库存）**立即生效**
- SKU 只在 SPU 为 approved 时对外可见（listing 页/搜索都过滤）
- pending_review 状态的 SPU **商家不可编辑**（避免审核期间内容变化）；可以撤回到 draft
- 首次 approve 时写 `published_at`；重新审批不改
- 强制下架（admin）→ status=off_shelf，商家不能再改成 approved，只能删（软删）后重新建

---

## 5. RBAC 权限清单（Phase 2 新增）

| 权限键 | 分配给 |
|---|---|
| `admin:category:manage` | SUPER_ADMIN, BUSINESS_ADMIN |
| `admin:brand:manage` | SUPER_ADMIN, BUSINESS_ADMIN |
| `admin:spu:review` | SUPER_ADMIN, BUSINESS_ADMIN |
| `admin:spu:force_offshelf` | SUPER_ADMIN, BUSINESS_ADMIN |
| `admin:spu:read_all` | SUPER_ADMIN, BUSINESS_ADMIN, CUSTOMER_SERVICE_ADMIN |
| `merchant:spu:manage` | SHOP_OWNER, SHOP_OPERATOR |
| `merchant:sku:manage` | SHOP_OWNER, SHOP_OPERATOR |
| `merchant:inventory:adjust` | SHOP_OWNER, SHOP_OPERATOR |
| `merchant:upload:presign` | SHOP_OWNER, SHOP_OPERATOR |
| `user:catalog:read` | 任何 user（含未登录） |
| `user:spu:read` | 任何 user（含未登录） |

**说明**：user 端浏览类接口不强制登录（未带 token 也能查）；merchant/admin 严格鉴权。

---

## 6. Admin · 类目与品牌管理

### 6.1 类目

- `GET /api/v1/admin/categories` — 返回完整树（不分页；类目量级 <500）
- `GET /api/v1/admin/categories/{id}` — 详情
- `POST /api/v1/admin/categories` — `{parent_id?, name, slug, icon_url?, sort_order?, is_visible?}`；后端自动计算 level 和 path
- `PATCH /api/v1/admin/categories/{id}` — 支持改 name/slug/icon/sort_order/is_visible；**不允许改 parent_id**（要移动就删了重建）
- `DELETE /api/v1/admin/categories/{id}` — 软删；有子类目或被 SPU 引用则报 6002
  - 权限：`admin:category:manage`

**面向用户端的公开接口**：
- `GET /api/v1/catalog/categories?visible=true` — 返回可见的完整树

### 6.2 品牌

- `GET /api/v1/admin/brands?page&size&keyword` — 分页
- `GET /api/v1/admin/brands/{id}`
- `POST /api/v1/admin/brands` — `{name, slug, logo_url?, description?, sort_order?, is_visible?}`
- `PATCH /api/v1/admin/brands/{id}`
- `DELETE /api/v1/admin/brands/{id}` — 软删
  - 权限：`admin:brand:manage`

**公开接口**：
- `GET /api/v1/catalog/brands?visible=true&keyword=&page&size` — 分页返回可见品牌

---

## 7. Admin · 商品审核

- `GET /api/v1/admin/spus?status=pending_review&shop_id=&keyword=&page&size` — 审核队列 + 全站商品浏览
- `GET /api/v1/admin/spus/{id}` — 详情（含所有 SKU）
- `POST /api/v1/admin/spus/{id}/approve` — `{review_note?}` — 首次通过写 published_at
- `POST /api/v1/admin/spus/{id}/reject` — `{review_note}` （必填 5-500 字）
- `POST /api/v1/admin/spus/{id}/force-offshelf` — `{review_note}` — 强制下架
  - 权限：审核用 `admin:spu:review`，强制下架用 `admin:spu:force_offshelf`

---

## 8. Merchant · 商品与 SKU 管理

### 8.1 SPU

- `GET /api/v1/merchant/spus?status=&keyword=&page&size` — 当前商家的商品列表
- `GET /api/v1/merchant/spus/{id}` — 详情（含 SKUs）
- `POST /api/v1/merchant/spus` — 创建 draft
  ```json
  {
    "category_id": 125, "brand_id": 8, "title": "...",
    "subtitle": "...", "description": "...",
    "main_image": "products/xxx.jpg",
    "images": ["products/yyy.jpg"],
    "spec_axes": ["color","size"]
  }
  ```
- `PATCH /api/v1/merchant/spus/{id}` — 编辑（按 §4 规则决定是否重新提审）
- `DELETE /api/v1/merchant/spus/{id}` — 软删（仅 draft/rejected/off_shelf 状态允许，approved 需先下架）
- `POST /api/v1/merchant/spus/{id}/submit-review` — 提交审核
  - 前置校验：至少 1 个 active SKU；status ∈ {draft, rejected}
- `POST /api/v1/merchant/spus/{id}/withdraw-review` — 从 pending_review 撤回到 draft
- `POST /api/v1/merchant/spus/{id}/offshelf` — approved → off_shelf
- `POST /api/v1/merchant/spus/{id}/onshelf` — off_shelf → approved（不需要再审核）
  - 权限：以上都是 `merchant:spu:manage` + 校验 shop_id 归属

### 8.2 SKU（在 SPU 下）

- `GET /api/v1/merchant/spus/{spu_id}/skus` — 列出该 SPU 的所有 SKU
- `POST /api/v1/merchant/spus/{spu_id}/skus` — 新增
  ```json
  {
    "sku_code": "RED-L",
    "specs": {"color":"红","size":"L"},
    "price_cents": 9900,
    "original_price_cents": 12900,
    "stock": 50,
    "image": null,
    "is_active": true
  }
  ```
  - 校验 `specs` 的 keys ⊂ `spu.spec_axes`
  - 校验 `sku_code` 在此 SPU 下唯一
- `PATCH /api/v1/merchant/spus/{spu_id}/skus/{sku_id}` — 编辑（价格/图片/is_active）
  - **不允许**改 specs 和 sku_code（要改就删了新建）
- `DELETE /api/v1/merchant/spus/{spu_id}/skus/{sku_id}` — 软删
  - 权限：`merchant:sku:manage`

---

## 9. Merchant · 图片上传（MinIO Presigned URL）

三步流程：

### 9.1 申请 presigned URL

`POST /api/v1/merchant/uploads/presign`

**请求**：
```json
{
  "purpose": "spu_main" | "spu_gallery" | "brand_logo" | "category_icon",
  "content_type": "image/jpeg",
  "file_size": 234567
}
```

**校验**（后端）：
- `content_type` ∈ {image/jpeg, image/png, image/webp}
- `file_size` ≤ 5 MB
- purpose 决定桶（都用 `jdclone-public`）与前缀（`spu/`, `brand/`, `category/`）

**响应**：
```json
{
  "code": 0, "message": "ok",
  "data": {
    "object_key": "spu/2026/07/22/uuid-xxxx.jpg",
    "upload_url": "http://localhost:9000/jdclone-public/spu/2026/07/22/uuid-xxxx.jpg?X-Amz-...",
    "expires_at": "2026-07-22T10:15:00Z",
    "public_url": "http://localhost:9000/jdclone-public/spu/2026/07/22/uuid-xxxx.jpg"
  }
}
```

- `object_key`：前端提交给业务 API 时用这个（如 `spus.main_image`）
- `upload_url`：前端 `PUT` 到这里，body 是文件 bytes；必须带对应的 `Content-Type` 头
- 有效期 15 分钟

### 9.2 前端直传 MinIO
```
PUT {upload_url}
Content-Type: image/jpeg
Body: <file bytes>
```

### 9.3 前端把 `object_key` 写进业务字段

用户填完商品表单点提交，把之前拿到的 `object_key` 填入 `main_image` 等字段，随 SPU 创建/更新请求一起发。

**注意**：Phase 2 不做上传后校验（如"用户上传了 URL 但没实际传"）；商家用了不存在的 object_key 就是他自己的问题，前端 UI 里只显示上传成功后的图。

### 9.4 后端安全约束

- CORS：MinIO 需 allow `POST` from localhost:3001（Docker 环境变量 `MINIO_BROWSER_REDIRECT_URL` 或 CORS 配置）
- object_key 命名带日期分区 + UUID 防止碰撞
- bucket policy：`jdclone-public` 允许匿名 read；写权限仅 backend；上传通过 presigned URL 短时授权

权限：`merchant:upload:presign`

---

## 10. Merchant · 库存管理

- `GET /api/v1/merchant/skus/{sku_id}/inventory-logs?page&size` — SKU 库存流水
- `POST /api/v1/merchant/skus/{sku_id}/inventory/adjust`
  ```json
  {
    "delta": 20,
    "reason": "purchase" | "adjust",
    "note": "补货 20 件"
  }
  ```
  - `delta` 可正可负；负值时校验 `sku.stock + delta ≥ 0` 否则 9501
  - 事务内：更新 sku.stock + 写 inventory_log
  - 权限：`merchant:inventory:adjust`

---

## 11. User · 商品浏览与搜索

**全部不强制登录**（未带 token 也可访问）。

### 11.1 首页 / 类目 / 品牌

- `GET /api/v1/catalog/categories?visible=true` — 完整树（见 §6.1）
- `GET /api/v1/catalog/brands?...` — 品牌列表（见 §6.2）
- `GET /api/v1/catalog/recommendations?limit=10` — Phase 2 极简版：返回最新审核通过的 10 个 SPU（按 published_at desc）

### 11.2 SPU 列表 / 搜索

`GET /api/v1/catalog/spus`

**查询参数**：
- `category_id`（可选）：过滤指定类目及其子类目（用 `path LIKE 'parent_path/%'`）
- `brand_id`（可选）
- `keyword`（可选）：ILIKE 匹配 `title` 和 `subtitle`（Phase 2 简单实现；Phase 7 优化为 pg_trgm 或 Meilisearch）
- `min_price_cents` / `max_price_cents`（可选）：过滤 `min_price_cents` 范围
- `sort`：`default | newest | price_asc | price_desc | sales`（默认 `default` = published_at desc）
- `page`, `size`（默认 20，max 60）

**响应**（列表元素）：
```json
{
  "id": 1001,
  "title": "iPhone 20 Pro",
  "subtitle": "钛金属机身",
  "main_image": "spu/xxx.jpg",
  "min_price_cents": 799900,
  "max_price_cents": 1099900,
  "sales_count": 12345,
  "brand": { "id": 8, "name": "Apple" },
  "category": { "id": 125, "name": "手机" }
}
```

**只返回 status=approved 的 SPU。**

### 11.3 SPU 详情

`GET /api/v1/catalog/spus/{id}`

返回完整 SPU + 所有 active SKU + 类目路径（面包屑）+ 品牌信息。

副作用：`view_count += 1`（可用异步任务或简单同步；Phase 2 同步即可，追求性能再改）

**响应**：
```json
{
  "id": 1001,
  "title": "...", "subtitle": "...", "description": "<p>...</p>",
  "main_image": "...", "images": ["...","..."],
  "spec_axes": ["color","size"],
  "min_price_cents": 799900, "max_price_cents": 1099900,
  "sales_count": 12345, "view_count": 88888,
  "shop": { "id": 12, "name": "苹果官方旗舰店" },
  "brand": { "id": 8, "name": "Apple", "slug": "apple", "logo_url": "..." },
  "category": { "id": 125, "name": "手机", "path": [
     {"id":1,"name":"数码"},{"id":12,"name":"手机通讯"},{"id":125,"name":"手机"}
  ]},
  "skus": [
    {
      "id": 5001, "sku_code": "PRO-BLACK-256",
      "specs": {"color":"曜岩黑","memory":"256G"},
      "price_cents": 799900, "original_price_cents": 899900,
      "stock": 12, "image": null, "is_active": true
    }
  ],
  "published_at": "2026-07-01T08:00:00Z"
}
```

status ≠ approved → 404（对用户端）

### 11.4 相关推荐（简化）

`GET /api/v1/catalog/spus/{id}/related?limit=8` — 返回同类目的其他 approved SPU（按 sales_count desc）

---

## 12. 索引与性能约束

- `spus.min_price_cents` 是冗余字段，SKU 增删改价时通过 event/trigger 更新（Phase 2 用应用层触发即可，勿用 DB trigger）
- 类目页 SPU 查询用 `categories.path LIKE 'X/%'` + `spus.category_id IN (子类目列表)` 之一；建议后者，先算子类目 ID 集合再 IN 查询（PostgreSQL 对 `LIKE` 前缀能走索引但要 `text_pattern_ops` 索引）
- 搜索列表接口的响应必须在 500ms 内（1000 SPU 数据量下）

---

## 13. 种子数据

Phase 2 seed（追加到 `app/scripts/seed.py`，幂等）：

**类目**（示范 3 级树）：
```
数码 (level 1)
├─ 手机通讯 (level 2)
│  ├─ 手机 (level 3)
│  └─ 对讲机 (level 3)
└─ 电脑办公 (level 2)
   ├─ 笔记本电脑 (level 3)
   └─ 键盘 (level 3)
家居日用 (level 1)
└─ 厨具餐具 (level 2)
   └─ 保温杯 (level 3)
```

**品牌**：Apple / 华为 / 小米 / 无印良品 / 膳魔师（5 个）

**SPU + SKU**：至少 3 个 approved 状态的 SPU（用 shop1 = seed 后 approve 出来的第一个店铺），每个 SPU 2-3 个 SKU，供前端展示与联调。

**MinIO 图片**：seed 时不上传真实图片；`main_image` / `logo_url` 等字段填一个占位 key，前端渲染时若图片 404 用占位图。

---

## 附录 A：本 Phase 明确不做

- 商品评价（Phase 5）
- 相关推荐算法（用同类目排销量代替）
- 属性面筛选（specs 面板搜索）：Phase 2 只做类目/品牌/价格/关键字
- 中文分词与全文索引（用 ILIKE 代替，Phase 7 换 Meilisearch）
- 图片上传后端校验（大小/尺寸/格式；MinIO 层已限制大小，格式由前端 accept 限制）
- 图片 CDN 与压缩
- SKU 批量导入（Excel）
- 商品分销 / 拼团 / 打折
- 商品 SEO slug（用 ID 即可）

## 附录 B：Phase 3 会依赖的字段

- `skus.locked_stock`：下单时增加、支付超时/取消时释放
- `skus.sold_count` / `spus.sales_count`：订单确认收货时增加
- `inventory_logs.related_order_id`：订单扣减库存时写入
- `spus.published_at`：Phase 3 订单不引用此字段，仅供列表排序
