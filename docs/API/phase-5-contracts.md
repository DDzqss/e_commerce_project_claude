# Phase 5 API 契约 · 辅助功能（商品评价 + 站内信 + 地区数据 + 商家店铺主页）

> **契约优先**。Backend 按此实现；Frontend 按此对接。歧义先改契约再改代码。
>
> 版本：v1.0 · 生效范围：Phase 5 · 依赖 Phase 1-4

---

## 目录
1. [沿用与新增约定](#1-沿用与新增约定)
2. [Phase 5 新增错误码](#2-phase-5-新增错误码)
3. [数据模型](#3-数据模型)
4. [商品评价](#4-商品评价)
5. [评价举报与审核](#5-评价举报与审核)
6. [站内信 / 消息通知](#6-站内信--消息通知)
7. [地区数据（省 / 市 / 区）](#7-地区数据省--市--区)
8. [地址簿增强](#8-地址簿增强)
9. [商家店铺主页](#9-商家店铺主页)
10. [Phase 5 新增 RBAC 权限](#10-phase-5-新增-rbac-权限)
11. [事件驱动通知](#11-事件驱动通知)
12. [种子数据](#12-种子数据)

---

## 1. 沿用与新增约定

- 沿用 Phase 1-4 所有约定（响应结构 / 分页 / JWT 分域 / MinIO 图片 / audit_log）
- **评价编辑窗口**：确认收货后 15 天内可编辑 1 次；超期或已编辑过则只读
- **通知轮询**：Phase 5 用 HTTP 轮询（前端 60s 拉一次未读数）；WebSocket 留 Phase 后期
- **评价审核策略**：**先发后审**（默认 visible=true）；admin 审核后可 hidden=true；user 举报后进入待审核队列
- **地区数据**：seed 一份 3 级树 JSON（省 34 条 / 市 300+ / 区 3000+）；不做实时更新

---

## 2. Phase 5 新增错误码

| 段 | 用途 |
|---|---|
| **19xxx** | 评价（`19001` 评价不存在 / `19002` 无权访问 / `19003` 此订单不可评价（未收货 or 已评价）/ `19004` 评价编辑窗口已过 or 已编辑过 / `19005` 星级非法 1-5 / `19006` 内容超长 / `19007` 图片数量超上限 6 张）|
| **20xxx** | 评价回复（`20001` 回复不存在 / `20002` 已回复过（一条评价一条回复）/ `20003` 无权回复）|
| **21xxx** | 评价举报（`21001` 举报不存在 / `21002` 已举报过（同一评价同一用户只能举报一次）/ `21003` 举报理由非法）|
| **22xxx** | 通知（`22001` 通知不存在 / `22002` 无权访问）|
| **23xxx** | 地区（`23001` 地区码无效 / `23002` 地区不匹配（如市不属于省））|

---

## 3. 数据模型

### 3.1 商品评价 Review

```
reviews
├─ id                    BIGINT PK
├─ order_id              BIGINT FK → orders(id) NOT NULL
├─ order_item_id         BIGINT FK → order_items(id) NOT NULL
├─ user_id               BIGINT FK → users(id) NOT NULL
├─ spu_id                BIGINT FK → spus(id) NOT NULL                -- 冗余，查商品评价列表用
├─ sku_id                BIGINT FK → skus(id) NOT NULL                -- 冗余
├─ shop_id               BIGINT FK → shops(id) NOT NULL               -- 冗余
├─ rating                SMALLINT NOT NULL                            -- 1..5
├─ content               VARCHAR(2000) NOT NULL                        -- 5-2000 字
├─ images                JSONB NOT NULL DEFAULT '[]'::jsonb           -- object_key 数组，最多 6 张
├─ is_anonymous          BOOLEAN NOT NULL DEFAULT FALSE               -- 匿名评价（显示"匿***名"）
├─ visible               BOOLEAN NOT NULL DEFAULT TRUE                -- admin 可下架
├─ hidden_by_admin_id    BIGINT FK → admin_users(id) NULLABLE
├─ hidden_reason         TEXT NULLABLE
├─ hidden_at             TIMESTAMPTZ NULLABLE
├─ edit_count            SMALLINT NOT NULL DEFAULT 0                  -- 编辑次数（Phase 5 上限 1）
├─ edit_deadline_at      TIMESTAMPTZ NOT NULL                          -- created_at + 15 day
├─ created_at, updated_at, deleted_at
UNIQUE (order_item_id) WHERE deleted_at IS NULL                        -- 每个 order_item 只能评一次
INDEX (spu_id, visible, created_at DESC)   -- 商品详情页评价 tab
INDEX (shop_id, visible, created_at DESC)  -- 店铺主页评价 tab
INDEX (user_id, created_at DESC)
```

### 3.2 评价回复 ReviewReply

```
review_replies
├─ id                    BIGINT PK
├─ review_id             BIGINT FK → reviews(id) ON DELETE CASCADE UNIQUE NOT NULL
├─ merchant_account_id   BIGINT FK → merchant_accounts(id) NOT NULL
├─ shop_id               BIGINT FK → shops(id) NOT NULL                -- 冗余
├─ content               VARCHAR(500) NOT NULL                         -- 5-500 字
├─ created_at, updated_at
UNIQUE (review_id)  -- 一条评价一条回复
```

### 3.3 评价举报 ReviewReport

```
review_reports
├─ id                    BIGINT PK
├─ review_id             BIGINT FK → reviews(id) NOT NULL
├─ reporter_user_id      BIGINT FK → users(id) NOT NULL
├─ reason_category       ENUM('ad_spam','inappropriate','fake_review','offensive','irrelevant','other') NOT NULL
├─ reason_note           TEXT NULLABLE                                 -- 0-500 字
├─ status                ENUM('pending','upheld','dismissed') NOT NULL DEFAULT 'pending'
├─ reviewer_admin_id     BIGINT FK → admin_users(id) NULLABLE
├─ review_note           TEXT NULLABLE                                 -- admin 处理备注
├─ reviewed_at           TIMESTAMPTZ NULLABLE
├─ created_at
UNIQUE (review_id, reporter_user_id)  -- 同用户对同评价只举报一次
INDEX (status, created_at)
```

### 3.4 站内信通知 Notification

```
notifications
├─ id                    BIGINT PK
├─ recipient_type        ENUM('user','merchant','admin') NOT NULL
├─ recipient_id          BIGINT NOT NULL                                -- users.id / merchant_accounts.id / admin_users.id
├─ category              ENUM('system','order','aftersales','review','shop','promo') NOT NULL
├─ title                 VARCHAR(120) NOT NULL
├─ body                  TEXT NOT NULL                                  -- 支持 markdown 简单标记
├─ action_url            VARCHAR(500) NULLABLE                          -- 前端点击跳转的相对路径
├─ related_type          VARCHAR(60) NULLABLE                           -- "order" / "aftersales" / "review" 等
├─ related_id            BIGINT NULLABLE                                -- 对应资源 ID
├─ is_read               BOOLEAN NOT NULL DEFAULT FALSE
├─ read_at               TIMESTAMPTZ NULLABLE
├─ created_at
INDEX (recipient_type, recipient_id, is_read, created_at DESC)   -- 收件箱与未读筛选
```

**保留策略**：Phase 5 不做归档；软删由用户手动"清空已读"触发（DELETE 而非 soft delete）。

### 3.5 地区 Region

```
regions
├─ code                  VARCHAR(12) PK          -- 国标行政区划码 (省 2 位 + 市 2 位 + 区 2 位；前缀补 0，共 6 位；扩展至 12 位以兼容子级)
├─ parent_code           VARCHAR(12) NULLABLE   -- 顶层省份 NULL
├─ name                  VARCHAR(60) NOT NULL
├─ short_name            VARCHAR(20) NULLABLE   -- 简称如 "京" / "沪"
├─ level                 SMALLINT NOT NULL      -- 1=province, 2=city, 3=district
├─ sort_order            INTEGER NOT NULL DEFAULT 0
INDEX (parent_code)
INDEX (level)
```

**说明**：因数据固定不变，此表只 seed 一次，无 CRUD API；用户端通过 `GET /api/v1/regions/tree` 或 `GET /api/v1/regions/children/{parent_code}` 拉取。

### 3.6 地址簿增强（对 Phase 3 `addresses` 表追加 3 字段）

```
ALTER TABLE addresses ADD COLUMN
├─ province_code         VARCHAR(12) NULLABLE   -- 关联 regions.code；旧数据 NULL
├─ city_code             VARCHAR(12) NULLABLE
├─ district_code         VARCHAR(12) NULLABLE
```

Phase 3 已有 `province/city/district` 文本字段；Phase 5 追加 code 让前端做级联联动。旧数据代码为 NULL 不影响。

### 3.7 店铺主页增强（对 Phase 1 `shops` 表追加）

```
ALTER TABLE shops ADD COLUMN
├─ logo_url              VARCHAR(255) NULLABLE   -- 店铺 logo MinIO object_key
├─ banner_url            VARCHAR(255) NULLABLE   -- 店铺 banner
├─ announcement          TEXT NULLABLE           -- 店铺公告 markdown
├─ opened_at             TIMESTAMPTZ NULLABLE    -- 开店时间（首次审核通过时间；alembic 自动填充为 created_at）
├─ rating_avg            NUMERIC(3,2) NOT NULL DEFAULT 5.00  -- 冗余：所有 visible reviews 平均分（3 位小数、2 位小数点后）
├─ rating_count          INTEGER NOT NULL DEFAULT 0          -- 冗余：visible reviews 总数
├─ sales_count           INTEGER NOT NULL DEFAULT 0          -- 冗余：已完成订单商品件数
```

冗余字段维护：
- `rating_avg` / `rating_count`：新增 visible review 时更新；review 被 admin hidden 或删除时更新
- `sales_count`：订单转 `completed` 时增加（Phase 3 已有 sku.sold_count；这里额外聚合到 shop）

---

## 4. 商品评价

### 4.1 User · 发起评价

`POST /api/v1/user/orders/{order_id}/reviews`
Headers: `Idempotency-Key`

**请求**：
```json
{
  "reviews": [
    {
      "order_item_id": 5001,
      "rating": 5,
      "content": "商品质量非常好...",
      "images": ["reviews/2026/07/25/xxx.jpg"],
      "is_anonymous": false
    }
  ]
}
```

**服务端校验**：
- 订单归属当前用户 + status=`completed`
- items 属于该订单
- 每个 order_item 未评价过（19003）
- rating 1-5
- content 5-2000 字
- images ≤ 6 张

**响应**：201 + 创建的 review 列表；同事务更新 shops.rating_avg / rating_count；写通知给 shop（"用户给了 X 星评价"）

### 4.2 User · 编辑评价

`PATCH /api/v1/user/reviews/{id}`
- 允许条件：`edit_count = 0` + `now < edit_deadline_at`
- Body: `{ rating, content, images }` 至少一个
- edit_count += 1；同事务更新 shops.rating_avg

### 4.3 User · 删除评价

`DELETE /api/v1/user/reviews/{id}` — 软删；deleted_at = now；同事务更新冗余

### 4.4 User · 我的评价列表

`GET /api/v1/user/reviews?page&size` — 分页，含商品快照 + merchant reply（如有）

### 4.5 公开 · 商品评价列表

`GET /api/v1/catalog/spus/{spu_id}/reviews?rating=&page&size`
- rating 可选：1..5 单值筛选或 `with_images=true`
- 只返回 visible=true 且未软删
- 返回 pagination + 汇总（`{avg, count, distribution: {1: 3, 2: 5, ...}}`）
- 匿名评价 user 昵称显示为"匿***名"

### 4.6 公开 · 店铺评价列表

`GET /api/v1/catalog/shops/{shop_id}/reviews?page&size`

---

## 5. 评价举报与审核

### 5.1 User · 举报评价

`POST /api/v1/user/reviews/{id}/report`
Body:
```json
{ "reason_category": "ad_spam", "reason_note": "..." }
```
- 同用户对同评价只能举报 1 次（21002）
- 举报后不立即隐藏评价，进入 admin 审核

### 5.2 Merchant · 回复评价

`POST /api/v1/merchant/reviews/{id}/reply`
- 校验 review.shop_id = 商家 shop_id
- Body: `{ "content": "感谢您的评价..." }`（5-500 字）
- 一条评价一条回复（20002）

`PATCH /api/v1/merchant/reviews/{id}/reply`
- 修改回复内容（无编辑窗口，随时可改）

`DELETE /api/v1/merchant/reviews/{id}/reply`
- 删除回复

### 5.3 Merchant · 本店评价列表

`GET /api/v1/merchant/reviews?rating=&has_reply=&keyword=&page&size`
- has_reply=false 过滤"未回复"（便于处理未回复的差评）
- 默认按 created_at DESC

### 5.4 Admin · 评价审核

`GET /api/v1/admin/reviews?visible=&shop_id=&spu_id=&keyword=&page&size` — 全站评价查看
`GET /api/v1/admin/reviews/{id}` — 详情

`POST /api/v1/admin/reviews/{id}/hide` — Body: `{ "hidden_reason": "..." }` (≥ 5 字)
`POST /api/v1/admin/reviews/{id}/restore` — 取消隐藏
- 同事务更新 shops.rating_avg / rating_count

### 5.5 Admin · 举报队列

`GET /api/v1/admin/review-reports?status=pending&page&size`
`POST /api/v1/admin/review-reports/{id}/uphold` — Body: `{ "review_note": "..." }` — 举报成立，同事务隐藏对应评价
`POST /api/v1/admin/review-reports/{id}/dismiss` — Body: `{ "review_note": "..." }` — 驳回举报

---

## 6. 站内信 / 消息通知

### 6.1 User / Merchant / Admin 通用（scope 由 auth 决定）

- `GET /api/v1/{scope}/notifications?is_read=&category=&page&size`
  - scope = `user` / `merchant` / `admin`
  - 默认按 `created_at DESC`
- `GET /api/v1/{scope}/notifications/unread-count` — 未读数
- `POST /api/v1/{scope}/notifications/{id}/read` — 标记已读（幂等）
- `POST /api/v1/{scope}/notifications/read-all` — 全部已读
- `DELETE /api/v1/{scope}/notifications/{id}` — 删除单条
- `DELETE /api/v1/{scope}/notifications/read` — 清空已读

### 6.2 事件驱动通知（后端内部服务）

`notification_service.py`：
- `notify_user(user_id, category, title, body, action_url, related_type, related_id)` 单条发送
- `notify_merchants_of_shop(shop_id, ...)` 广播店铺全部 merchant_accounts
- `notify_admins(role_filter?, ...)` 广播符合角色的 admin_users

**订阅点**（触发通知的业务事件）：
| 事件 | 收件人 | 类别 |
|---|---|---|
| 订单已支付 | shop merchants | `order` |
| 订单已发货 | order.user | `order` |
| 订单已收货 | shop merchants | `order` |
| 售后申请提交 | shop merchants | `aftersales` |
| 售后审核通过/驳回 | order.user | `aftersales` |
| 售后已升级仲裁 | admin (customer_service 角色) | `aftersales` |
| 评价被回复 | review.user | `review` |
| 评价被举报 | shop merchants | `review` |
| 评价被隐藏 | review.user | `review` |
| 商家申请审核结果 | applicant user | `system` |

（这些事件的 hook 点在 Phase 5 补上；Backend agent 需要小规模改动 Phase 1-4 的服务层加 `notify_*` 调用）

---

## 7. 地区数据（省 / 市 / 区）

### 7.1 公开接口

- `GET /api/v1/regions/tree` — 完整 3 级树（数据固定；前端本地缓存 1 天）
- `GET /api/v1/regions/children/{parent_code}` — 单层子节点（更轻量的按需加载）
  - 传 `parent_code=`（空/`root`）返回省列表
  - 传省 code 返回市列表；市 code 返回区列表

### 7.2 数据来源

Seed 从 `app/scripts/regions_data.json`（预填的中国 3 级行政区划）读入。文件由 Backend agent 生成（可以简化到只有典型省市区，或引用 GB/T 2260-2007 标准的完整版）。**Phase 5 简化**：至少覆盖直辖市 + 华东华南主要省份的完整 3 级，其他省份至少省级 + 主要市（够联调即可）。

---

## 8. 地址簿增强

Phase 3 已有 addresses 表基本 CRUD。Phase 5 追加：

### 8.1 三字段 code 支持

- `POST /api/v1/user/addresses` 请求 body 新增可选字段 `province_code / city_code / district_code`
- `PATCH /api/v1/user/addresses/{id}` 同上
- 后端校验：三个 code 必须构成合法父子关系（否则 23002）
- 旧地址（无 code）读取时按 name 尝试反查填充 code（best-effort）

### 8.2 默认地址快捷切换

已有 `POST /api/v1/user/addresses/{id}/set-default`；Phase 5 前端在地址簿添加"设为默认"按钮。

---

## 9. 商家店铺主页

### 9.1 公开 · 店铺主页

`GET /api/v1/catalog/shops/{id}`

**响应**：
```json
{
  "code": 0,
  "data": {
    "id": 12,
    "name": "小李杂货铺",
    "description": "...",
    "logo_url": "...",
    "banner_url": "...",
    "announcement": "本店暑期不打烊",
    "opened_at": "2026-07-15T00:00:00Z",
    "rating_avg": 4.85,
    "rating_count": 128,
    "sales_count": 3421,
    "contact_name": "李明",
    "contact_phone": "138****2222",  // 脱敏
    "status": "active"
  }
}
```

### 9.2 公开 · 店铺商品列表

`GET /api/v1/catalog/shops/{id}/spus?category_id=&sort=&page&size`（与 catalog/spus 类似，但限定 shop_id）

### 9.3 Merchant · 编辑店铺主页

`PATCH /api/v1/merchant/me/shop` (Phase 1 已有)
- Body 扩展：`logo_url`, `banner_url`, `announcement`, `description`, `contact_name`, `contact_phone` 全部允许改
- 使用 Phase 2 `merchant/uploads/presign` 上传 logo/banner（purpose 新增 `shop_logo` / `shop_banner`）

---

## 10. Phase 5 新增 RBAC 权限

| 权限键 | 分配给 |
|---|---|
| `user:review:create` | 任何 user |
| `user:review:edit_own` | 任何 user |
| `user:review:delete_own` | 任何 user |
| `user:review:report` | 任何 user |
| `user:notification:read_own` | 任何 user |
| `merchant:review:read_shop` | SHOP_OWNER, SHOP_OPERATOR, SHOP_SUPPORT |
| `merchant:review:reply` | SHOP_OWNER, SHOP_OPERATOR |
| `merchant:notification:read_shop` | SHOP_OWNER, SHOP_OPERATOR, SHOP_SUPPORT |
| `merchant:shop:update_profile` | SHOP_OWNER |
| `admin:review:moderate` | SUPER, BUSINESS, CUSTOMER_SERVICE |
| `admin:review_report:handle` | SUPER, CUSTOMER_SERVICE |
| `admin:notification:read` | 任何 admin |

---

## 11. 事件驱动通知

后端在 Phase 1-4 已有的服务函数末尾追加 `notify_*` 调用。示例：

```python
# services/order_service.py
async def _transition(...):
    ...
    # 追加：状态变化通知
    if to_status == OrderStatus.PAID:
        await notification_service.notify_merchants_of_shop(
            shop_id=order.shop_id,
            category=NotificationCategory.ORDER,
            title=f"新订单待发货：{order.order_no}",
            body=f"共 {items_count} 件商品，合计 ¥{format_yuan(order.total_cents)}",
            action_url=f"/orders/{order.order_no}",
            related_type="order", related_id=order.id,
        )
```

Backend agent 需扫描 Phase 1-4 关键触发点并小改（切勿破坏原有测试）：

| 服务函数 | 追加事件 |
|---|---|
| `order_service._transition` | pending→paid; paid→shipped; shipped→completed; *→cancelled |
| `aftersales_service` create / approve / reject / *_timeout | 各角色通知 |
| `merchant_application_service.approve` / `reject` | 通知 applicant user |
| `review_service.create` | 通知 shop merchants |
| `review_service.reply_created` | 通知 review.user |
| `review_report_service.uphold` | 通知 review.user "评价已被隐藏" |

**幂等**：这些通知不必 idempotent（每次事件触发都发一条，用户可批删）；但 hook 位置必须在事务提交之后（避免事务回滚但已发通知）。

---

## 12. 种子数据

追加到 `app/scripts/seed.py`：

1. **regions**：从 `regions_data.json` 加载（幂等：ON CONFLICT DO NOTHING）
2. **reviews**：给 Phase 3 completed 订单加 1-2 条示例评价（评分 4-5 星 + 内容 + 匿名标记）；给其中一条加 merchant reply
3. **notifications**：给 seed 用户各插 3-5 条示例通知（含 unread 与 read 混合）
4. **shop 增强字段**：为 shop1 填 logo/banner/announcement 占位（用 seed 图片 key `shop/seed/*.jpg`）

---

## 附录 A：本 Phase 明确不做

- 评价点赞 / 有用度 / 排序
- 客服在线聊天（Phase 5 通知是单向消息，用户不能回复）
- 邮件 / 短信通知（用 logger 打印替代）
- 富文本评价（纯文本 + 图片即可，不做视频）
- 店铺关注 / 收藏
- 促销/优惠券（继续保持不实现）
- WebSocket 实时推送（保留 HTTP 轮询）
- 地区数据管理 UI（数据是常量 seed）

## 附录 B：Phase 6/7 可能依赖的字段

- `shops.rating_avg` / `rating_count`：Phase 7 商品搜索页可用于按店铺评分排序
- `notifications` 表：Phase 6 Android 端可复用同一 API
