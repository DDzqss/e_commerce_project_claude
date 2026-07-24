import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import CheckoutPage from "@/app/checkout/page";
import { useAuthStore } from "@/lib/auth-store";
import * as addressApi from "@/lib/address-api";
import * as orderApi from "@/lib/order-api";
import type { PreviewOut, UserAddress } from "@/types/order";

/**
 * checkout 页面集成测试。
 *
 * 覆盖：
 * - preview + createOrder happy path：能预览并跳转到支付页
 * - warnings 中含 stock_short/invalid_sku 时阻止提交
 */

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  // 结算页从 URL 读 cart_item_ids
  useSearchParams: () => new URLSearchParams("cart_item_ids=111,112"),
  usePathname: () => "/checkout",
}));

function makeAddress(id: number, isDefault = false): UserAddress {
  return {
    id,
    user_id: 1,
    receiver_name: "张三",
    receiver_phone: "13800001234",
    province: "浙江省",
    city: "杭州市",
    district: "西湖区",
    detail: "文三路 100 号",
    postal_code: "310012",
    is_default: isDefault,
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
  };
}

function makePreview(warnings: PreviewOut["warnings"] = []): PreviewOut {
  return {
    address: makeAddress(88, true),
    groups_by_shop: [
      {
        shop: { id: 12, name: "小李杂货铺" },
        items: [
          {
            id: 111,
            sku_id: 5001,
            quantity: 2,
            selected: true,
            status: "valid",
            invalid_reason: null,
            sku: {
              id: 5001,
              sku_code: "S1",
              specs: { color: "红" },
              price_cents: 9900,
              original_price_cents: null,
              stock: 10,
              image: null,
              is_active: true,
            },
            spu: { id: 1001, title: "红色 T 恤", main_image: "spu/x.jpg" },
          },
        ],
        subtotal_cents: 19800,
        shipping_fee_cents: 0,
        total_cents: 19800,
      },
    ],
    grand_total_cents: 19800,
    warnings,
  };
}

function wrap(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("CheckoutPage", () => {
  beforeEach(() => {
    pushMock.mockReset();
    window.sessionStorage.clear();
    useAuthStore.getState().login({
      access_token: "AT",
      refresh_token: "RT",
      expires_in: 900,
      user: {
        id: 1,
        phone: "13800001234",
        email: null,
        nickname: "test",
        avatar_url: null,
      },
    });
    useAuthStore.getState()._setHydrated(true);
    vi.spyOn(addressApi, "listAddresses").mockResolvedValue([
      makeAddress(88, true),
    ]);
  });
  afterEach(() => vi.restoreAllMocks());

  it("happy path: preview + createOrder + 跳单订单支付页", async () => {
    vi.spyOn(orderApi, "previewOrder").mockResolvedValue(makePreview());
    const createSpy = vi
      .spyOn(orderApi, "createOrder")
      .mockResolvedValue({
        orders: [
          {
            id: 5001,
            order_no: "202607230000000001",
            total_cents: 19800,
            shop: { id: 12, name: "小李杂货铺" },
            payment_deadline_at: "2026-07-23T01:00:00Z",
          },
        ],
      });

    render(wrap(<CheckoutPage />));

    // 等待 preview 渲染完成并 button 变为可用
    await waitFor(() => {
      const btn = screen.getByTestId("submit-order-btn") as HTMLButtonElement;
      expect(btn).not.toBeDisabled();
    });

    const submitBtn = screen.getByTestId(
      "submit-order-btn",
    ) as HTMLButtonElement;

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledTimes(1);
    });
    // 校验 payload
    const [payload, idem] = createSpy.mock.calls[0]!;
    expect(payload).toEqual(
      expect.objectContaining({
        cart_item_ids: [111, 112],
        address_id: 88,
      }),
    );
    expect(typeof idem).toBe("string");
    expect(idem.length).toBeGreaterThanOrEqual(8);
    // 应跳到单订单支付页
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith(
        "/orders/202607230000000001/pay",
      );
    });
  });

  it("warnings 有 invalid_sku 时展示警告 + 提交按钮 disabled", async () => {
    vi.spyOn(orderApi, "previewOrder").mockResolvedValue(
      makePreview([
        {
          type: "invalid_sku",
          message: "商品「已失效」已自动跳过",
          cart_item_id: 112,
        },
      ]),
    );

    render(wrap(<CheckoutPage />));
    await waitFor(() => {
      expect(screen.getByTestId("checkout-warnings")).toBeInTheDocument();
    });
    expect(screen.getByTestId("checkout-warnings").textContent).toContain(
      "已自动跳过",
    );

    const submitBtn = screen.getByTestId(
      "submit-order-btn",
    ) as HTMLButtonElement;
    expect(submitBtn).toBeDisabled();
  });
});
