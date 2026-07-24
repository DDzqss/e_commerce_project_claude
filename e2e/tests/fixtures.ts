import { expect, type Page } from "@playwright/test";

/**
 * 测试账号（与 backend/app/scripts/seed.py 对齐）：
 *   user      · 手机 13800000001 / 密码 Test1234
 *   merchant  · 登录名 shop1_owner / 密码 Merch1234
 *   admin     · 用户名 super       / 密码 super_pwd_change_me
 *
 * 允许通过环境变量覆盖，方便在预发环境跑同一套 spec。
 */
export const SEED_USER = {
  identifier: process.env.E2E_USER_IDENTIFIER ?? "13800000001",
  password: process.env.E2E_USER_PASSWORD ?? "Test1234",
};

export const SEED_MERCHANT = {
  loginName: process.env.E2E_MERCHANT_LOGIN_NAME ?? "shop1_owner",
  password: process.env.E2E_MERCHANT_PASSWORD ?? "Merch1234",
};

export const SEED_ADMIN = {
  username: process.env.E2E_ADMIN_USERNAME ?? "super",
  password: process.env.E2E_ADMIN_PASSWORD ?? "super_pwd_change_me",
};

/**
 * 用户端登录 helper：走 UI 表单，不直接 poke localStorage / API。
 *
 * 目的：确保测试跟真实用户路径一致；返回后 page 已带 auth cookie / localStorage。
 * 调用方需保证 page.context() 是 user-web 站点。
 */
export async function loginAsUser(
  page: Page,
  identifier: string = SEED_USER.identifier,
  password: string = SEED_USER.password,
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/手机号\s*\/\s*邮箱/).fill(identifier);
  await page.getByLabel("密码", { exact: true }).fill(password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  // 登录成功后跳到 next 目标；SiteHeader 会渲染带 aria-haspopup="menu" 的昵称按钮
  await expect(page.locator('button[aria-haspopup="menu"]')).toBeVisible({
    timeout: 15_000,
  });
}

/**
 * 商家登录 helper。
 */
export async function loginAsMerchant(
  page: Page,
  loginName: string = SEED_MERCHANT.loginName,
  password: string = SEED_MERCHANT.password,
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("登录名").fill(loginName);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", { name: /登录/ }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
}

/**
 * Admin 登录 helper。
 */
export async function loginAsAdmin(
  page: Page,
  username: string = SEED_ADMIN.username,
  password: string = SEED_ADMIN.password,
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("用户名").fill(username);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.waitForURL(/\/console/, { timeout: 15_000 });
}

/**
 * 生成不重复的手机号：138 + 时间戳后 8 位。
 * 用于每次 auth.spec 注册流程避免与前次跑残留冲突。
 */
export function randomPhone(): string {
  const suffix = String(Date.now()).slice(-8);
  return `138${suffix}`;
}

/**
 * 生成不重复昵称。
 */
export function randomNickname(prefix = "e2e_user"): string {
  return `${prefix}_${Date.now().toString(36)}`;
}
