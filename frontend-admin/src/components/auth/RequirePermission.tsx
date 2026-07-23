"use client";

/**
 * 客户端权限守卫。无权限则渲染占位说明。
 *
 * 与后端权限一起构成双层校验：
 * - 前端：隐藏无权限入口 + 页面级 fallback，改善 UX
 * - 后端：每次调用都在 dependency 层二次校验（真正的安全边界）
 *
 * 用法：
 *   <RequirePermission permission="admin:merchant_application:read">
 *     <MerchantApplicationList />
 *   </RequirePermission>
 *
 * 也支持多个（默认 mode="any"，任一命中即可；mode="all" 要求全部命中）：
 *   <RequirePermission permissions={["admin:x", "admin:y"]} mode="all">...
 */

import type { ReactNode } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { hasAnyPermission, hasPermission, type Permission } from "@/lib/rbac";

interface CommonProps {
  children: ReactNode;
  fallback?: ReactNode;
}

type RequirePermissionProps =
  | (CommonProps & { permission: Permission; permissions?: never; mode?: never })
  | (CommonProps & {
      permission?: never;
      permissions: readonly Permission[];
      mode?: "any" | "all";
    });

export function RequirePermission(props: RequirePermissionProps) {
  const permissions = useAuthStore((s) => s.permissions);
  const status = useAuthStore((s) => s.status);

  const granted = (() => {
    if (status !== "authenticated") return false;
    if ("permission" in props && props.permission) {
      return hasPermission(permissions, props.permission);
    }
    const list = (props as { permissions: readonly Permission[] }).permissions;
    const mode = (props as { mode?: "any" | "all" }).mode ?? "any";
    if (mode === "all") {
      return list.every((p) => hasPermission(permissions, p));
    }
    return hasAnyPermission(permissions, list);
  })();

  if (granted) return <>{props.children}</>;

  return (
    <>
      {props.fallback ?? (
        <div className="rounded-md border border-dashed border-[color:var(--color-border)] bg-white p-8 text-center text-sm text-neutral-500">
          <div className="mb-2 text-base font-medium text-neutral-700">
            无权限访问
          </div>
          <p>当前账号未获得访问该模块所需权限，请联系超级管理员分配。</p>
        </div>
      )}
    </>
  );
}
