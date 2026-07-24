/**
 * RefuseReceiveModal 交互测试。
 *
 * 覆盖：
 *   - note 长度 < 10 → 报错，不调 API
 *   - note 合法但未勾选二次确认 → 报错，不调 API
 *   - 提交按钮未勾选确认时应 disabled
 *   - happy path：note ≥ 10 + 勾选确认 → refuseReceive 被调用
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

const refuseMock = vi.fn();

vi.mock("@/lib/aftersales-api", () => ({
  refuseReceive: (...args: unknown[]) => refuseMock(...args),
  approveAftersales: vi.fn(),
  rejectAftersales: vi.fn(),
  confirmReceived: vi.fn(),
  shipExchange: vi.fn(),
  addMerchantNote: vi.fn(),
  listMerchantAftersales: vi.fn(),
  getMerchantAftersales: vi.fn(),
  getAftersalesStats: vi.fn(),
}));

// MultiImageUpload 依赖上传 API；测试里桩掉避免副作用
vi.mock("@/components/ui/MultiImageUpload", () => ({
  MultiImageUpload: () => <div data-testid="mock-multi-upload" />,
}));

import { RefuseReceiveModal } from "@/components/aftersales/RefuseReceiveModal";
import type { MerchantAftersalesDetail } from "@/types/aftersales";

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

const stub = {
  id: 2001,
  aftersales_no: "AS202607230000002001",
} as const;

// ---- tests --------------------------------------------------------------

describe("RefuseReceiveModal", () => {
  beforeEach(() => {
    refuseMock.mockReset();
  });

  it("note < 10 字时报错", async () => {
    renderWithProviders(
      <RefuseReceiveModal open onClose={() => undefined} aftersales={stub} />,
    );

    fireEvent.change(screen.getByPlaceholderText(/包裹外观完好/), {
      target: { value: "非本店" }, // 3 字
    });
    // 勾选 confirm 让按钮可点，验证只挂在 note 校验
    fireEvent.click(screen.getByRole("checkbox"));

    fireEvent.click(screen.getByRole("button", { name: "确认拒收" }));

    await waitFor(() => {
      expect(
        screen.getByText(/请填写拒收原因（至少 10 字）/),
      ).toBeInTheDocument();
    });
    expect(refuseMock).not.toHaveBeenCalled();
  });

  it("未勾选二次确认时按钮 disabled，即使 note 合法", async () => {
    renderWithProviders(
      <RefuseReceiveModal open onClose={() => undefined} aftersales={stub} />,
    );

    fireEvent.change(screen.getByPlaceholderText(/包裹外观完好/), {
      target: {
        value: "包裹拆开后发现非本店商品，编号与订单不匹配",
      },
    });

    const submit = screen.getByRole("button", { name: "确认拒收" });
    expect(submit).toBeDisabled();

    fireEvent.click(submit);
    // 因 button disabled，不会触发提交
    expect(refuseMock).not.toHaveBeenCalled();
  });

  it("happy path：note ≥ 10 + 勾选确认 → refuseReceive 被调用", async () => {
    refuseMock.mockResolvedValueOnce({} as MerchantAftersalesDetail);

    renderWithProviders(
      <RefuseReceiveModal open onClose={() => undefined} aftersales={stub} />,
    );

    const note = "包裹拆开后发现内含物为二手商品，与订单不匹配";
    fireEvent.change(screen.getByPlaceholderText(/包裹外观完好/), {
      target: { value: note },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "确认拒收" }));

    await waitFor(() => {
      expect(refuseMock).toHaveBeenCalledWith(2001, {
        refuse_note: note,
        evidence_image_keys: undefined,
      });
    });
  });
});
