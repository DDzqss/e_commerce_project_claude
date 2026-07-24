import { expect, test } from "@playwright/test";

import { loginAsMerchant } from "./fixtures";

/**
 * merchant · smoke —— 商家登录 → 待发货订单发货。
 *
 * 依赖 seed：至少一个 status=paid 的商家订单（seed.py 会创建）。
 */

test.describe("merchant · 订单发货", () => {
  test("登录 → 找 paid 订单 → 发货填单号 → 状态变 shipped", async ({ page }) => {
    await loginAsMerchant(page);

    // 1. 进入订单列表 → paid tab
    await page.goto("/orders?status=paid");
    await expect(
      page.getByRole("heading", { name: /订单|待发货/ }).first(),
    ).toBeVisible({ timeout: 15_000 });

    // 2. 找第一个订单的详情链接。商家端订单卡片没有强制的 data-testid，
    //    但订单 no 是链接 /orders/{orderNo}，所以我们抓第一条这种链接。
    const detailLink = page
      .locator('a[href^="/orders/"]:not([href="/orders"])')
      .first();
    const hasPaid = await detailLink.isVisible().catch(() => false);
    test.skip(!hasPaid, "seed 中无 paid 订单可发货");

    await detailLink.click();
    await page.waitForURL(/\/orders\/[^/]+$/, { timeout: 10_000 });

    // 3. 点"发货" → 弹 ShipOrderModal
    await page.getByRole("button", { name: "发货", exact: true }).click();
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();

    // 4. 选快递公司 SF + 单号
    await modal.getByRole("combobox").selectOption("SF");
    await modal
      .getByPlaceholder("请输入快递单号")
      .fill("SF1234567890");

    // 5. 提交
    await modal.getByRole("button", { name: "确认发货" }).click();

    // 6. Modal 关闭 + 订单状态 badge 变为已发货
    await expect(modal).not.toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/已发货|shipped/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
