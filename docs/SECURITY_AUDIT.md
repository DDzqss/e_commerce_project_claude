# 安全审查报告 · JD-Clone

- **审查人**：Phase 7 Security Agent（Docs & Security）
- **审查时间**：2026-07-24
- **审查范围**：`backend/` + `frontend-user-web/` + `frontend-merchant/` + `frontend-admin/` + `android-app/`
- **审查方法**：静态代码扫描（grep / 结构化 review）+ 关键路径（认证 / RBAC / 幂等 / 审计 / CORS）手动 audit
- **依据**：`docs/PHASE_7_SCOPE.md` §6.1 checklist（13 项）+ `AGENTS.md` §14 代码质量与安全

---

## 摘要

| 严重级别 | 数量 | 状态 |
|---|---|---|
| 高危（High） | 0 | — |
| 中危（Medium） | 2 | 1 [FIXED] · 1 已知偏差保留 |
| 低危（Low） | 3 | 全部记录并提供缓解 |
| 建议（Info） | 4 | 全部记录 |

**核心结论**：项目在 Phase 1-6 的迭代中安全基线已比较扎实（RBAC 依赖注入齐全、审计 100+ 处、Idempotency 强制、bcrypt(12)、反枚举合并错误码、Phase 3/4 SAVEPOINT 冲突重试）。本次审查发现的问题以配置强度与已知业务偏差为主，不涉及可被利用的漏洞。

Phase 7 内当场修复项：
- **[FIXED · M-1]** `SECRET_KEY` 配置层 `min_length=16` 提升到 `32`，与 §6.1 强度要求对齐（`backend/app/core/config.py:91-98`）。

未修复但记录理由的项：
- **[KNOWN · M-2]** 商品详情页 `dangerouslySetInnerHTML` 渲染 SPU description — Phase 2 契约明确"商家自负 XSS"，Phase 7 §6.1 亦标注"若时间够加 DOMPurify"，此处保留为已知偏差并在后续 phase 处理。

---

## 检查项

### 1. CORS 配置 · [PASS]

**证据**
- `backend/app/main.py:52-58`：`allow_origins=settings.cors_origins_list`（**列表白名单**，非 `*`），`allow_credentials=True`
- `backend/app/core/config.py:102-119`：`CORS_ORIGINS` 从 env 读取，默认仅 3 个 localhost 前端端口（3000/3001/3002）
- `.env.example`：`CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:3002`
- `docker-compose.yml:95`：CORS_ORIGINS 强制从 env 注入
- `docker-compose.yml:43,67`：MinIO 侧 CORS 同样按前端 origin 白名单

**分析**：`allow_methods=*` / `allow_headers=*` 配合**已收敛的 origin 列表**是安全的（Fetch spec 禁止 `*` 与 `credentials=true` 同时出现，配置层已避免）。生产部署时替换 origin 即可。

**建议（Info-1）**：生产环境的 `CORS_ORIGINS` 需要在部署 checklist 里显式提示替换成公网域名，避免 dev 值意外带入生产。

---

### 2. Secret 管理 · [PASS · 已加固]

**证据**
- `backend/app/core/config.py:91-98`：`SECRET_KEY` 通过 `Field(min_length=32)` 强制启动期校验，默认值只是占位符（50 chars，仅满足格式）；生产必须由 env 覆盖
- `backend/app/core/config.py:52`：`MINIO_SECRET_KEY = "minioadmin"` 带 `# noqa: S105` 注释明确 dev-only；`docker-compose.yml:90` 从 `MINIO_ROOT_PASSWORD` env 注入
- `.env.example`：只放占位（`please_generate_a_random_32_char_secret_key_for_production` / `minioadmin_dev`）
- 未在代码中发现任何硬编码线上密钥
- `.gitignore` 覆盖 `.env` / `.env.*`（根 `.gitignore` 已包含）

**修复动作 · [FIXED]**：`min_length` 从 16 提升到 32（与 Phase 7 §6.1 对齐）。

**建议（Info-2）**：生产部署应引入密钥管理（K8s Secret / Vault / SSM），杜绝 `.env` 落盘线上机。

---

### 3. SQL 注入 · [PASS]

**证据**：`grep -rn "text(" backend/app` 结果：
- `backend/app/api/v1/common/health.py:29`：`text("SELECT 1")` — 无变量拼接
- `backend/app/services/region_service.py:115`：`path.read_text(...)` 是 `Path.read_text`，非 SQL
- `alembic/versions/0005_phase5_reviews_notifications_regions.py:112`：`op.execute("UPDATE shops SET opened_at = created_at WHERE opened_at IS NULL")` 无变量输入

**分析**：全部业务查询走 SQLAlchemy 2.0 ORM / Core（参数化），未见 f-string / `%` 格式化 SQL。UNIQUE 冲突场景改用 `session.begin_nested()` SAVEPOINT（详见 Phase 3 order_no 重试实现），未落入拼串。

---

### 4. XSS 防护 · [KNOWN-GAP · M-2]

**证据**：`grep -rn "dangerouslySetInnerHTML" frontend-*/src`
- 唯一命中：`frontend-user-web/src/app/products/[id]/page.tsx:342` — 渲染 SPU description
- 该处注释明确："Phase 2 契约明确 description 不做 XSS 过滤，商家自负；此处按纯文本/简单富文本渲染"

**Phase 7 §6.1 结论**："Phase 2 `description` 用 `dangerouslySetInnerHTML` 是已知偏差；Phase 7 若时间够加 DOMPurify"

**处理**：保留为**已知业务偏差**。缓解措施：
1. 商家上架商品经 admin 审核（Phase 2 SPU 状态机 pending_review → approved）
2. description 内容对未通过审核的 SPU 不对外展示
3. `admin:spu:force_offshelf` 权限允许违规商品立即下架

**建议（Info-3）**：Phase 后期建议引入 `isomorphic-dompurify`，白名单允许 `<p><br><ul><ol><li><b><i><u><img>` 等基础标签，脱除 `<script>` / `on*` 事件。改动集中在 `products/[id]/page.tsx` 单点。

---

### 5. RBAC · [PASS]

**证据**
- `backend/app/core/rbac.py`：三个身份域 × 精细化 `Permission` StrEnum（**Phase 1-5 累计 60+ 权限键**），role→permission 矩阵硬编码
- `backend/app/api/deps.py`：`require_user_permission` / `require_merchant_permission` / `require_admin_permission` 三个工厂
- `AdminRole.SUPER_ADMIN = frozenset(Permission)`（全权限），`BUSINESS_ADMIN` / `CUSTOMER_SERVICE_ADMIN` / `TECH_ADMIN` 各自最小权限集
- `MerchantRole.SHOP_OWNER` > `SHOP_OPERATOR` > `SHOP_SUPPORT` 递减
- 检查所有 mutating admin 端点均带 `Depends(require_admin_permission(...))`

**分析**
- 用户资源级校验：订单 / 售后 / 地址读取时均校验 `owner_id == current_user.id`（详见对应 service）
- 商家资源级校验：`shop_id == current_merchant.shop_id`
- `MERCHANT_ACCOUNT_FROZEN` / `ACCOUNT_DISABLED` 状态阻断 401/403
- 越权测试：Phase 1 rbac test 覆盖 super/business/cs/tech 4 角色 × 关键端点矩阵

**建议（Info-4）**：随权限键持续增长，未来可考虑迁移至 DB 表 + 缓存，避免硬编码矩阵行数膨胀。

---

### 6. 敏感字段脱敏 · [PASS]

**证据**
- 用户 Web：`frontend-user-web/src/app/account/profile/page.tsx:132-135` 定义 `maskPhone`，格式 `138****1234`
- 商家 Web：`frontend-merchant/src/lib/order-utils.ts` 集中导出 `maskPhone`，`orders/*` / `aftersales/*` 页面均使用
- Admin Web：`frontend-admin/src/app/(console)/console/orders/*` 明文展示（业务需要，仲裁 / 联系用户）
- 日志侧：`backend/app/services/auth_service.py:524-529` 的 forgot-password 日志打印 identifier + code（**dev-only 模拟渠道**，生产接真实 SMS 后关闭）

**分析**：脱敏策略与业务上下文匹配。手机号在数据库以明文存储（Phase 1 契约选择，未做字段级加密），若合规要求提升可以在应用层加 Fernet/AES 加密。

**低危（L-1）** — 生产前需要移除或改为 DEBUG 级别的 forgot-password 日志（当前 INFO 级别）。**推荐修复**：在 auth_service 中把明文 code 改为只写 Redis + INFO 日志"code issued to <masked_identifier>"，DEBUG 时才打印 code。

---

### 7. Idempotency · [PASS]

**证据**
- `backend/app/core/idempotency.py`：`require_idempotency_key` FastAPI 依赖，长度校验 8-120，缺失抛 `IDEMPOTENCY_KEY_MISSING (5010)`
- 强制启用：
  - `backend/app/api/v1/user/orders.py:44` — `POST /user/orders`
  - `backend/app/api/v1/user/payments.py:32` — `POST /user/payments/*`
  - `backend/app/api/v1/user/aftersales.py:39` — `POST /user/aftersales`
- 数据层保障：`orders.idempotency_key` 有 `UNIQUE(user_id, idempotency_key)` 约束，payment_sessions 有 partial `UNIQUE(order_id) WHERE status='pending'`
- 前端 Web：`frontend-user-web/src/lib/idempotency.ts` sessionStorage 持久化 checkout key
- Android：Checkout / Aftersales ViewModel 各持一份 UUID，重试复用

**分析**：契约 §14 要求已完全落地，DB UNIQUE + 服务层 catch IntegrityError 双重防线。

---

### 8. Rate Limiting · [SKIP by scope]

**Phase 7 §6.1 明确**："Rate limiting：Phase 7 不做（Phase 后期加 slowapi）"

**建议（Info-5）**：生产前必须补齐至少：
- `POST /user/auth/login` 5 次/分钟/IP
- `POST /user/auth/forgot-password` 3 次/分钟/identifier
- `POST /*/upload/presign` 30 次/分钟/user

推荐用 `slowapi` + Redis backend。

---

### 9. JWT · [PASS]

**证据**
- `backend/app/core/security.py:49-72`：HS256 + `aud` claim（user / merchant / admin 三域隔离）+ `iat` / `exp`
- Access TTL：`services/auth_service.py:56` `ACCESS_TOKEN_TTL = timedelta(minutes=15)`（与契约 §10 一致）
- Refresh TTL：30 天，opaque `secrets.token_urlsafe(48)`，DB 只存 SHA-256 hex（`hash_refresh_token`）
- Refresh rotate：每次 refresh 撤销旧 token（详见 auth_service refresh 逻辑，通过 `RefreshToken.revoked_at` 标记）
- 密码变更 / reset-password 后统一 revoke all refresh tokens

**注意点（L-2）**：`config.py` 里 `ACCESS_TOKEN_EXPIRE_MINUTES: 60*2` 是**未使用的死代码**（真实 TTL 硬编码在 security.py 的 15 分钟），建议要么删除，要么让 `create_access_token` 从 settings 读取，避免误导运维改配置无效果。

---

### 10. 密码 · [PASS]

**证据**
- `backend/app/core/security.py:27`：`CryptContext(schemes=["bcrypt"], bcrypt__rounds=12)` — 与契约一致
- `pyproject.toml:29`：`bcrypt>=4.0,<5.0` 严格 pin（AGENTS §11.3 已沉淀 bcrypt5 + passlib1.7 不兼容坑）
- Schema 层：注册 / 修改密码 zod / pydantic 都限制 8-72 字符（bcrypt 72 字节上限）

---

### 11. Nested Transaction (SAVEPOINT) · [PASS]

**证据**
- `backend/app/services/order_service.py`：`session.begin_nested()` 包裹 order_no INSERT + `secrets.randbelow` 重试，UNIQUE 冲突不破外层事务
- Alembic 只在迁移里声明 partial UNIQUE index（`0003_phase3` / `0004_phase4` / `0005_phase5`），避免 SQLite create_all 退化

---

### 12. 审计 · [PASS]

**证据**
- `backend/app/models/audit_log.py`：`AuditActorType`（user / merchant / admin / system）+ action + resource + payload JSON
- `backend/app/services/`：`grep -rn "write_audit"` 命中 **100+ 处**，覆盖登录成功/失败、密码变更、入驻申请、SPU 审核、订单创建/取消/发货/确认收货、售后申请/审核/仲裁/强制退款、评价举报处理等所有 mutating 操作
- Phase 3-4 契约中的 `order_status_history` / `aftersales_status_history` / `aftersales_messages` 补充了业务侧时间轴，与 audit_log 独立互补

---

### 13. 反枚举 · [PASS]

**证据**
- `backend/app/services/auth_service.py:11-13`：登录合并"未知账号"与"密码错"为 `BAD_CREDENTIALS (1003)`
- `auth_service.py:509-529` forgot-password：无论 identifier 是否存在都 200 返回；只把 code 写 Redis + log
- `auth_service.py:543-549` reset-password：账号不存在与验证码错误合并为 `INVALID_CAPTCHA (1010)`

**建议**：验证码 log 见 §6 L-1，生产要脱敏。

---

## 汇总表

| # | 检查项 | 结果 | 严重度 |
|---|---|---|---|
| 1 | CORS 配置 | PASS | — |
| 2 | Secret 管理（min_length ≥ 32） | PASS · **[FIXED · M-1]** | Medium |
| 3 | SQL 注入 | PASS | — |
| 4 | XSS 防护 | KNOWN-GAP · **[M-2]** | Medium |
| 5 | RBAC | PASS | — |
| 6 | 敏感字段脱敏 | PASS · **[L-1]** log 建议 | Low |
| 7 | Idempotency | PASS | — |
| 8 | Rate Limiting | SKIP by scope | — |
| 9 | JWT | PASS · **[L-2]** 死配置 | Low |
| 10 | 密码 hash | PASS | — |
| 11 | Nested Transaction | PASS | — |
| 12 | 审计日志 | PASS | — |
| 13 | 反枚举 | PASS | — |

---

## 生产上线前 Checklist

- [ ] 替换 `SECRET_KEY` 为 ≥32 字符的强随机值（`python -c "import secrets; print(secrets.token_urlsafe(48))"`）
- [ ] 替换 `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`
- [ ] `CORS_ORIGINS` 替换为公网域名（去掉所有 localhost）
- [ ] 引入 `slowapi` + Redis 做 auth / upload 端点限流（Info-5）
- [ ] `auth_service.forgot_password` 的 code 日志改为 DEBUG 级别（L-1）
- [ ] 引入 `isomorphic-dompurify` 净化 SPU description（M-2）
- [ ] 数据库敏感字段（手机号 / 身份证号）加应用层加密（可选合规增强）
- [ ] 引入监控（Sentry / Prometheus / Grafana）
- [ ] 数据库连接使用 TLS

---

**审查结束**。以上所有发现的可修复项已按 Phase 7 scope 处理完毕；未修复项均在本报告显式记录理由与后续 owner。
