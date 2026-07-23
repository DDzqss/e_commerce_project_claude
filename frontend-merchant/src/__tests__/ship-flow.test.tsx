/**
 * 发货 Modal 交互测试。
 *
 * 覆盖：
 *   - carrier 未选 → 报错，不调 API
 *   - tracking_no 为空 → 报错
 *   - tracking_no 格式不合法（长度 / 特殊字符）→ 报错，不调 API
 *   - 全部合法 → shipOrder 被调用，参数正确
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// ---- mocks ---------------------------------------------------------------

vi.mock("@/components/ui/Toast", async () => {
  const actual = await vi.importActual<typeof import("@/components/ui/Toast")>(
    "@/components/ui/Toast",
  );
  return {
    ...actual,
    toast: {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warning: vi.fn(),
      dismiss: vi.fn(),
    },
  };
});

const shipOrderMock = vi.fn();

vi.mock("@/lib/order-api", () => ({
  shipOrder: (...args: unknown[]) => shipOrderMock(...args),
  cancelOrder: vi.fn(),
  addMerchantNote: vi.fn(),
  listMerchantOrders: vi.fn(),
  getMerchantOrder: vi.fn(),
  getOrderStats: vi.fn(),
}));

import { ShipOrderModal } from "@/components/orders/ShipOrderModal";
import type { MerchantOrderDetail } from "@/types/order";

// ---- helpers -------------------------------------------------------------

function renderWithProviders(node: ReactNode) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={qc}>{node}</QueryClientProvider>);
}

const orderStub = {
  id: 1001,
  order_no: "202607230000001001",
  receiver_name: "张三",
} satisfies Pick<MerchantOrderDetail, "id" | "order_no" | "receiver_name">;

// ---- tests --------------------------------------------------------------

describe("ShipOrderModal", () => {
  beforeEach(() => {
    shipOrderMock.mockReset();
  });

  it("carrier 未选时报错，不调用 API", async () => {
    renderWithProviders(
      <ShipOrderModal open onClose={() => undefined} order={orderStub} />,
    );

    fireEvent.change(screen.getByPlaceholderText("请输入快递单号"), {
      target: { value: "SF1234567890" },
    });
    fireEvent.click(screen.getByRole("button", { name: "确认发货" }));

    await waitFor(() => {
      expect(screen.getByText("请先选择快递公司")).toBeInTheDocument();
    });
    expect(shipOrderMock).not.toHaveBeenCalled();
  });

  it("tracking_no 为空时报错", async () => {
    renderWithProviders(
      <ShipOrderModal open onClose={() => undefined} order={orderStub} />,
    );

    fireEvent.change(screen.getByLabelText(/快递公司/), {
      target: { value: "SF" },
    });
    fireEvent.click(screen.getByRole("button", { name: "确认发货" }));

    await waitFor(() => {
      expect(screen.getByText("请输入快递单号")).toBeInTheDocument();
    });
    expect(shipOrderMock).not.toHaveBeenCalled();
  });

  it("tracking_no 太短时报错", async () => {
    renderWithProviders(
      <ShipOrderModal open onClose={() => undefined} order={orderStub} />,
    );

    fireEvent.change(screen.getByLabelText(/快递公司/), {
      target: { value: "SF" },
    });
    fireEvent.change(screen.getByPlaceholderText("请输入快递单号"), {
      target: { value: "SF12" }, // 4 chars
    });
    fireEvent.click(screen.getByRole("button", { name: "确认发货" }));

    await waitFor(() => {
      expect(
        screen.getByText(/6-30 位字母\/数字组合/),
      ).toBeInTheDocument();
    });
    expect(shipOrderMock).not.toHaveBeenCalled();
  });

  it("tracking_no 含非法字符时报错", async () => {
    renderWithProviders(
      <ShipOrderModal open onClose={() => undefined} order={orderStub} />,
    );

    fireEvent.change(screen.getByLabelText(/快递公司/), {
      target: { value: "SF" },
    });
    fireEvent.change(screen.getByPlaceholderText("请输入快递单号"), {
      target: { value: "SF-123-456!" }, // 含 "-" 和 "!"
    });
    fireEvent.click(screen.getByRole("button", { name: "确认发货" }));

    await waitFor(() => {
      expect(
        screen.getByText(/6-30 位字母\/数字组合/),
      ).toBeInTheDocument();
    });
    expect(shipOrderMock).not.toHaveBeenCalled();
  });

  it("happy path：合法输入调 shipOrder 并传对参数", async () => {
    shipOrderMock.mockResolvedValueOnce({} as MerchantOrderDetail);

    const onClose = vi.fn();
    renderWithProviders(
      <ShipOrderModal open onClose={onClose} order={orderStub} />,
    );

    fireEvent.change(screen.getByLabelText(/快递公司/), {
      target: { value: "YTO" },
    });
    fireEvent.change(screen.getByPlaceholderText("请输入快递单号"), {
      target: { value: "YT9876543210" },
    });

    fireEvent.click(screen.getByRole("button", { name: "确认发货" }));

    await waitFor(() => {
      expect(shipOrderMock).toHaveBeenCalledWith(1001, {
        carrier: "YTO",
        tracking_no: "YT9876543210",
      });
    });
  });
});
