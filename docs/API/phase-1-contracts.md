# Phase 1 API 契约 · Auth + RBAC + 商家入驻

> **契约优先**：本文档在实现前定稿，Backend Agent 按此实现 API，Frontend Agents 按此对接。
> 若实现中发现契约不合理，先改本文档再改代码，不可两边默默偏离。
>
> 版本：v1.0 · 生效范围：Phase 1

---

## 目录
1. [统一响应结构](#1-统一响应结构)
2. [错误码约定](#2-错误码约定)
3. [身份域与登录端](#3-身份域与登录端)
4. [数据模型](#4-数据模型)
5. [认证端点](#5-认证端点)
6. [用户资料端点](#6-用户资料端点)
7. [RBAC 与权限清单](#7-rbac-与权限清单)
8. [商家入驻流程](#8-商家入驻流程)
9. [Admin 商家审核端点](#9-admin-商家审核端点)
10. [JWT 规范](#10-jwt-规范)
11. [状态机图](#11-状态机图)
12. [种子数据](#12-种子数据)

---

## 1. 统一响应结构

所有响应遵循此结构（HTTP 状态码同时反映成功/失败）：

```json
{
  "code": 0,
  "message": "ok",
  "data": { /* payload | null */ }
}
```

- `code = 0` 成功；`code > 0` 业务错误，四位数字（见 §2）
- HTTP 2xx 时 `code=0`；HTTP 4xx/5xx 时 `code>0`
- 分页数据 `data` 结构：
  ```json
  {
    "items": [...],
    "total": 123,
    "page": 1,
    "size": 20
  }
  ```

前端 `ApiResponse<T>` TypeScript 类型：
```ts
type ApiResponse<T> = { code: 0; message: string; data: T }
                    | { code: number; message: string; data: null };
```

---

## 2. 错误码约定

四位数字。第 1 位=业务大类，后 3 位=细分。

| 段 | 用途 |
|---|---|
| **0000** | 成功 |
| **1xxx** | 认证 & 会话（1001 未登录 / 1002 token 过期 / 1003 密码错误 / 1004 账号被禁用 / 1005 refresh 无效 / 1010 验证码错误 / 1020 权限不足）|
| **2xxx** | 用户资料相关（2001 用户不存在 / 2002 手机号已注册 / 2003 邮箱已注册 / 2010 旧密码错误）|
| **3xxx** | 商家 & 入驻（3001 已提交过入驻申请且未处理完 / 3002 用户已是商家 / 3003 申请不存在 / 3004 申请状态不允许当前操作 / 3010 商家账号被冻结）|
| **4xxx** | Admin 域（4001 admin 不存在 / 4020 admin 权限不足）|
| **5xxx** | 通用校验错误（5001 参数校验失败 / 5002 资源不存在 / 5003 请求过频）|
| **9xxx** | 服务端错误（9000 内部错误）|

`ValidationError`（Pydantic 校验失败）统一返回 5001，`data.errors` 里放字段级信息。

---

## 3. 身份域与登录端

三个**完全独立**的身份域，各自登录、各自 JWT。设计考量：真实电商 (JD) 用户账号与商家账号是分开的。

| 身份域 | 登录端点前缀 | JWT `aud` claim | 说明 |
|---|---|---|---|
| **User**（消费者） | `/api/v1/user/auth/*` | `user` | 通过手机号/邮箱注册；默认所有人 |
| **Merchant**（商家账号） | `/api/v1/merchant/auth/*` | `merchant` | 由用户提交入驻申请、Admin 审批后系统自动创建 |
| **Admin**（平台管理员） | `/api/v1/admin/auth/*` | `admin` | 由 CLI 种子/其他 Admin 创建；本 Phase 只做 SUPER_ADMIN CLI 种子 + 现有 Admin 手工创建其他 Admin（简化：直接 seed 4 类各 1 个） |

**多身份账户**：一个自然人 (User) 若被批准入驻，会创建一个新的 MerchantAccount（可复用同一邮箱/手机号但独立的密码）。同一自然人可以既是 User 又是 Merchant，登录时用不同端点。

---

## 4. 数据模型

### 4.1 用户 User

```
users
├─ id                BIGINT  PK
├─ phone             VARCHAR(20) UNIQUE NULLABLE   -- 至少手机/邮箱二选一
├─ email             VARCHAR(120) UNIQUE NULLABLE
├─ password_hash     VARCHAR(255) NOT NULL         -- bcrypt
├─ nickname          VARCHAR(60) NOT NULL          -- 昵称，默认 "用户{id 后 6 位}"
├─ avatar_url        VARCHAR(255) NULLABLE
├─ status            ENUM('active','disabled')  DEFAULT 'active'
├─ last_login_at     TIMESTAMPTZ NULLABLE
├─ created_at        TIMESTAMPTZ NOT NULL
├─ updated_at        TIMESTAMPTZ NOT NULL
└─ deleted_at        TIMESTAMPTZ NULLABLE
```

**CHECK 约束**：`(phone IS NOT NULL) OR (email IS NOT NULL)`。

### 4.2 商家账号 MerchantAccount

```
merchant_accounts
├─ id                BIGINT  PK
├─ user_id           BIGINT  FK → users(id) NOT NULL  -- 由哪个自然人所有
├─ login_name        VARCHAR(60) UNIQUE NOT NULL       -- 商家登录名（区别于用户手机/邮箱）
├─ password_hash     VARCHAR(255) NOT NULL
├─ shop_id           BIGINT  FK → shops(id) NOT NULL   -- 一对一：每个商家账号绑定一家店铺（Phase 1 简化）
├─ role              ENUM('SHOP_OWNER','SHOP_OPERATOR','SHOP_SUPPORT') NOT NULL
├─ status            ENUM('active','frozen') DEFAULT 'active'
├─ last_login_at     TIMESTAMPTZ NULLABLE
├─ created_at, updated_at, deleted_at
UNIQUE (user_id, shop_id)   -- 同一用户在同一店铺只能有一个账号
```

### 4.3 店铺 Shop

```
shops
├─ id                BIGINT  PK
├─ name              VARCHAR(120) UNIQUE NOT NULL
├─ description       TEXT NULLABLE
├─ contact_name      VARCHAR(60) NOT NULL
├─ contact_phone     VARCHAR(20) NOT NULL
├─ status            ENUM('active','frozen') DEFAULT 'active'
├─ created_at, updated_at, deleted_at
```

Phase 1 简化：审批通过时才创建 Shop，且每个 Shop 只有一个 SHOP_OWNER。商品/库存到 Phase 2 再做。

### 4.4 商家入驻申请 MerchantApplication

```
merchant_applications
├─ id                BIGINT  PK
├─ applicant_user_id BIGINT  FK → users(id) NOT NULL
├─ shop_name         VARCHAR(120) NOT NULL
├─ contact_name      VARCHAR(60)  NOT NULL
├─ contact_phone     VARCHAR(20)  NOT NULL
├─ business_license_no  VARCHAR(50) NOT NULL        -- 营业执照号（Phase 1 不做上传图片，只存号码）
├─ business_license_url VARCHAR(255) NULLABLE       -- 预留字段
├─ description       TEXT NULLABLE                  -- 申请说明
├─ status            ENUM('pending','approved','rejected','withdrawn') DEFAULT 'pending'
├─ reviewer_admin_id BIGINT FK → admin_users(id) NULLABLE
├─ review_note       TEXT NULLABLE                  -- 拒绝时必填
├─ reviewed_at       TIMESTAMPTZ NULLABLE
├─ approved_merchant_account_id BIGINT FK → merchant_accounts(id) NULLABLE  -- 批准后回填
├─ created_at, updated_at
```

**业务约束**：同一 user 同时只能有 1 条状态 `pending` 的申请（应用层校验，或 partial UNIQUE index）。

### 4.5 管理员 AdminUser

```
admin_users
├─ id                BIGINT  PK
├─ username          VARCHAR(60) UNIQUE NOT NULL
├─ password_hash     VARCHAR(255) NOT NULL
├─ display_name      VARCHAR(60) NOT NULL
├─ role              ENUM('SUPER_ADMIN','BUSINESS_ADMIN','CUSTOMER_SERVICE_ADMIN','TECH_ADMIN') NOT NULL
├─ status            ENUM('active','disabled') DEFAULT 'active'
├─ last_login_at     TIMESTAMPTZ NULLABLE
├─ created_at, updated_at, deleted_at
```

Phase 1 简化：Admin 角色 = 单一 role 字段 + 硬编码权限矩阵（见 §7）。不做多角色多权限组合表。

### 4.6 Refresh Token（可选，若用 opaque token）

若 refresh token 用 opaque 随机串（本项目选此方案）：

```
refresh_tokens
├─ id                BIGINT  PK
├─ token_hash        VARCHAR(64) UNIQUE NOT NULL   -- 存 SHA256 哈希，不存明文
├─ subject_type      ENUM('user','merchant','admin') NOT NULL
├─ subject_id        BIGINT NOT NULL
├─ issued_at         TIMESTAMPTZ NOT NULL
├─ expires_at        TIMESTAMPTZ NOT NULL          -- 默认 30 天
├─ revoked_at        TIMESTAMPTZ NULLABLE          -- 登出/rotate 时置位
├─ user_agent        VARCHAR(255) NULLABLE
├─ ip                INET NULLABLE
INDEX (subject_type, subject_id)
```

---

## 5. 认证端点

### 5.1 User 域

#### `POST /api/v1/user/auth/register`

**请求**：
```json
{
  "phone": "13800001234",   // phone 或 email 至少一个
  "email": null,
  "password": "MyP@ssw0rd",   // 8-64 位，必须含字母和数字
  "nickname": null            // 可选，默认自动生成
}
```
**成功响应**（201）：
```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "user": { "id": 1001, "phone": "13800001234", "email": null, "nickname": "用户001001", "avatar_url": null },
    "access_token": "eyJ...",
    "refresh_token": "opaque-random-64-chars",
    "expires_in": 900
  }
}
```
**错误**：2002/2003 (已注册) · 5001 (校验失败)

#### `POST /api/v1/user/auth/login`

**请求**：
```json
{
  "identifier": "13800001234",   // 手机号或邮箱
  "password": "MyP@ssw0rd"
}
```
**成功响应**（200）：同 register 的 data 结构。

**错误**：1003 (账号或密码错误，故意合并以防枚举) · 1004 (账号禁用)

#### `POST /api/v1/user/auth/refresh`

**请求**：
```json
{ "refresh_token": "opaque..." }
```
**成功响应**：返回新 access + 新 refresh（rotate 策略）。旧 refresh 立即失效。
**错误**：1005

#### `POST /api/v1/user/auth/logout`

**请求头**：`Authorization: Bearer <access>`
**请求 body**（可选）：`{ "refresh_token": "..." }` 若带则 revoke 该 refresh
**成功响应**：`{ "code": 0, "message": "ok", "data": null }`

#### `POST /api/v1/user/auth/forgot-password`（Phase 1 模拟）

**请求**：`{ "identifier": "13800001234" }`
**行为**：生成 6 位验证码，**打印到 backend logger.info**（模拟短信/邮件），TTL 5 分钟存 Redis key `pwreset:user:<identifier>`。
**响应**：`{ "code": 0, "message": "验证码已发送", "data": null }`（无论账号是否存在，防止枚举）

#### `POST /api/v1/user/auth/reset-password`

**请求**：
```json
{ "identifier": "13800001234", "code": "123456", "new_password": "NewP@ss1" }
```
**行为**：校验 Redis code，通过则更新密码 + revoke 该用户所有 refresh。
**错误**：1010 (验证码错误/过期) · 5001

### 5.2 Merchant 域

**登录：`POST /api/v1/merchant/auth/login`**
```json
{ "login_name": "shop_owner_001", "password": "..." }
```
**注册**：**无公开注册**，账号由 Admin 审批入驻申请后系统自动创建。

**refresh/logout** 端点结构同 user 域，路径改为 `/api/v1/merchant/auth/*`。

**修改密码 `POST /api/v1/merchant/auth/change-password`**（已登录）
```json
{ "old_password": "...", "new_password": "..." }
```

### 5.3 Admin 域

**登录：`POST /api/v1/admin/auth/login`**
```json
{ "username": "super", "password": "..." }
```
**注册**：无公开注册。Phase 1 用 seed 脚本创建 4 个 admin（每个 role 一个）。

结构同 merchant 域。

---

## 6. 用户资料端点

### 6.1 User

- `GET /api/v1/user/me` — 返回当前用户 profile + 是否已是 merchant + 待处理的入驻申请
  ```json
  {
    "user": { ... },
    "merchant_account_ids": [12],
    "pending_application_id": null
  }
  ```
- `PATCH /api/v1/user/me` — 允许更新 `nickname`, `avatar_url`
- `POST /api/v1/user/me/change-password` — `{ old_password, new_password }`

### 6.2 Merchant

- `GET /api/v1/merchant/me` — 返回 merchant account + shop info
- `PATCH /api/v1/merchant/me/shop` — 更新店铺 description/contact（Phase 1 允许 SHOP_OWNER 改）

### 6.3 Admin

- `GET /api/v1/admin/me` — 返回 admin + role + 权限清单

---

## 7. RBAC 与权限清单

### 7.1 权限命名

`{scope}:{resource}[:{sub}]:{action}`
- scope: `user` / `merchant` / `admin`
- 例：`admin:merchant_application:review`, `merchant:shop:update`

### 7.2 Phase 1 权限清单

| 权限键 | 说明 | 分配给 |
|---|---|---|
| `user:self:read` | 查看自己资料 | 任何 user |
| `user:self:update` | 修改自己资料 | 任何 user |
| `user:merchant_application:submit` | 提交入驻申请 | 任何 user（未在处理中） |
| `user:merchant_application:withdraw` | 撤回自己的入驻申请 | 申请人本人 |
| `user:merchant_application:read` | 查看自己的入驻申请 | 申请人本人 |
| `merchant:self:read` | 查看商家账号 | 任何 merchant |
| `merchant:shop:update` | 更新店铺基本信息 | SHOP_OWNER |
| `admin:self:read` | 查看 admin 自己 | 任何 admin |
| `admin:merchant_application:read` | 查看入驻申请列表/详情 | BUSINESS_ADMIN, SUPER_ADMIN |
| `admin:merchant_application:review` | 审批入驻申请（approve/reject） | BUSINESS_ADMIN, SUPER_ADMIN |
| `admin:audit_log:read` | 查看审计日志（Phase 1 只记录不做 UI） | TECH_ADMIN, SUPER_ADMIN |

### 7.3 后端实现建议

```python
# app/core/rbac.py
class Permission(str, Enum):
    USER_SELF_READ = "user:self:read"
    ADMIN_MERCHANT_APPLICATION_REVIEW = "admin:merchant_application:review"
    ...

ROLE_PERMISSIONS: dict[AdminRole, set[Permission]] = {
    AdminRole.SUPER_ADMIN: {p for p in Permission},   # 全权
    AdminRole.BUSINESS_ADMIN: {
        Permission.ADMIN_SELF_READ,
        Permission.ADMIN_MERCHANT_APPLICATION_READ,
        Permission.ADMIN_MERCHANT_APPLICATION_REVIEW,
    },
    ...
}

# FastAPI dependency
def require_permission(perm: Permission):
    async def _dep(current=Depends(get_current_principal)):
        if perm not in current.permissions:
            raise HTTPException(403, "1020: 权限不足")
        return current
    return _dep
```

---

## 8. 商家入驻流程

### 8.1 状态机

```
[apply]
   │
   ▼
pending ──(admin approve)──> approved  (系统创建 MerchantAccount + Shop)
   │                              │
   │──(admin reject +note)──> rejected
   │
   │──(applicant withdraw)──> withdrawn
```

**规则**：
- 用户提交时若已有 pending 申请 → 3001
- 用户已经有 approved 记录（即已是 merchant） → 3002
- withdrawn/rejected 后可以重新提交
- reject 必须带 review_note
- approved 后系统同时：
  1. 创建 Shop 记录（name 来自申请）
  2. 创建 MerchantAccount：`login_name` 用 `applicant_user_id + shop_id` 生成规则 `shop{shop_id}_owner`；`password` 系统生成 12 位随机，**打印到 logger.info**（模拟短信通知，Phase 1 不发短信）
  3. 将 `approved_merchant_account_id` 回填到申请

### 8.2 User 端点（申请方）

#### `POST /api/v1/user/merchant-applications`
提交入驻申请。请求：
```json
{
  "shop_name": "小李杂货铺",
  "contact_name": "李明",
  "contact_phone": "13900002222",
  "business_license_no": "91330100MA...",
  "description": "主营家居日用品"
}
```
成功：返回申请记录（含 status=pending）。错误：3001/3002/5001。

#### `GET /api/v1/user/merchant-applications`
分页返回当前用户的申请历史（按 created_at desc）。

#### `GET /api/v1/user/merchant-applications/{id}`
返回详情。仅本人可查。

#### `POST /api/v1/user/merchant-applications/{id}/withdraw`
撤回。仅在 status=pending 时允许。错误：3004。

---

## 9. Admin 商家审核端点

#### `GET /api/v1/admin/merchant-applications`
查询参数：`status=pending`, `page`, `size`, `keyword`(匹配 shop_name/联系人)
返回分页列表。**权限**：`admin:merchant_application:read`

#### `GET /api/v1/admin/merchant-applications/{id}`
详情。

#### `POST /api/v1/admin/merchant-applications/{id}/approve`
请求：`{ "review_note": "资质齐全" }` (可选)
行为：状态→approved；同时创建 Shop + MerchantAccount，回填 approved_merchant_account_id；返回创建的 MerchantAccount（含系统生成密码，前端展示给管理员抄送申请人 — Phase 1 简化）。
**权限**：`admin:merchant_application:review`
错误：3003/3004（状态非 pending）

#### `POST /api/v1/admin/merchant-applications/{id}/reject`
请求：`{ "review_note": "营业执照信息不匹配" }` (必填，长度 5-500)
行为：状态→rejected。
错误：3003/3004/5001

---

## 10. JWT 规范

- Access Token: JWT (HS256)，TTL = 15 分钟
- Refresh Token: opaque 64-char 随机串，TTL = 30 天，存 refresh_tokens 表（哈希）
- JWT payload:
  ```json
  {
    "sub": "1001",              // 主体 ID
    "aud": "user",              // user / merchant / admin
    "role": "SHOP_OWNER",       // 仅 merchant/admin 有
    "iat": 1721648000,
    "exp": 1721648900
  }
  ```
- Header: `Authorization: Bearer <access_token>`
- 前端拿到 401 且响应 code=1002 → 自动用 refresh 换 access；若 refresh 也失效 → 跳登录

---

## 11. 状态机图

见 §8.1 商家入驻状态机。

用户账号 / 商家账号 / Admin 状态相对简单：`active <-> disabled/frozen`（Phase 1 只允许 SUPER_ADMIN 通过 SQL 手工切换，无 UI）。

---

## 12. 种子数据

Backend 提供 CLI 脚本 `backend/scripts/seed.py`（或作为 alembic data migration），一键插入：

- 4 个 admin_users（每个 role 一个）
  - `super` / `super_pwd_change_me` (SUPER_ADMIN)
  - `biz01` / `biz_pwd_change_me` (BUSINESS_ADMIN)
  - `cs01` / `cs_pwd_change_me` (CUSTOMER_SERVICE_ADMIN)
  - `tech01` / `tech_pwd_change_me` (TECH_ADMIN)
- 2 个测试 user
  - phone `13800000001` / password `Test1234` (nickname 老李)
  - phone `13800000002` / password `Test1234` (nickname 老王)

启动方式：`uv run python -m app.scripts.seed`。**只在 ENVIRONMENT != production 时允许运行。**

---

## 附录 A：约定与限制

- 所有列表接口默认分页 `size=20`, `max size=100`
- 手机号仅支持中国大陆 11 位；国际化留待后续
- 密码策略：8-64 位，至少 1 个字母 + 1 个数字（Phase 1 不强制特殊字符）
- 全部 timestamp 存 UTC（`TIMESTAMPTZ`），前端展示按本地时区
- 所有 mutating 端点（POST/PATCH/DELETE）需要 `Idempotency-Key` header 时应能识别（Phase 1 后端只在关键端点如 approve/reject 存 5 分钟）

## 附录 B：本 Phase 明确不做

- 手机短信/邮件真实发送（用 logger 打印替代）
- 图片上传（营业执照只存字段号）
- 多商家账号（一个商家目前一个 owner，Phase 后续再加 operator/support）
- Admin 邀请 Admin（4 个 admin 用 seed）
- 审计日志 UI（后端记入 audit_log 表，无 UI）
- 图形验证码 / 频控 / 风控
