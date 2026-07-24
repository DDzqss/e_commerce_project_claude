import { expect, test } from "@playwright/test";

import {
  loginAsUser,
  randomNickname,
  randomPhone,
} from "./fixtures";

/**
 * user-web · auth.spec —— 注册 → 登录 → 修改昵称 → 登出 → 再登录看到新昵称。
 *
 * 覆盖契约 §5.1 / §5.2 / §5.3 / §5.7（Phase 1 & Phase 5 profile update）。
 */

test.describe("user-web · 账户", () => {
  test("注册手机号 → 修改昵称 → 登出 → 再登录看到新昵称", async ({ page }) => {
    const phone = randomPhone();
    const password = "Test1234"; // 契约 §附录 A：8-64，含字母+数字
    const originalNickname = randomNickname("e2e");
    const newNickname = `${originalNickname}_v2`;

    // 1. 注册
    await page.goto("/register");
    // 默认 tab 是"手机号注册"，直接填
    await page.getByLabel("手机号").fill(phone);
    await page.getByLabel("昵称（可选）").fill(originalNickname);
    await page.getByLabel("密码", { exact: true }).fill(password);
    await page.getByLabel("确认密码").fill(password);
    await page.getByRole("button", { name: "创建账户" }).click();

    // 注册成功会 replace 到 /，header 上应出现昵称按钮
    await page.waitForURL(/\/$/, { timeout: 15_000 });
    await expect(page.getByText(originalNickname).first()).toBeVisible();

    // 2. 修改昵称：进入我的资料 → 修改
    await page.goto("/account/profile");
    await expect(page.getByText("我的资料")).toBeVisible();
    await page.getByRole("button", { name: "修改" }).first().click();
    const nicknameInput = page.getByLabel("新昵称");
    await nicknameInput.fill(newNickname);
    await page.getByRole("button", { name: "保存" }).click();

    // 昵称更新后 header 也会刷新
    await expect(page.getByText(newNickname).first()).toBeVisible({
      timeout: 10_000,
    });

    // 3. 登出：打开用户菜单点"退出登录"
    await page.locator('button[aria-haspopup="menu"]').click();
    await page.getByRole("menuitem", { name: "退出登录" }).click();

    // 登出后 header 应显示"登录"链接
    await expect(page.getByRole("link", { name: "登录" })).toBeVisible({
      timeout: 10_000,
    });

    // 4. 再次登录，验证昵称已持久化
    await loginAsUser(page, phone, password);
    await expect(page.getByText(newNickname).first()).toBeVisible();
  });
});
