import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import CartPage from "@/app/cart/page";
import { useAuthStore } from "@/lib/auth-store";
import * as cartApi from "@/lib/cart-api";
import type { CartResponse } from "@/types/order";

/**
 * 购物车页面的集成测试。
 *
 * 覆盖：
 * - 分组渲染（每店 header + items）
 * - 失效商品的灰化 + "已下架"/"库存不足" 标签 + 勾选禁用
 * - 全选切换调用 selectAllCartItems
 */

const pushMock = vi.fn();
const replaceMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
  useSearchParams: () => ({ get: () => null }),
  usePathname: () => "/cart",
}));

function makeSku(id: number, stock = 5) {
  return {
    id,
    sku_code: `S-${id}`,
    specs: { color: "红", size: "L" },
    price_cents: 9900,
    original_price_cents: null,
    stock,
    image: null,
    is_active: true,
  };
}

function fixtureCart(): CartResponse {
  return {
    groups: [
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
            sku: makeSku(5001, 10),
            spu: { id: 1001, title: "红色 T 恤", main_image: "spu/x.jpg" },
          },
          {
            id: 112,
            sku_id: 5002,
            quantity: 1,
            selected: false,
            status: "invalid",
            invalid_reason: "out_of_stock",
            sku: makeSku(5002, 0),
            spu: { id: 1002, title: "缺货商品", main_image: "spu/y.jpg" },
          },
        ],
        subtotal_cents_selected: 19800,
      },
      {
        shop: { id: 20, name: "另一家店" },
        items: [
          {
            id: 200,
            sku_id: 6001,
            quantity: 1,
            selected: false,
            status: "valid",
            invalid_reason: null,
            sku: makeSku(6001, 3),
            spu: { id: 2001, title: "另一件商品", main_image: "spu/z.jpg" },
          },
        ],
        subtotal_cents_selected: 0,
      },
    ],
    total_cents_selected: 19800,
    total_selected_count: 2,
    invalid_count: 1,
  };
}

function wrap(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("CartPage", () => {
  beforeEach(() => {
    pushMock.mockReset();
    replaceMock.mockReset();
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
    vi.spyOn(cartApi, "getCart").mockResolvedValue(fixtureCart());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("渲染两个店铺分组与对应的商品", async () => {
    render(wrap(<CartPage />));
    // 等到接口 resolve
    await waitFor(() => {
      expect(screen.getByTestId("shop-group-12")).toBeInTheDocument();
    });
    expect(screen.getByTestId("shop-group-20")).toBeInTheDocument();
    expect(screen.getByText("小李杂货铺")).toBeInTheDocument();
    expect(screen.getByText("红色 T 恤")).toBeInTheDocument();
    expect(screen.getByText("缺货商品")).toBeInTheDocument();
    expect(screen.getByText("另一件商品")).toBeInTheDocument();
  });

  it("失效商品行被灰化 + 复选框 disabled + 显示 已失效/库存不足 标签", async () => {
    render(wrap(<CartPage />));
    await waitFor(() => {
      expect(screen.getByTestId("cart-item-112")).toBeInTheDocument();
    });
    const invalidRow = screen.getByTestId("cart-item-112");
    expect(invalidRow.getAttribute("data-invalid")).toBe("true");
    // 复选框
    const checkbox = invalidRow.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement;
    expect(checkbox).not.toBeNull();
    expect(checkbox.disabled).toBe(true);
    // 标签文案
    expect(invalidRow.textContent).toContain("库存不足");
  });

  it("全选切换触发 selectAllCartItems(true)", async () => {
    const spy = vi
      .spyOn(cartApi, "selectAllCartItems")
      .mockResolvedValue(null);

    render(wrap(<CartPage />));
    await waitFor(() => {
      expect(screen.getByTestId("select-all")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("select-all"));

    await waitFor(() => {
      expect(spy).toHaveBeenCalledTimes(1);
    });
    expect(spy).toHaveBeenCalledWith(true);
  });

  it("底部结算按钮：无选中禁用；有选中可点击并跳 checkout", async () => {
    render(wrap(<CartPage />));
    await waitFor(() => {
      expect(screen.getByTestId("checkout-btn")).toBeInTheDocument();
    });
    // 我们的 fixture: 只有 id=111 是 selected=true 且 valid，所以按钮应该可用
    const btn = screen.getByTestId("checkout-btn") as HTMLButtonElement;
    expect(btn).not.toBeDisabled();

    fireEvent.click(btn);
    expect(pushMock).toHaveBeenCalledWith("/checkout?cart_item_ids=111");
  });
});
