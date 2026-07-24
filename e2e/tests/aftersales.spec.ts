import { expect, test } from "@playwright/test";

import { loginAsUser } from "./fixtures";

/**
 * user-web · aftersales.spec —— 已完成订单发起售后申请。
 *
 * 依赖 seed：至少一个 status=completed 的订单（seed.py 会创建 1 个 completed）。
 */

test.describe("user-web · 售后申请", () => {
  test("completed 订单 → 申请售后 return_refund → 我的售后看到 pending_merchant_review", async ({
    page,
  }) => {
    await loginAsUser(page);

    // 1. 进入订单列表 → "已完成" tab
    await page.goto("/orders?status=completed");
    await expect(page.getByRole("heading", { name: "我的订单" })).toBeVisible();

    const firstCompletedCard = page.locator('[data-testid^="order-card-"]').first();
    const hasCompleted = await firstCompletedCard.isVisible().catch(() => false);
    test.skip(!hasCompleted, "seed 中无 completed 订单可发起售后");

    const testId = await firstCompletedCard.getAttribute("data-testid");
    const orderNo = testId?.replace("order-card-", "") ?? "";
    expect(orderNo).not.toEqual("");

    // 2. 进订单详情 → "申请售后"
    await page.goto(`/orders/${orderNo}`);
    const applyLink = page.getByTestId("btn-apply-aftersales");
    // 若该订单已存在 active aftersale，Phase 4 会屏蔽按钮 → 跳过
    const canApply = await applyLink.isVisible().catch(() => false);
    test.skip(!canApply, "该 completed 订单已有 active 售后，无法再申请");

    await applyLink.click();
    await page.waitForURL(/\/aftersales\/new/, { timeout: 10_000 });

    // 3. 选类型 = return_refund（退货退款）
    const returnRefundBtn = page.getByTestId("type-option-return_refund");
    if (await returnRefundBtn.isVisible().catch(() => false)) {
      await returnRefundBtn.click();
    }

    // 4. 勾选第一个商品项
    const firstItemCheck = page.locator('[data-testid^="item-check-"]').first();
    await firstItemCheck.check();

    // 5. 选原因分类：quality_issue
    await page.getByTestId("reason-quality_issue").click();

    // 6. 填写详细说明（≥ 10 字，≤ 500 字）
    await page.getByTestId("reason-note").fill(
      "商品收到后发现存在明显质量问题，希望退货退款处理，谢谢。",
    );

    // 7. 提交
    await page.getByTestId("submit-aftersales").click();

    // 8. 提交成功后跳我的售后详情 → 期望展示"待商家审核"
    await page.waitForURL(/\/aftersales\/\d+/, { timeout: 15_000 });
    await expect(
      page.getByText(/待商家审核|pending_merchant_review/).first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});
