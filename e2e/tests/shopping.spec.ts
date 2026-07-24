import { expect, test } from "@playwright/test";

import { SEED_USER, loginAsUser } from "./fixtures";

/**
 * user-web · shopping.spec —— 主购物路径。
 *
 * 匿名浏览首页 → 进入商品详情 → 点"加入购物车"被引导登录 → 登录后加购成功
 *   → 购物车 → 结算 → 选默认地址 → 提交订单 → 模拟支付页 → 支付成功
 *   → 跳订单详情看到 paid 状态。
 *
 * 依赖 seed 数据：至少 1 个 approved SPU、user 已有默认地址。
 */

test.describe("user-web · 购物主路径", () => {
  test("匿名浏览 → 加购触发登录 → 结算 → 模拟支付 → 订单进入 paid", async ({
    page,
  }) => {
    // 1. 匿名首页
    await page.goto("/");
    // 商品卡片有 h3 标题；用户端默认列出 approved SPUs
    const firstProductLink = page
      .locator('a[href^="/products/"]')
      .first();
    await expect(firstProductLink).toBeVisible({ timeout: 15_000 });
    const productHref = await firstProductLink.getAttribute("href");
    expect(productHref).toMatch(/^\/products\/\d+/);

    // 2. 进入商品详情（匿名）
    await firstProductLink.click();
    await page.waitForURL(/\/products\/\d+/);
    // 加入购物车按钮存在（若有 spec_axes 需先选规格）
    const addBtn = page.getByTestId("add-to-cart-btn");
    await expect(addBtn).toBeVisible();

    // 若存在规格轴：为每个轴选中第一个选项
    const skuOptions = page.locator('[data-testid^="sku-option-"]');
    const skuCount = await skuOptions.count();
    if (skuCount > 0) {
      // 每个轴取第一个 option；这里粗略遍历所有 button，去重靠 aria-checked 状态自然
      // 简单做法：找 (axis, first-value) 对，用 attribute 分组
      const seenAxes = new Set<string>();
      for (let i = 0; i < skuCount; i++) {
        const opt = skuOptions.nth(i);
        const testid = await opt.getAttribute("data-testid");
        // data-testid=sku-option-{axis}-{value}
        const parts = testid?.split("-") ?? [];
        const axis = parts.slice(2, -1).join("-");
        if (!axis || seenAxes.has(axis)) continue;
        seenAxes.add(axis);
        await opt.click();
      }
    }

    // 3. 未登录点加购 → 前端会 push /login?next=...
    await addBtn.click();
    await page.waitForURL(/\/login/, { timeout: 10_000 });

    // 4. 登录
    await page.getByLabel(/手机号\s*\/\s*邮箱/).fill(SEED_USER.identifier);
    await page.getByLabel("密码", { exact: true }).fill(SEED_USER.password);
    await page.getByRole("button", { name: "登录", exact: true }).click();

    // 登录后应 replace 回商品详情
    await page.waitForURL(/\/products\/\d+/, { timeout: 15_000 });

    // 5. 再次点击加购
    const addBtn2 = page.getByTestId("add-to-cart-btn");
    await expect(addBtn2).toBeVisible();
    await addBtn2.click();

    // 加购成功提示（toast）
    await expect(page.getByText(/已加入购物车/)).toBeVisible({
      timeout: 10_000,
    });

    // 6. 打开购物车页
    await page.goto("/cart");
    await expect(page.getByRole("heading", { name: "购物车" })).toBeVisible();

    // 底部结算按钮
    const checkoutBtn = page.getByTestId("checkout-btn");
    await expect(checkoutBtn).toBeVisible();

    // 全选 → 保证有勾选项
    await page.getByTestId("select-all").check();

    await checkoutBtn.click();
    await page.waitForURL(/\/checkout/, { timeout: 10_000 });

    // 7. 结算页：默认地址已选中；若无地址跳过测试
    await expect(page.getByTestId("checkout-address-section")).toBeVisible();
    // 若警告卡片有内容说明存在阻断（失效/缺货），直接终止本次断言
    const warnings = page.getByTestId("checkout-warnings");
    if (await warnings.isVisible().catch(() => false)) {
      test.info().annotations.push({
        type: "warning",
        description: "checkout 出现 warnings，检查 seed 数据是否有失效商品",
      });
    }

    // 提交订单
    await page.getByTestId("submit-order-btn").click();

    // 8. 支付页：提交订单后单订单跳 /orders/{no}/pay，多订单跳 /orders
    // Phase 3 单店铺购物车结算为单订单
    await page.waitForURL(/\/(orders\/[^/]+\/pay|orders(?:$|\?))/, {
      timeout: 15_000,
    });

    // 若停在 /orders 说明是多订单场景；点第一个待支付订单进入 pay
    if (page.url().includes("/orders") && !page.url().includes("/pay")) {
      const payLink = page.getByRole("link", { name: /立即支付/ }).first();
      await payLink.click();
    }

    // 支付渠道选择页：假定有 mock 渠道，点确认支付跳 /mock-payment/{sessionId}
    // Phase 3 页面：POST /pay 得到 session；不同实现可能是 select + button
    // 这里通用做法：点页面上任一"立即支付"或"确认支付"按钮
    const confirmPayBtn = page
      .getByRole("button", { name: /(确认支付|立即支付|开始支付)/ })
      .first();
    if (await confirmPayBtn.isVisible().catch(() => false)) {
      await confirmPayBtn.click();
    }

    await page.waitForURL(/\/mock-payment\//, { timeout: 15_000 });

    // 9. 模拟支付成功
    await page.getByTestId("mock-pay-succeed").click();
    await expect(page.getByText(/支付成功/)).toBeVisible({ timeout: 10_000 });

    // 10. 跳订单详情或列表；期望状态是 paid
    await page.waitForURL(/\/orders\/[^/]+(?:$|\?)/, { timeout: 20_000 });
    // status badge：paid → "待发货"
    await expect(
      page.locator('[data-testid^="status-badge-"]').first(),
    ).toBeVisible();
    await expect(page.getByText(/待发货|已支付/).first()).toBeVisible();
  });
});
