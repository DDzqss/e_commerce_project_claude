/**
 * 商家售后单列表页测试。
 *
 * 覆盖：
 *   - 默认加载：默认 status=pending_merchant_review 传给 API
 *   - "只看即将超时"复选框：勾选后 overdue_soon=true 被下发
 *   - Tab 切换到"待收货"重新查询
 *
 * 策略：mock `@/lib/aftersales-api` 让 hook 直接返回受控数据。
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import type { PagedOut } from "@/types/api";
import {
  AftersalesStatus,
  AftersalesType,
  type MerchantAftersalesListItem,
  type MerchantAftersalesStats,
} from "@/types/aftersales";

// ---- mocks ---------------------------------------------------------------

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/aftersales",
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

vi.mock("@/lib/aftersales-api", () => ({
  listMerchantAftersales: (q: unknown) => listMock(q),
  getMerchantAftersales: vi.fn(),
  approveAftersales: vi.fn(),
  rejectAftersales: vi.fn(),
  confirmReceived: vi.fn(),
  refuseReceive: vi.fn(),
  shipExchange: vi.fn(),
  addMerchantNote: vi.fn(),
  getAftersalesStats: () => statsMock(),
}));

// 延后 import，确保 mock 生效
import AftersalesListPage from "@/app/(dashboard)/aftersales/page";

// ---- fixtures ------------------------------------------------------------

const stats: MerchantAftersalesStats = {
  pending_review_count: 5,
  overdue_soon_count: 2,
  waiting_receive_count: 3,
  waiting_ship_count: 1,
  completed_this_month_count: 7,
};

function makeItem(
  overrides: Partial<MerchantAftersalesListItem> = {},
): MerchantAftersalesListItem {
  return {
    id: 2001,
    aftersales_no: "AS202607230000002001",
    order_id: 1001,
    order_no: "202607230000001001",
    user_id: 500,
    user_display_name: "张三",
    shop_id: 12,
    type: AftersalesType.ReturnRefund,
    status: AftersalesStatus.PendingMerchantReview,
    reason_category: "quality_issue",
    reason_note: "商品有划痕",
    refund_amount_cents: 39600,
    actual_refund_cents: null,
    items_count: 2,
    // 剩余 30 小时 → normal（绿）
    merchant_review_deadline: new Date(
      Date.now() + 30 * 60 * 60 * 1000,
    ).toISOString(),
    merchant_reviewed_at: null,
    escalated_at: null,
    created_at: "2026-07-22T08:00:00Z",
    updated_at: "2026-07-22T08:00:00Z",
    ...overrides,
  };
}

function pagedPending(): PagedOut<MerchantAftersalesListItem> {
  return {
    items: [
      makeItem(),
      makeItem({ id: 2002, aftersales_no: "AS202607230000002002" }),
    ],
    total: 25, // 25 条 → 2 页
    page: 1,
    size: 20,
  };
}

function pagedWaitingReceive(): PagedOut<MerchantAftersalesListItem> {
  return {
    items: [
      makeItem({
        id: 3001,
        aftersales_no: "AS202607200000003001",
        status: AftersalesStatus.ReturnShippedWaitingReceive,
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

describe("AftersalesListPage", () => {
  beforeEach(() => {
    listMock.mockReset();
    statsMock.mockReset();
    statsMock.mockResolvedValue(stats);
  });

  it("默认 status=pending_merchant_review 传给后端", async () => {
    listMock.mockResolvedValue(pagedPending());

    renderWithProviders(<AftersalesListPage />);

    await waitFor(() => {
      expect(listMock).toHaveBeenCalled();
    });

    const firstCall = listMock.mock.calls[0]?.[0] as {
      status?: string;
      page?: number;
    };
    expect(firstCall.status).toBe(AftersalesStatus.PendingMerchantReview);
    expect(firstCall.page).toBe(1);

    await waitFor(() => {
      expect(screen.getByText("AS202607230000002001")).toBeInTheDocument();
    });
  });

  it("勾选 '只看即将超时' 后 overdue_soon=true 被下发", async () => {
    listMock.mockResolvedValueOnce(pagedPending());

    renderWithProviders(<AftersalesListPage />);

    await waitFor(() => {
      expect(listMock).toHaveBeenCalledTimes(1);
    });

    listMock.mockResolvedValueOnce(pagedPending());
    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    await waitFor(() => {
      const lastCall = listMock.mock.calls.at(-1)?.[0] as {
        overdue_soon?: boolean;
      };
      expect(lastCall.overdue_soon).toBe(true);
    });

    // 顶部醒目提示应该出现
    expect(
      screen.getByText(/审核 deadline < 24 小时/),
    ).toBeInTheDocument();
  });

  it("切换到 '待收货' tab 后按对应 status 查询", async () => {
    listMock.mockResolvedValueOnce(pagedPending());

    renderWithProviders(<AftersalesListPage />);

    await waitFor(() => {
      expect(listMock).toHaveBeenCalledTimes(1);
    });

    listMock.mockResolvedValueOnce(pagedWaitingReceive());
    fireEvent.click(screen.getByRole("button", { name: "待收货" }));

    await waitFor(() => {
      const lastCall = listMock.mock.calls.at(-1)?.[0] as { status?: string };
      expect(lastCall.status).toBe(
        AftersalesStatus.ReturnShippedWaitingReceive,
      );
    });
  });
});
