/**
 * 平台订单大盘列表页测试。
 *
 * 覆盖：
 * - 有权限时展示表格 + 默认查询（status=undefined 表示全部）
 * - 切换 status tab 后查询参数正确
 * - 无 read_all 权限时展示占位
 * - 空数据展示空态文案
 * - "手动触发超时扫描" 按钮在有 intervene 权限时可见
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import AdminOrdersPage from "@/app/(console)/console/orders/page";
import { ToastProvider } from "@/components/ui/Toast";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth-store";
import { AdminRole } from "@/lib/rbac";
import type { AdminOrderListItem } from "@/types/order";

// Mock next/navigation
const replaceMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/console/orders",
}));

// Mock 网络层
const listAdminOrdersMock = vi.fn();
vi.mock("@/lib/order-api", () => ({
  listAdminOrders: (...args: unknown[]) => listAdminOrdersMock(...args),
  getAdminOrder: vi.fn(),
  adminCancelOrder: vi.fn(),
  addAdminNote: vi.fn(),
  simulateLogistics: vi.fn(),
  getOrderOverview: vi.fn(),
}));

const triggerProcessTimeoutsMock = vi.fn();
vi.mock("@/lib/task-api", () => ({
  triggerProcessTimeouts: () => triggerProcessTimeoutsMock(),
}));

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <AdminOrdersPage />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

function seedRow(
  overrides: Partial<AdminOrderListItem> = {},
): AdminOrderListItem {
  return {
    id: 9001,
    order_no: "202607220000009001",
    user_id: 5001,
    user: {
      id: 5001,
      nickname: "张三",
      phone: "13800001234",
      email: "z@example.com",
    },
    shop_id: 12,
    shop: { id: 12, name: "苹果官方旗舰店" },
    status: "paid",
    subtotal_cents: 19800,
    shipping_fee_cents: 0,
    discount_cents: 0,
    total_cents: 19800,
    receiver_name: "李四",
    receiver_phone: "13900002222",
    item_count: 2,
    cancel_reason: null,
    payment_deadline_at: "2026-07-22T10:30:00Z",
    paid_at: "2026-07-22T10:05:00Z",
    shipped_at: null,
    completed_at: null,
    cancelled_at: null,
    created_at: "2026-07-22T10:00:00Z",
    updated_at: "2026-07-22T10:05:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  listAdminOrdersMock.mockReset();
  triggerProcessTimeoutsMock.mockReset();
  replaceMock.mockReset();
  useAuthStore.setState({
    status: "authenticated",
    accessToken: "acc",
    refreshToken: "ref",
    admin: {
      id: 1,
      username: "cs",
      display_name: "客服",
      role: AdminRole.CUSTOMER_SERVICE_ADMIN,
      status: "active",
      last_login_at: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    permissions: ["admin:order:read_all", "admin:order:intervene"],
    remember: true,
  });
});

describe("AdminOrdersPage", () => {
  it("无 read_all 权限时展示占位", () => {
    useAuthStore.setState({ permissions: [] });
    renderPage();
    expect(screen.getByText(/无权限访问/)).toBeInTheDocument();
  });

  it("默认查询不含 status（全部）并展示行", async () => {
    listAdminOrdersMock.mockResolvedValue({
      items: [seedRow()],
      total: 1,
      page: 1,
      size: 20,
    });

    renderPage();

    await waitFor(() => {
      expect(listAdminOrdersMock).toHaveBeenCalled();
    });
    const firstCall = listAdminOrdersMock.mock.calls[0]?.[0];
    // "all" tab 对应 undefined，避免向后端传空串
    expect(firstCall?.status).toBeUndefined();
    expect(firstCall?.page).toBe(1);
    expect(firstCall?.size).toBe(20);

    await waitFor(() => {
      expect(screen.getByText("202607220000009001")).toBeInTheDocument();
    });
    expect(screen.getByText("苹果官方旗舰店")).toBeInTheDocument();
    expect(screen.getByText("李四")).toBeInTheDocument();
  });

  it("切换到「待发货」tab 后触发新查询 status=paid", async () => {
    listAdminOrdersMock.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      size: 20,
    });

    renderPage();
    await waitFor(() => {
      expect(listAdminOrdersMock).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: "待发货" }));

    await waitFor(() => {
      const calls = listAdminOrdersMock.mock.calls;
      const last = calls[calls.length - 1]?.[0];
      expect(last?.status).toBe("paid");
    });
  });

  it("空数据展示空态文案", async () => {
    listAdminOrdersMock.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      size: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/暂无符合条件的订单/)).toBeInTheDocument();
    });
  });

  it("有 intervene 权限时手动触发超时扫描按钮可见", async () => {
    listAdminOrdersMock.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      size: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(listAdminOrdersMock).toHaveBeenCalled();
    });
    expect(
      screen.getByRole("button", { name: "手动触发超时扫描" }),
    ).toBeInTheDocument();
  });

  it("无 intervene 权限时手动触发超时扫描按钮隐藏", async () => {
    useAuthStore.setState({ permissions: ["admin:order:read_all"] });
    listAdminOrdersMock.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      size: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(listAdminOrdersMock).toHaveBeenCalled();
    });
    expect(
      screen.queryByRole("button", { name: "手动触发超时扫描" }),
    ).not.toBeInTheDocument();
  });
});
