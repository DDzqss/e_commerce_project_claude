/**
 * 商家订单列表页测试。
 *
 * 覆盖：
 *  - 默认加载：默认 status=paid 传给 API
 *  - Tab 切换到"已发货"后重新请求
 *  - 分页按钮：下一页触发新请求
 *
 * 策略：mock `@/lib/order-api` 让 hook 直接返回受控数据。
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import type { PagedOut } from "@/types/api";
import type {
  MerchantOrderListItem,
  MerchantOrderStats,
} from "@/types/order";

// ---- mocks ---------------------------------------------------------------

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/orders",
  useParams: () => ({}),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const listMock = vi.fn();
const statsMock = vi.fn();

vi.mock("@/lib/order-api", () => ({
  listMerchantOrders: (q: unknown) => listMock(q),
  getMerchantOrder: vi.fn(),
  shipOrder: vi.fn(),
  cancelOrder: vi.fn(),
  addMerchantNote: vi.fn(),
  getOrderStats: () => statsMock(),
}));

// 延后 import，确保 mock 生效
import OrdersListPage from "@/app/(dashboard)/orders/page";

// ---- fixtures ------------------------------------------------------------

const stats: MerchantOrderStats = {
  pending_payment_count: 3,
  paid_pending_ship_count: 5,
  shipped_count: 12,
  completed_today_count: 2,
  revenue_today_cents: 128000,
};

function makeOrder(overrides: Partial<MerchantOrderListItem> = {}): MerchantOrderListItem {
  return {
    id: 1001,
    order_no: "202607230000001001",
    user_id: 500,
    status: "paid",
    subtotal_cents: 19800,
    shipping_fee_cents: 0,
    discount_cents: 0,
    total_cents: 19800,
    receiver_name: "张三",
    receiver_phone: "13800001234",
    payment_deadline_at: null,
    paid_at: "2026-07-22T08:00:00Z",
    shipped_at: null,
    completed_at: null,
    cancelled_at: null,
    created_at: "2026-07-22T07:59:00Z",
    updated_at: "2026-07-22T08:00:00Z",
    items: [
      {
        id: 1,
        order_id: 1001,
        sku_id: 5001,
        spu_id: 1001,
        shop_id: 12,
        spu_title: "iPhone 20 Pro",
        sku_specs: { color: "红", size: "L" },
        sku_image: null,
        unit_price_cents: 9900,
        quantity: 2,
        subtotal_cents: 19800,
        created_at: "2026-07-22T07:59:00Z",
      },
    ],
    items_count: 2,
    ...overrides,
  };
}

function pagedPaid(): PagedOut<MerchantOrderListItem> {
  return {
    items: [makeOrder(), makeOrder({ id: 1002, order_no: "202607230000001002" })],
    total: 25, // 25 条 → 2 页
    page: 1,
    size: 20,
  };
}

function pagedShipped(): PagedOut<MerchantOrderListItem> {
  return {
    items: [
      makeOrder({
        id: 2001,
        order_no: "202607200000002001",
        status: "shipped",
      }),
    ],
    total: 1,
    page: 1,
    size: 20,
  };
}

function renderWithProviders(node: ReactNode) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={qc}>{node}</QueryClientProvider>);
}

// ---- tests --------------------------------------------------------------

describe("OrdersListPage", () => {
  beforeEach(() => {
    listMock.mockReset();
    statsMock.mockReset();
    statsMock.mockResolvedValue(stats);
  });

  it("首屏默认按 paid 状态查询并渲染订单", async () => {
    listMock.mockResolvedValue(pagedPaid());

    renderWithProviders(<OrdersListPage />);

    await waitFor(() => {
      expect(listMock).toHaveBeenCalled();
    });

    // 首次调用 status 应为 paid
    const firstCall = listMock.mock.calls[0]?.[0] as {
      status?: string;
      page?: number;
    };
    expect(firstCall.status).toBe("paid");
    expect(firstCall.page).toBe(1);

    // 渲染的订单号
    await waitFor(() => {
      expect(screen.getByText("202607230000001001")).toBeInTheDocument();
    });

    // 电话应被脱敏
    expect(screen.getAllByText(/138\*\*\*\*1234/).length).toBeGreaterThan(0);
  });

  it("切换到已发货 tab 后重新按 shipped 查询", async () => {
    listMock.mockResolvedValueOnce(pagedPaid());

    renderWithProviders(<OrdersListPage />);

    // 等待首次渲染完成
    await waitFor(() => {
      expect(listMock).toHaveBeenCalledTimes(1);
    });

    // 切换到已发货
    listMock.mockResolvedValueOnce(pagedShipped());
    fireEvent.click(screen.getByRole("button", { name: "已发货" }));

    await waitFor(() => {
      const lastCall = listMock.mock.calls.at(-1)?.[0] as { status?: string };
      expect(lastCall.status).toBe("shipped");
    });

    // 已发货订单展示
    await waitFor(() => {
      expect(screen.getByText("202607200000002001")).toBeInTheDocument();
    });
  });

  it("分页：点击下一页触发 page=2 的查询", async () => {
    listMock.mockResolvedValue(pagedPaid());

    renderWithProviders(<OrdersListPage />);
    await waitFor(() => {
      expect(listMock).toHaveBeenCalled();
    });

    // 首页共 25 条，size=20 → 2 页
    const nextButton = await screen.findByRole("button", { name: "下一页" });
    expect(nextButton).not.toBeDisabled();

    fireEvent.click(nextButton);

    await waitFor(() => {
      const lastCall = listMock.mock.calls.at(-1)?.[0] as { page?: number };
      expect(lastCall.page).toBe(2);
    });
  });
});
