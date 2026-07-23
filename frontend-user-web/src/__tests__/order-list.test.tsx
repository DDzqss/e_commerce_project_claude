import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import OrdersPage from "@/app/orders/page";
import { useAuthStore } from "@/lib/auth-store";
import * as orderApi from "@/lib/order-api";
import { OrderStatus, type OrderListItem } from "@/types/order";

const pushMock = vi.fn();
let searchParamsSpy = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => searchParamsSpy,
  usePathname: () => "/orders",
}));

function makeOrder(
  id: number,
  order_no: string,
  status: OrderStatus,
): OrderListItem {
  return {
    id,
    order_no,
    shop: { id: 12, name: "小李杂货铺" },
    status,
    subtotal_cents: 9900,
    shipping_fee_cents: 0,
    discount_cents: 0,
    total_cents: 9900,
    payment_deadline_at: "2026-07-23T02:00:00Z",
    paid_at: null,
    shipped_at: null,
    completed_at: null,
    cancelled_at: null,
    created_at: "2026-07-23T00:00:00Z",
    updated_at: "2026-07-23T00:00:00Z",
    items: [
      {
        id: 900 + id,
        order_id: id,
        sku_id: 5001,
        spu_id: 1001,
        shop_id: 12,
        spu_title: `商品-${id}`,
        sku_specs: { color: "红" },
        sku_image: null,
        unit_price_cents: 9900,
        quantity: 1,
        subtotal_cents: 9900,
        created_at: "2026-07-23T00:00:00Z",
      },
    ],
    items_count: 1,
  };
}

function wrap(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("OrdersPage", () => {
  beforeEach(() => {
    pushMock.mockReset();
    searchParamsSpy = new URLSearchParams();
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
  });
  afterEach(() => vi.restoreAllMocks());

  it("默认渲染全部订单并展示卡片", async () => {
    vi.spyOn(orderApi, "listOrders").mockResolvedValue({
      items: [
        makeOrder(1, "202607230000001", OrderStatus.PendingPayment),
        makeOrder(2, "202607230000002", OrderStatus.Paid),
      ],
      total: 2,
      page: 1,
      size: 10,
    });

    render(wrap(<OrdersPage />));

    await waitFor(() => {
      expect(
        screen.getByTestId("order-card-202607230000001"),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByTestId("order-card-202607230000002"),
    ).toBeInTheDocument();

    // status badge
    expect(
      screen.getByTestId(`status-badge-${OrderStatus.PendingPayment}`),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(`status-badge-${OrderStatus.Paid}`),
    ).toBeInTheDocument();
  });

  it("点击 status tab 触发路由更新 + 清空 page", async () => {
    vi.spyOn(orderApi, "listOrders").mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      size: 10,
    });

    render(wrap(<OrdersPage />));
    await waitFor(() => {
      expect(
        screen.getByTestId("status-tab-pending_payment"),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("status-tab-pending_payment"));
    expect(pushMock).toHaveBeenCalled();
    const url = pushMock.mock.calls.at(-1)?.[0] as string;
    expect(url).toContain("status=pending_payment");
    // 切 tab 时应清 page
    expect(url).not.toContain("page=");
  });

  it("空列表显示 EmptyState", async () => {
    vi.spyOn(orderApi, "listOrders").mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      size: 10,
    });

    render(wrap(<OrdersPage />));
    await waitFor(() => {
      expect(screen.getByText(/暂无订单/)).toBeInTheDocument();
    });
  });
});
