/**
 * 平台管理端角色 (RBAC) 与权限判定 —— 占位实现。
 *
 * 对应 docs/DEVELOPMENT_PLAN.md 第 5.1 节的「平台管理端」角色划分。
 * 真实的权限点表 (permission catalog) 与 hasPermission 逻辑将在
 * feature/backend-rbac 分支落地后，由本文件从后端 /api/v1/admin/auth/me
 * 返回结构中同步。当前占位实现足以支撑骨架页面渲染。
 */

/**
 * 平台管理端角色枚举。
 *
 * 与用户角色（普通用户）、商家角色（店铺管理员 / 运营 / 客服）严格隔离；
 * 后端 JWT 的 `aud` 字段固定为 `admin` 才允许访问 /api/v1/admin/*。
 */
export enum AdminRole {
  /** 超级管理员：拥有所有权限，包括权限分配与系统级配置 */
  SUPER_ADMIN = "SUPER_ADMIN",
  /** 业务管理员：商家审核、商品审核、订单大盘、店铺违规处理 */
  BUSINESS_ADMIN = "BUSINESS_ADMIN",
  /** 客服管理员：售后仲裁、用户投诉处理、代客发起退款 */
  CUSTOMER_SERVICE_ADMIN = "CUSTOMER_SERVICE_ADMIN",
  /** 技术管理员：系统配置、日志、权限分配 */
  TECH_ADMIN = "TECH_ADMIN",
}

/**
 * 权限点。命名规则：`资源:操作` 或 `资源:子资源:操作`。
 * 与后端 permission catalog 一一对应（Phase 1 起从后端同步）。
 */
export type Permission =
  | "merchant:list"
  | "merchant:review"
  | "product:list"
  | "product:review"
  | "order:list"
  | "order:intervene"
  | "refund:list"
  | "refund:arbitrate"
  | "user:list"
  | "user:disable"
  | "rbac:manage"
  | "log:view";

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
 * 角色 → 权限矩阵（占位）。
 * 真实矩阵由后端下发，前端只用于快速隐藏 UI 入口。
 * 后端 API 每次调用仍会做二次校验，前端 gating 不能作为安全边界。
 */
const ROLE_PERMISSIONS: Record<AdminRole, ReadonlyArray<Permission>> = {
  [AdminRole.SUPER_ADMIN]: [
    "merchant:list",
    "merchant:review",
    "product:list",
    "product:review",
    "order:list",
    "order:intervene",
    "refund:list",
    "refund:arbitrate",
    "user:list",
    "user:disable",
    "rbac:manage",
    "log:view",
  ],
  [AdminRole.BUSINESS_ADMIN]: [
    "merchant:list",
    "merchant:review",
    "product:list",
    "product:review",
    "order:list",
    "order:intervene",
  ],
  [AdminRole.CUSTOMER_SERVICE_ADMIN]: [
    "order:list",
    "refund:list",
    "refund:arbitrate",
    "user:list",
  ],
  [AdminRole.TECH_ADMIN]: [
    "rbac:manage",
    "log:view",
    "user:list",
  ],
};

/**
 * 判断某角色是否拥有指定权限（占位实现）。
 *
 * @param role 当前用户角色；未登录时可传 null，一律返回 false
 * @param permission 待检查权限点
 * @returns 是否具备权限
 */
export function hasPermission(
  role: AdminRole | null | undefined,
  permission: Permission,
): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

/**
 * 便捷方法：判断是否具备任一权限（用于导航项显示逻辑）。
 */
export function hasAnyPermission(
  role: AdminRole | null | undefined,
  permissions: readonly Permission[],
): boolean {
  if (!role) return false;
  return permissions.some((p) => hasPermission(role, p));
}
