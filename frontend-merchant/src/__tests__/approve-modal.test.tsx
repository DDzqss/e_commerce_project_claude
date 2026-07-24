/**
 * ApproveModal 交互测试。
 *
 * 覆盖：
 *   - actual_refund_cents 大于用户申请值 → 报错，不调 API
 *   - RETURN_REFUND 未填 return_address → 报错，不调 API
 *   - REFUND_ONLY 不要求 return_address，合法输入即调 API
 *   - happy path：金额减小 + 合法 return_address → approve 被调用参数正确
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

const approveMock = vi.fn();

vi.mock("@/lib/aftersales-api", () => ({
  approveAftersales: (...args: unknown[]) => approveMock(...args),
  rejectAftersales: vi.fn(),
  confirmReceived: vi.fn(),
  refuseReceive: vi.fn(),
  shipExchange: vi.fn(),
  addMerchantNote: vi.fn(),
  listMerchantAftersales: vi.fn(),
  getMerchantAftersales: vi.fn(),
  getAftersalesStats: vi.fn(),
}));

import { ApproveModal } from "@/components/aftersales/ApproveModal";
import {
  AftersalesType,
  type MerchantAftersalesDetail,
} from "@/types/aftersales";

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

const returnRefundStub = {
  id: 2001,
  aftersales_no: "AS202607230000002001",
  type: AftersalesType.ReturnRefund,
  refund_amount_cents: 39600, // ¥396.00
} as const;

const refundOnlyStub = {
  id: 2002,
  aftersales_no: "AS202607230000002002",
  type: AftersalesType.RefundOnly,
  refund_amount_cents: 12000, // ¥120.00
} as const;

// ---- tests --------------------------------------------------------------

describe("ApproveModal", () => {
  beforeEach(() => {
    approveMock.mockReset();
  });

  it("actual_refund > 用户申请值时报错，不调 API", async () => {
    renderWithProviders(
      <ApproveModal
        open
        onClose={() => undefined}
        aftersales={returnRefundStub}
      />,
    );

    // 默认预填申请值；输入更大数字 500.00 元
    const priceInput = screen.getByPlaceholderText("0.00") as HTMLInputElement;
    fireEvent.change(priceInput, { target: { value: "500.00" } });

    // 补一个合法的 return_address（≥ 10 字），单独验证金额校验
    const address = screen.getByPlaceholderText(/浙江省杭州市/);
    fireEvent.change(address, {
      target: { value: "浙江省杭州市西湖区某某路 88 号" },
    });

    fireEvent.click(screen.getByRole("button", { name: "确认同意" }));

    await waitFor(() => {
      expect(
        screen.getByText(/不能高于用户申请的 ¥396\.00/),
      ).toBeInTheDocument();
    });
    expect(approveMock).not.toHaveBeenCalled();
  });

  it("RETURN_REFUND 未填 return_address 时报错", async () => {
    renderWithProviders(
      <ApproveModal
        open
        onClose={() => undefined}
        aftersales={returnRefundStub}
      />,
    );

    // 金额保留默认（等于申请值），只清空地址
    fireEvent.click(screen.getByRole("button", { name: "确认同意" }));

    await waitFor(() => {
      expect(screen.getByText(/退货地址不少于 10 字/)).toBeInTheDocument();
    });
    expect(approveMock).not.toHaveBeenCalled();
  });

  it("REFUND_ONLY 不要求 return_address，合法输入即调 API", async () => {
    approveMock.mockResolvedValueOnce({} as MerchantAftersalesDetail);

    renderWithProviders(
      <ApproveModal
        open
        onClose={() => undefined}
        aftersales={refundOnlyStub}
      />,
    );

    // 不应出现退货地址字段
    expect(screen.queryByLabelText(/退货地址/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "确认同意" }));

    await waitFor(() => {
      expect(approveMock).toHaveBeenCalledWith(2002, {
        actual_refund_cents: 12000,
        return_address: undefined,
        review_note: undefined,
      });
    });
  });

  it("happy path：金额减小 + 合法地址 → approve 被调用", async () => {
    approveMock.mockResolvedValueOnce({} as MerchantAftersalesDetail);

    const onClose = vi.fn();
    renderWithProviders(
      <ApproveModal
        open
        onClose={onClose}
        aftersales={returnRefundStub}
      />,
    );

    const priceInput = screen.getByPlaceholderText("0.00") as HTMLInputElement;
    fireEvent.change(priceInput, { target: { value: "300.00" } });

    fireEvent.change(screen.getByPlaceholderText(/浙江省杭州市/), {
      target: { value: "浙江省杭州市西湖区文三路 100 号仓库" },
    });

    fireEvent.click(screen.getByRole("button", { name: "确认同意" }));

    await waitFor(() => {
      expect(approveMock).toHaveBeenCalledWith(2001, {
        actual_refund_cents: 30000,
        return_address: "浙江省杭州市西湖区文三路 100 号仓库",
        review_note: undefined,
      });
    });
  });
});
