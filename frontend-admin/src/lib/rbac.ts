/**
 * 平台管理端角色 (RBAC) 与权限判定。
 *
 * 契约来源：docs/API/phase-1-contracts.md §7（RBAC 与权限清单）。
 *
 * 设计说明：
 * - AdminRole 四类角色与后端 admin_users.role 枚举 1:1 对齐
 * - Permission 类型直接使用契约中的字符串常量（形如 `scope:resource:action`）
 * - 前端权限来源为 GET /api/v1/admin/me 返回的 permissions 数组，
 *   由 auth-store 统一持有；hasPermission 从传入的权限集合判断
 * - 前端 gating **不构成安全边界**：后端每次调用仍会做二次鉴权
 */

/**
 * 平台管理端角色枚举（与后端 admin_users.role 一一对应）。
 */
export enum AdminRole {
  /** 超级管理员：拥有所有权限 */
  SUPER_ADMIN = "SUPER_ADMIN",
  /** 业务管理员：商家审核、商品审核、订单大盘等 */
  BUSINESS_ADMIN = "BUSINESS_ADMIN",
  /** 客服管理员：售后仲裁、用户投诉处理 */
  CUSTOMER_SERVICE_ADMIN = "CUSTOMER_SERVICE_ADMIN",
  /** 技术管理员：系统配置、日志、权限分配 */
  TECH_ADMIN = "TECH_ADMIN",
}

/**
 * 权限点联合类型。
 *
 * 命名规则：`{scope}:{resource}[:{sub}]:{action}`，scope ∈ {user, merchant, admin}。
 * Phase 1 仅使用契约 §7.2 中的权限键；后续 Phase 追加新权限时在此扩展。
 *
 * 尚未在契约中出现但骨架页面仍需引用的占位键（`admin:product:*` 等）保留为
 * 未来 Phase 声明，Sidebar 在 Phase 1 会将无匹配权限的项 disabled 化。
 */
export type Permission =
  // ---- 契约 §7.2 Phase 1 权限清单 ----
  | "user:self:read"
  | "user:self:update"
  | "user:merchant_application:submit"
  | "user:merchant_application:withdraw"
  | "user:merchant_application:read"
  | "merchant:self:read"
  | "merchant:shop:update"
  | "admin:self:read"
  | "admin:merchant_application:read"
  | "admin:merchant_application:review"
  | "admin:audit_log:read"
  // ---- 后续 Phase 预留（Phase 1 一律返回 false，UI 侧 disabled）----
  | "admin:product:review"
  | "admin:order:read"
  | "admin:order:intervene"
  | "admin:refund:arbitrate"
  | "admin:user:manage"
  | "admin:rbac:manage";

/** 角色元信息（用于 UI badge、下拉展示） */
export interface AdminRoleMeta {
  role: AdminRole;
  label: string;
  /** 用于 badge 的中性色调 */
  tone: "primary" | "info" | "warning" | "danger";
  description: string;
}

export const ADMIN_ROLE_META: Record<AdminRole, AdminRoleMeta> = {
  [AdminRole.SUPER_ADMIN]: {
    role: AdminRole.SUPER_ADMIN,
    label: "超级管理员",
    tone: "danger",
    description: "拥有所有权限，请谨慎操作",
  },
  [AdminRole.BUSINESS_ADMIN]: {
    role: AdminRole.BUSINESS_ADMIN,
    label: "业务管理员",
    tone: "primary",
    description: "商家 / 商品 / 订单业务侧管理",
  },
  [AdminRole.CUSTOMER_SERVICE_ADMIN]: {
    role: AdminRole.CUSTOMER_SERVICE_ADMIN,
    label: "客服管理员",
    tone: "info",
    description: "售后仲裁与用户投诉处理",
  },
  [AdminRole.TECH_ADMIN]: {
    role: AdminRole.TECH_ADMIN,
    label: "技术管理员",
    tone: "warning",
    description: "系统配置、日志与权限分配",
  },
};

/**
 * 判断权限集合中是否包含指定权限。
 *
 * Phase 1 起前端权限完全由后端下发（GET /api/v1/admin/me 返回的
 * permissions 数组），本函数只做集合包含判断，不再依赖前端硬编码矩阵。
 * 这样后端矩阵变更时无需前后端同步发版。
 *
 * @param permissions 当前登录 admin 拥有的权限（来自 auth store），
 *                    未登录时可传 null/undefined/[] 一律返回 false
 * @param permission 待检查的权限键
 */
export function hasPermission(
  permissions: readonly Permission[] | null | undefined,
  permission: Permission,
): boolean {
  if (!permissions || permissions.length === 0) return false;
  return permissions.includes(permission);
}

/**
 * 便捷方法：具备任一权限即可（用于导航项显示）。
 */
export function hasAnyPermission(
  permissions: readonly Permission[] | null | undefined,
  required: readonly Permission[],
): boolean {
  if (!permissions || permissions.length === 0) return false;
  if (required.length === 0) return true;
  return required.some((p) => permissions.includes(p));
}
