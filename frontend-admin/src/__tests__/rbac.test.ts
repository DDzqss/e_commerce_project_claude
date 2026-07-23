/**
 * RBAC 权限判定单元测试。
 *
 * 覆盖：
 * - hasPermission：命中 / 未命中 / 空数组 / null
 * - hasAnyPermission：任一命中 / 全部不命中 / 空 required 数组
 * - Permission 联合类型仍包含契约 §7.2 全部键（编译期即可验证）
 */

import { describe, it, expect } from "vitest";
import {
  hasAnyPermission,
  hasPermission,
  AdminRole,
  ADMIN_ROLE_META,
  type Permission,
} from "@/lib/rbac";

describe("hasPermission", () => {
  it("命中权限时返回 true", () => {
    const perms: Permission[] = ["admin:merchant_application:read"];
    expect(hasPermission(perms, "admin:merchant_application:read")).toBe(true);
  });

  it("未命中权限时返回 false", () => {
    const perms: Permission[] = ["admin:self:read"];
    expect(hasPermission(perms, "admin:merchant_application:review")).toBe(
      false,
    );
  });

  it("permissions 为空数组时返回 false", () => {
    expect(hasPermission([], "admin:merchant_application:read")).toBe(false);
  });

  it("permissions 为 null / undefined 时返回 false", () => {
    expect(hasPermission(null, "admin:merchant_application:read")).toBe(false);
    expect(hasPermission(undefined, "admin:merchant_application:read")).toBe(
      false,
    );
  });
});

describe("hasAnyPermission", () => {
  const perms: Permission[] = [
    "admin:self:read",
    "admin:merchant_application:read",
  ];

  it("任一权限命中返回 true", () => {
    expect(
      hasAnyPermission(perms, [
        "admin:audit_log:read",
        "admin:merchant_application:read",
      ]),
    ).toBe(true);
  });

  it("全部权限均不命中返回 false", () => {
    expect(
      hasAnyPermission(perms, [
        "admin:audit_log:read",
        "admin:product:review",
      ]),
    ).toBe(false);
  });

  it("required 为空数组时返回 true（视为无要求）", () => {
    expect(hasAnyPermission(perms, [])).toBe(true);
  });

  it("空 permissions 一律 false", () => {
    expect(hasAnyPermission([], ["admin:self:read"])).toBe(false);
    expect(hasAnyPermission(null, ["admin:self:read"])).toBe(false);
  });
});

describe("ADMIN_ROLE_META", () => {
  it("四类 admin 角色元信息齐全", () => {
    expect(ADMIN_ROLE_META[AdminRole.SUPER_ADMIN].label).toBe("超级管理员");
    expect(ADMIN_ROLE_META[AdminRole.BUSINESS_ADMIN].label).toBe("业务管理员");
    expect(ADMIN_ROLE_META[AdminRole.CUSTOMER_SERVICE_ADMIN].label).toBe(
      "客服管理员",
    );
    expect(ADMIN_ROLE_META[AdminRole.TECH_ADMIN].label).toBe("技术管理员");
  });
});
