# UI Polish Notes · Phase 7 · 三端一致性

> 版本：v1.0 · 分支：feature/phase-7-polish · 生效范围：三前端 UI/UX 打磨
>
> 依据：`docs/PHASE_7_SCOPE.md` §5 · `AGENTS.md` §11.2 / §11.5

Phase 7 的三端 UI 打磨不引入任何新业务功能，仅对齐 **Toast / EmptyState / Skeleton / ErrorScreen / Modal / Form** 的样式与无障碍属性，并将破坏性操作统一走 `--color-danger`。

本文档记录：
1. 三端做了哪些统一（对齐）
2. 保留的差异（三端主色刻意分离）
3. 已知未处理的问题（供后续 Phase 参考）

---

## 1. 三端统一项

### 1.1 Toast

| 项目 | 之前 | 现在（三端一致） |
|---|---|---|
| 位置 | user-web/merchant 顶部居中；admin 右上 | **右上角固定**（`fixed top-4 right-4`）|
| 错误色 | user-web 主色红；merchant `bg-red-600`；admin `bg-red-50/text-red-800` | 全部 `bg-red-600 text-white` |
| 成功色 | user-web `bg-green-50`；merchant `bg-emerald-600`；admin `bg-green-50` | 全部 `bg-green-600 text-white` |
| 警告色 | merchant `bg-amber-500`；admin `bg-amber-50` | 全部 `bg-amber-600 text-white` |
| 信息色 | 各不同 | 全部 `bg-sky-600 text-white` |
| 动画 | 无 | **300ms 淡入**（`animate-[fade-in_300ms_ease-out]`）|
| ARIA | error 用 `role="alert"`，其他 `role="status"` | 保留；额外 error 显式 `aria-live="assertive"`，其他 `aria-live="polite"` |
| 关闭 API | 各端不同 | 保留各端历史 API（`toast.success/error/warning/info` + `dismiss`）|

**关联文件**：
- `frontend-user-web/src/components/ui/Toast.tsx`
- `frontend-merchant/src/components/ui/Toast.tsx`
- `frontend-admin/src/components/ui/Toast.tsx`

### 1.2 EmptyState

- user-web 已有 `EmptyState`（title + description + action + icon）。
- Phase 7 补齐：
  - `frontend-merchant/src/components/ui/EmptyState.tsx`（新增）
  - `frontend-admin/src/components/ui/EmptyState.tsx`（新增）
- 三端字号 / 间距略作差异化（用户端 py-14，商家 py-12，管理端 py-10 追求信息密度），但视觉基调一致：**虚线边框卡片 + 图标 + 主文案 + 副文案 + CTA**。

已改造为使用 `EmptyState` 的页面：
- `frontend-merchant/src/app/(dashboard)/orders/page.tsx`
- `frontend-merchant/src/app/(dashboard)/products/page.tsx`
- `frontend-merchant/src/app/(dashboard)/aftersales/page.tsx`

### 1.3 Skeleton

已经三端一致：`animate-pulse bg-neutral-200/70 rounded-*`。**未改动**。

### 1.4 ErrorScreen

三端此前均无独立组件，各页面手写。Phase 7 新增：
- `frontend-user-web/src/components/ui/ErrorScreen.tsx`（新增）
- `frontend-merchant/src/components/ui/ErrorScreen.tsx`（新增）
- `frontend-admin/src/components/ui/ErrorScreen.tsx`（新增）

统一形态：**⚠️ 图标 + 主文案（"加载失败"）+ 副文案 + "重试" 主按钮**。可接 `onRetry` 回调触发 refetch。

已改造为 `ErrorScreen` 的页面（user-web / merchant 各 3 处）：
- `frontend-user-web/src/app/cart/page.tsx`
- `frontend-user-web/src/app/orders/page.tsx`
- `frontend-user-web/src/app/aftersales/page.tsx`
- `frontend-merchant/src/app/(dashboard)/orders/page.tsx`
- `frontend-merchant/src/app/(dashboard)/products/page.tsx`
- `frontend-merchant/src/app/(dashboard)/aftersales/page.tsx`

### 1.5 Modal 焦点管理

三端 `Modal.tsx` 均补齐（Phase 7 §5.1）：
- 打开时 **focus 首个可交互元素**（fallback 到 dialog 容器）
- **Escape 关闭**（已有，保留）
- **点击遮罩关闭**（可选；破坏性操作可设 `dismissOnBackdrop=false` / `closeOnOverlay=false`）
- **Focus trap**：Tab / Shift+Tab 循环在 Modal 内（原生实现，不引入依赖）
- **关闭时归还焦点**给触发元素（`prevActive?.focus()`）
- **body 禁滚动**（已有）
- **300ms 淡入动画**（`animate-[fade-in_300ms_ease-out]`）

关联文件：
- `frontend-user-web/src/components/ui/Modal.tsx`
- `frontend-merchant/src/components/ui/Modal.tsx`
- `frontend-admin/src/components/ui/Modal.tsx`

### 1.6 表单可访问性

- **label 与 input 用 `htmlFor` 关联**：三端 `FormField` 组件已使用（保留）。
- **必填字段** `<span aria-hidden>*</span>` 视觉红星 + `aria-required="true"`：
  - user-web `Input.tsx` / merchant `Input.tsx` / admin `Input.tsx` 现在会根据 `rest.required` 自动带上 `aria-required`。
  - user-web `Input.tsx` label 加了红色 `*` 视觉标记。
- **错误信息 `role="alert" + aria-live="polite"`**：三端 `FormField` / `Input` 已带（新增 `aria-live` 到 merchant/admin FormField）。
- **主按钮 loading 状态**：三端 `Button.tsx` 都已 `loading=true` 时 `disabled=true + aria-busy=true + spinner`（保留）。

已抽查通过的关键 form（对齐规范）：
- user-web：登录 / 注册 / 结算 / 售后申请（补 `aria-required`/`aria-live` 到 textarea）
- merchant：登录 / 商品新建向导 / 售后处理（FormField 内建）
- admin：登录 / 商家审批 / 售后仲裁（FormField 内建）

### 1.7 主色 / 状态色变量

三端 `globals.css` 的 `@theme` 块补齐：

| 变量 | user-web | merchant | admin | 用途 |
|---|---|---|---|---|
| `--color-primary` | `#d0211a` (JD 红) | `#1a56db` (商家蓝) | `#0f172a` (管理深灰) | 主 CTA |
| `--color-danger` | `#dc2626` **（新增）** | `#dc2626` | `#dc2626` | 破坏性操作（取消 / 删除 / 强制退款）|
| `--color-danger-soft` | `#fee2e2` **（新增）** | `#fee2e2` **（新增）** | `#fee2e2` | Toast/Alert 底色 |
| `--color-success` | `#16a34a` **（新增）** | `#16a34a` | `#16a34a` | 成功 |
| `--color-warning` | `#d97706` **（新增）** | `#d97706` | `#d97706` | 警告 |
| `--color-info` | `#0284c7` **（新增）** | `#0284c7` **（新增）** | `#2563eb` | 提示 |

同时 user-web `Button.tsx` 新增 `variant="danger"` 走 `--color-danger`，`ConfirmModal` 的 `danger=true` 现在会正确渲染红色按钮（之前是 bug，两个分支都是 `primary`）。

### 1.8 淡入动画（`@keyframes fade-in`）

三端 `globals.css` 都追加了：

```css
@keyframes fade-in {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

Tailwind v4 通过 `--animate-fade-in` theme 变量导出，Toast / Modal 通过 `animate-[fade-in_300ms_ease-out]` 使用。

---

## 2. 刻意保留的差异

Phase 7 §5.4 明确「三端主色沿用（user #D0211A / merchant #1a56db / admin #0f172a）」。设计意图：
- **user-web · JD 红**：面向 C 端消费者，唤起购物欲。
- **merchant · 蓝**：商务感、专业、去除电商促销色。
- **admin · 深灰蓝**：管理端严肃、克制、信息密度高，破坏性操作再叠加 `--color-danger`。

因此以下差异**不做统一**：
- Button 主色（三端 primary 是各自品牌色）
- Sidebar 高亮色（各端不同）
- Toast 之外的 status badge 配色（各端沿用自有 palette）
- 字号：admin 全局 14px（信息密度）；user-web / merchant 沿用 Tailwind 默认（15/16px）
- FormField label 字号：user-web / merchant 用 `text-sm`（14px），admin 用 `text-xs`（12px）

---

## 3. 已知未处理项（供后续 Phase 参考）

Phase 7 打磨范围内**不改**业务逻辑，以下问题保留：

1. **移动响应式**：Phase 7 明确桌面 1280+，未做移动端。移动端由 Android 承担。窄屏虽不横向溢出但布局未优化。
2. **Toast 手动关闭动画**：仅淡入，无淡出（dismiss 直接 unmount）；影响不大，保留。
3. **Modal Focus Trap 边界 case**：如果 Modal 内动态插入 focusable 元素（如 `EvidenceUploader` 异步渲染），首次 Tab 可能跳过。测试未覆盖此场景，实际使用暂未发现问题。
4. **表单 aria-required 抽查覆盖**：仅关键 form 全量覆盖（登录/注册/结算/售后申请）。次要表单（如收货地址编辑、SKU 编辑）仍靠 `FormField.required` 视觉星号，`Input` 收到 native `required` 后会自动带 aria；但如果调用方没显式传 `required` 到 Input（只在 FormField 上写 `required`），aria-required 不会加。建议后续统一 API：`FormField required` 自动透传到子 Input（需改 render prop 契约，Phase 8 再做）。
5. **XSS/DOMPurify**：`dangerouslySetInnerHTML` 在商品详情描述里的使用（Phase 2 已知偏差）— Phase 7 §6 由 Security agent 处理，不属 UI 打磨范围。
6. **Toast 多条堆叠动画**：连续 push 时的排列过渡未做 stagger 动画，直接 append。日常场景足够。
7. **ConfirmModal 视觉一致**：user-web 有 `ConfirmModal.tsx`；merchant / admin 沿用 `Modal.tsx + footer` 直接组合，未抽象 `ConfirmModal`。用法一致性可，但可复用性差；后续可考虑三端同抽象。
8. **管理端 Table 空态**：`Table.tsx` 组件内的 `emptyText` 只是一行灰字；未接入新的 `EmptyState` 组件。改动会影响所有管理端列表，作为独立小任务留到 Phase 8。

---

## 4. 契约偏差点

无。所有改动均在 §5 规范内，不涉及 API 契约或跨 agent 依赖。

---

## 5. 交付摘要

| 项目 | 用户端 | 商家端 | 管理端 |
|---|---|---|---|
| Toast 组件对齐 | ✅ 改（顶部→右上，色系统一）| ✅ 改（色系统一）| ✅ 改（色系统一）|
| EmptyState | ✅ 已有，改 3 处使用 | ✅ **新增** + 3 处使用 | ✅ **新增**（未推广，见 §3 第 8 条）|
| Skeleton | ✅ 已一致 | ✅ 已一致 | ✅ 已一致 |
| ErrorScreen | ✅ **新增** + 3 处使用 | ✅ **新增** + 3 处使用 | ✅ **新增**（未推广）|
| Modal 焦点管理 | ✅ 加 focus trap + first-focus + 归还 | ✅ 同上 | ✅ 同上（原已有部分）|
| 表单 accessibility | ✅ Input `aria-required` + 抽查 textarea | ✅ FormField `role="alert" + aria-live"` | ✅ FormField `aria-live` |
| CSS 变量补齐 | ✅ `danger / danger-soft / success / warning / info` 全新 | ✅ 补 `danger-soft` | 已完备 |
| 破坏性按钮 danger variant | ✅ `Button variant="danger"` + `ConfirmModal danger=true` 修 bug | 已有 | 已有 |
| Build/typecheck 通过 | ✅ | ✅ | ✅ |
| Tests | ✅ 77/77 通过 | ✅ 51/51 通过 | ✅ 58/58 通过 |

---

**Phase 7 · UI Polish Agent 交付完成。**
