/**
 * Admin 订单强制取消 Modal 测试。
 *
 * 覆盖：
 * - 详情页展示（authenticated + read_all）
 * - 强制取消按钮只在 pending_payment / paid 且有 intervene 权限时展示
 * - 强制取消 Modal 校验：cancel_note < 10 字符不通过
 * - 强制取消 Modal 校验：未勾选二次确认不通过
 * - 校验通过后调用 adminCancelOrder
 * - 已支付订单（paid）的强化警告文案
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AdminOrderDetailPage from "@/app/(console)/console/orders/[orderNo]/page";
import { ToastProvider } from "@/components/ui/Toast";
import { useAuthStore } from "@/lib/auth-store";
import { AdminRole } from "@/lib/rbac";
import type { AdminOrderDetail } from "@/types/order";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/console/orders/202607220000009001",
}));

const getAdminOrderMock = vi.fn();
const adminCancelOrderMock = vi.fn();
const addAdminNoteMock = vi.fn();
const simulateLogisticsMock = vi.fn();

vi.mock("@/lib/order-api", () => ({
  getAdminOrder: (...args: unknown[]) => getAdminOrderMock(...args),
  adminCancelOrder: (...args: unknown[]) => adminCancelOrderMock(...args),
  addAdminNote: (...args: unknown[]) => addAdminNoteMock(...args),
  simulateLogistics: (...args: unknown[]) => simulateLogisticsMock(...args),
  listAdminOrders: vi.fn(),
  getOrderOverview: vi.fn(),
}));

function seedDetail(
  overrides: Partial<AdminOrderDetail> = {},
): AdminOrderDetail {
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
    shop: {
      id: 12,
      name: "苹果官方旗舰店",
      contact_name: "王老板",
      contact_phone: "18800001111",
    },
    status: "paid",
    subtotal_cents: 19800,
    shipping_fee_cents: 0,
    discount_cents: 0,
    total_cents: 19800,
    receiver_name: "李四",
    receiver_phone: "13900002222",
    receiver_address: "浙江省杭州市西湖区文三路 100 号",
    item_count: 2,
    cancel_reason: null,
    payment_deadline_at: "2026-07-22T10:30:00Z",
    paid_at: "2026-07-22T10:05:00Z",
    shipped_at: null,
    completed_at: null,
    cancelled_at: null,
    created_at: "2026-07-22T10:00:00Z",
    updated_at: "2026-07-22T10:05:00Z",
    user_note: null,
    merchant_note: null,
    admin_note: null,
    shipping_carrier: null,
    tracking_no: null,
    auto_complete_at: null,
    cancel_note: null,
    idempotency_key: null,
    items: [
      {
        id: 1,
        order_id: 9001,
        sku_id: 5001,
        spu_id: 1001,
        shop_id: 12,
        spu_title: "iPhone 20 Pro",
        sku_specs: { color: "红", size: "L" },
        sku_image: null,
        unit_price_cents: 9900,
        quantity: 2,
        subtotal_cents: 19800,
        created_at: "2026-07-22T10:00:00Z",
      },
    ],
    status_history: [
      {
        id: 1,
        order_id: 9001,
        from_status: null,
        to_status: "pending_payment",
        actor_type: "user",
        actor_id: 5001,
        actor_display_name: "张三",
        note: null,
        created_at: "2026-07-22T10:00:00Z",
      },
      {
        id: 2,
        order_id: 9001,
        from_status: "pending_payment",
        to_status: "paid",
        actor_type: "user",
        actor_id: 5001,
        actor_display_name: "张三",
        note: null,
        created_at: "2026-07-22T10:05:00Z",
      },
    ],
    payment_sessions: [
      {
        id: 88001,
        order_id: 9001,
        channel: "mock_alipay",
        amount_cents: 19800,
        status: "succeeded",
        external_txn_no: "MOCK-ALIPAY-20260722-XYZ",
        failure_reason: null,
        created_at: "2026-07-22T10:03:00Z",
        updated_at: "2026-07-22T10:05:00Z",
        completed_at: "2026-07-22T10:05:00Z",
      },
    ],
    shipment_events: [],
    ...overrides,
  };
}

/**
 * 构造 React 19 `use()` 可以同步解开的 Promise。
 * React 19 会读取 promise 上的 `.status`/`.value` 快捷字段（若存在）跳过 Suspense。
 */
function readyPromise<T>(value: T): Promise<T> {
  const p = Promise.resolve(value) as Promise<T> & {
    status?: "fulfilled";
    value?: T;
  };
  p.status = "fulfilled";
  p.value = value;
  return p;
}

function renderPage(orderNo = "202607220000009001") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const paramsPromise = readyPromise({ orderNo });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <Suspense fallback={<div>loading params…</div>}>
          <AdminOrderDetailPage params={paramsPromise} />
        </Suspense>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  getAdminOrderMock.mockReset();
  adminCancelOrderMock.mockReset();
  addAdminNoteMock.mockReset();
  simulateLogisticsMock.mockReset();
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
    permissions: [
      "admin:order:read_all",
      "admin:order:intervene",
      "admin:order:add_note",
    ],
    remember: true,
  });
});

describe("Admin 强制取消订单", () => {
  it("加载详情后可见强制取消按钮（paid + intervene 权限）", async () => {
    getAdminOrderMock.mockResolvedValue(seedDetail({ status: "paid" }));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("202607220000009001")).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: "强制取消订单" }),
    ).toBeInTheDocument();
  });

  it("已发货订单不展示强制取消按钮", async () => {
    getAdminOrderMock.mockResolvedValue(seedDetail({ status: "shipped" }));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("202607220000009001")).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: "强制取消订单" }),
    ).not.toBeInTheDocument();
  });

  it("无 intervene 权限不展示强制取消按钮", async () => {
    useAuthStore.setState({ permissions: ["admin:order:read_all"] });
    getAdminOrderMock.mockResolvedValue(seedDetail({ status: "paid" }));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("202607220000009001")).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: "强制取消订单" }),
    ).not.toBeInTheDocument();
  });

  it("cancel_note < 10 字校验不通过", async () => {
    getAdminOrderMock.mockResolvedValue(seedDetail({ status: "paid" }));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("202607220000009001")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "强制取消订单" }));

    // Modal 已打开
    expect(
      screen.getByRole("dialog", { name: "强制取消订单" }),
    ).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText(/请填写详细取消原因/);
    fireEvent.change(textarea, { target: { value: "太短了" } });

    fireEvent.click(screen.getByRole("button", { name: "确认强制取消" }));

    await waitFor(() => {
      expect(screen.getByText(/原因需 ≥ 10 字符/)).toBeInTheDocument();
    });
    expect(adminCancelOrderMock).not.toHaveBeenCalled();
  });

  it("填写 ≥10 字但未勾选二次确认时不通过", async () => {
    getAdminOrderMock.mockResolvedValue(seedDetail({ status: "paid" }));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("202607220000009001")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "强制取消订单" }));

    const textarea = screen.getByPlaceholderText(/请填写详细取消原因/);
    fireEvent.change(textarea, {
      target: {
        value: "已电话协商，确认取消并同意后续走退款流程",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "确认强制取消" }));

    await waitFor(() => {
      expect(screen.getByText(/请勾选二次确认/)).toBeInTheDocument();
    });
    expect(adminCancelOrderMock).not.toHaveBeenCalled();
  });

  it("填写 ≥10 字 + 勾选二次确认后成功调用 adminCancelOrder", async () => {
    getAdminOrderMock.mockResolvedValue(seedDetail({ status: "paid" }));
    adminCancelOrderMock.mockResolvedValue(
      seedDetail({ status: "cancelled" }),
    );

    renderPage();
    await waitFor(() => {
      expect(screen.getByText("202607220000009001")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "强制取消订单" }));

    const textarea = screen.getByPlaceholderText(/请填写详细取消原因/);
    const validNote = "已电话协商，确认取消并同意后续走退款流程";
    fireEvent.change(textarea, { target: { value: validNote } });

    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    fireEvent.click(screen.getByRole("button", { name: "确认强制取消" }));

    await waitFor(() => {
      expect(adminCancelOrderMock).toHaveBeenCalledWith(
        "202607220000009001",
        { cancel_note: validNote },
      );
    });
  });

  it("paid 状态订单强制取消 Modal 展示强化警告（钱没退给用户）", async () => {
    getAdminOrderMock.mockResolvedValue(seedDetail({ status: "paid" }));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("202607220000009001")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "强制取消订单" }));

    // 强警告文案（针对 paid）
    expect(
      screen.getByText(/该订单/, { exact: false }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/本操作不会退款/, { exact: false }),
    ).toBeInTheDocument();
  });
});
