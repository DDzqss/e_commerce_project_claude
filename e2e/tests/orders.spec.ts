import { expect, test } from "@playwright/test";

import { loginAsUser } from "./fixtures";

/**
 * user-web · orders.spec —— 我的订单列表 tab 切换 + 用户取消 pending_payment。
 *
 * 依赖 seed：至少存在一个 pending_payment 订单（否则测试会跳过取消断言）。
 * 若无 pending_payment，改测 tab 切换 + 详情页可访问。
 */

test.describe("user-web · 订单", () => {
  test("登录 → 切换待付款 tab → 详情 → 用户取消 → 状态变 cancelled", async ({
    page,
  }) => {
    await loginAsUser(page);

    // 1. 打开订单列表
    await page.goto("/orders");
    await expect(page.getByRole("heading", { name: "我的订单" })).toBeVisible();

    // 2. 切换到"待支付" tab
    await page.getByTestId("status-tab-pending_payment").click();
    await page.waitForURL(/status=pending_payment/, { timeout: 5_000 });

    // 3. 若列表存在待付款订单，进入详情
    const firstOrderCard = page.locator('[data-testid^="order-card-"]').first();
    const hasPending = await firstOrderCard.isVisible().catch(() => false);
    test.skip(
      !hasPending,
      "seed 中无 pending_payment 订单；改由 shopping.spec 产生的订单在后续跑覆盖",
    );

    // 从 data-testid 抽 orderNo
    const testId = await firstOrderCard.getAttribute("data-testid");
    const orderNo = testId?.replace("order-card-", "") ?? "";
    expect(orderNo).not.toEqual("");

    await page.goto(`/orders/${orderNo}`);
    await expect(page.getByText(orderNo)).toBeVisible({ timeout: 10_000 });

    // 4. 点击"取消订单"按钮 → 弹出 ConfirmModal
    await page.getByRole("button", { name: "取消订单", exact: true }).click();
    // 二次确认弹窗里也有"取消订单"按钮
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "取消订单", exact: true })
      .click();

    // 5. 期望详情页状态变为已取消
    await expect(page.getByText(/交易关闭|已取消/).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
