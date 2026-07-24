import { expect, test } from "@playwright/test";

import { loginAsAdmin } from "./fixtures";

/**
 * admin · smoke —— 商家入驻审核台。
 *
 * 若无 pending 数据，则退化为"访问审核台不 crash"（列表可加载 + 无 500）。
 */

test.describe("admin · 商家入驻审核", () => {
  test("登录 → 访问入驻审核列表 → 若有 pending 尝试通过审批", async ({ page }) => {
    await loginAsAdmin(page);

    // 1. 进入审核台
    await page.goto("/console/merchants/applications?status=pending");
    await expect(page.getByText(/商家入驻审核|申请|审批/).first()).toBeVisible({
      timeout: 15_000,
    });

    // 2. 找第一条 pending 申请（链接 /console/merchants/applications/{id}）
    const firstApp = page
      .locator('a[href^="/console/merchants/applications/"]')
      .first();
    const hasPending = await firstApp.isVisible().catch(() => false);

    if (!hasPending) {
      // 无 pending 数据也不算失败：只要页面不 crash 即可
      // 断言列表容器存在，主内容不是 5xx / 空白
      const bodyText = await page.locator("body").innerText();
      expect(bodyText.length).toBeGreaterThan(20);
      return;
    }

    await firstApp.click();
    await page.waitForURL(/\/console\/merchants\/applications\/\d+/, {
      timeout: 10_000,
    });

    // 3. 若详情页允许通过审批，则执行通过并检查提示；否则仅验证详情页可打开
    const approveBtn = page.getByRole("button", { name: "通过审批" });
    if (!(await approveBtn.isVisible().catch(() => false))) {
      // 详情已不再 pending，仅验证页面渲染成功
      await expect(page.getByText(/申请|入驻/).first()).toBeVisible();
      return;
    }

    await approveBtn.click();
    // 通过弹窗里再次确认（"确认通过" / "确定" / "提交"）
    const modal = page.getByRole("dialog");
    if (await modal.isVisible().catch(() => false)) {
      const confirm = modal
        .getByRole("button", { name: /(确认通过|确定|通过|提交)/ })
        .last();
      if (await confirm.isVisible().catch(() => false)) {
        await confirm.click();
      }
    }

    // 期望 toast 或页面提示"已通过"或商家账号信息出现
    await expect(
      page.getByText(/已通过|商家账号|login_name/).first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});
