import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import DetailPage from "@/app/aftersales/[id]/page";
import { useAuthStore } from "@/lib/auth-store";
import * as aftersalesApi from "@/lib/aftersales-api";
import {
  AftersalesStatus,
  AftersalesType,
  type AftersalesDetail,
} from "@/types/aftersales";

const pushMock = vi.fn();
let idParam = "42";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, back: vi.fn() }),
  useParams: () => ({ id: idParam }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => `/aftersales/${idParam}`,
}));

function wrap(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function makeDetail(overrides: Partial<AftersalesDetail>): AftersalesDetail {
  const base: AftersalesDetail = {
    id: 42,
    aftersales_no: "AS202607230000001234",
    order_id: 100,
    order_no: "ORDER-1",
    shop: { id: 12, name: "小李杂货铺" },
    type: AftersalesType.ReturnRefund,
    status: AftersalesStatus.PendingMerchantReview,
    reason_category: "quality_issue",
    refund_amount_cents: 20000,
    actual_refund_cents: null,
    merchant_review_deadline: null,
    created_at: "2026-07-23T00:00:00Z",
    updated_at: "2026-07-23T00:00:00Z",
    items: [
      {
        id: 900,
        aftersales_id: 42,
        order_item_id: 5001,
        quantity: 1,
        refund_amount_cents: 20000,
        spu_title: "商品 A",
        sku_specs: { color: "红" },
        sku_image: null,
        unit_price_cents: 20000,
        created_at: "2026-07-23T00:00:00Z",
      },
    ],
    items_count: 1,
    user_id: 1,
    shop_id: 12,
    reason_note: "商品有质量问题",
    merchant_reviewed_at: null,
    merchant_review_note: null,
    return_address: null,
    return_carrier: null,
    return_tracking_no: null,
    return_shipped_at: null,
    return_ship_deadline: null,
    merchant_received_at: null,
    merchant_receive_deadline: null,
    merchant_refuse_receive: false,
    merchant_refuse_note: null,
    exchange_carrier: null,
    exchange_tracking_no: null,
    exchange_shipped_at: null,
    exchange_confirm_deadline: null,
    exchange_confirmed_at: null,
    escalated_at: null,
    escalation_reason: null,
    arbitrator_admin_id: null,
    arbitrated_at: null,
    arbitration_conclusion: null,
    arbitration_outcome: null,
    refunded_at: null,
    refund_txn_no: null,
    closed_at: null,
    close_reason: null,
    nudge_count: 0,
    last_nudged_at: null,
    appeal_count: 0,
    status_history: [],
    evidences: [],
    messages: [],
  };
  return { ...base, ...overrides };
}

beforeEach(() => {
  pushMock.mockReset();
  idParam = "42";
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

describe("AftersalesDetailPage 状态到按钮映射", () => {
  it("pending_merchant_review → 撤销 + 催办 均可见", async () => {
    vi.spyOn(aftersalesApi, "getAftersales").mockResolvedValue(
      makeDetail({ status: AftersalesStatus.PendingMerchantReview }),
    );
    render(wrap(<DetailPage />));
    await waitFor(() => {
      expect(screen.getByTestId("btn-cancel")).toBeInTheDocument();
    });
    expect(screen.getByTestId("btn-nudge")).toBeInTheDocument();
    expect(screen.queryByTestId("btn-appeal")).not.toBeInTheDocument();
    expect(screen.queryByTestId("btn-tracking")).not.toBeInTheDocument();
  });

  it("merchant_rejected → 撤销 + 申诉可见", async () => {
    vi.spyOn(aftersalesApi, "getAftersales").mockResolvedValue(
      makeDetail({
        status: AftersalesStatus.MerchantRejected,
        appeal_count: 0,
      }),
    );
    render(wrap(<DetailPage />));
    await waitFor(() => {
      expect(screen.getByTestId("btn-cancel")).toBeInTheDocument();
    });
    expect(screen.getByTestId("btn-appeal")).toBeInTheDocument();
    expect(screen.queryByTestId("btn-nudge")).not.toBeInTheDocument();
  });

  it("已申诉 1 次 + merchant_rejected → 申诉按钮消失（appeal_count>=1）", async () => {
    vi.spyOn(aftersalesApi, "getAftersales").mockResolvedValue(
      makeDetail({
        status: AftersalesStatus.MerchantRejected,
        appeal_count: 1,
      }),
    );
    render(wrap(<DetailPage />));
    await waitFor(() => {
      expect(screen.getByTestId("btn-cancel")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("btn-appeal")).not.toBeInTheDocument();
  });

  it("merchant_agreed_waiting_return → 撤销 + 回填快递可见", async () => {
    vi.spyOn(aftersalesApi, "getAftersales").mockResolvedValue(
      makeDetail({
        status: AftersalesStatus.MerchantAgreedWaitingReturn,
        return_address: "杭州西湖区某街 1 号",
      }),
    );
    render(wrap(<DetailPage />));
    await waitFor(() => {
      expect(screen.getByTestId("btn-cancel")).toBeInTheDocument();
    });
    expect(screen.getByTestId("btn-tracking")).toBeInTheDocument();
    expect(screen.getByText("杭州西湖区某街 1 号")).toBeInTheDocument();
  });

  it("exchange_shipped_waiting_receive → 只显示确认换货", async () => {
    vi.spyOn(aftersalesApi, "getAftersales").mockResolvedValue(
      makeDetail({
        status: AftersalesStatus.ExchangeShippedWaitingReceive,
        type: AftersalesType.Exchange,
      }),
    );
    render(wrap(<DetailPage />));
    await waitFor(() => {
      expect(screen.getByTestId("btn-confirm-exchange")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("btn-cancel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("btn-tracking")).not.toBeInTheDocument();
  });

  it("completed_refunded 终态 → 无操作按钮", async () => {
    vi.spyOn(aftersalesApi, "getAftersales").mockResolvedValue(
      makeDetail({
        status: AftersalesStatus.CompletedRefunded,
        actual_refund_cents: 20000,
        refund_txn_no: "REFUND-abcdef",
        refunded_at: "2026-07-24T00:00:00Z",
      }),
    );
    render(wrap(<DetailPage />));
    await waitFor(() => {
      expect(screen.getByText("已退款")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("btn-cancel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("btn-nudge")).not.toBeInTheDocument();
    expect(screen.queryByTestId("btn-appeal")).not.toBeInTheDocument();
    expect(screen.queryByTestId("btn-tracking")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("btn-confirm-exchange"),
    ).not.toBeInTheDocument();
  });
});
