import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import ApplyPage from "@/app/orders/[orderNo]/aftersales/new/page";
import { useAuthStore } from "@/lib/auth-store";
import * as orderApi from "@/lib/order-api";
import * as aftersalesApi from "@/lib/aftersales-api";
import {
  AftersalesStatus,
  AftersalesType,
} from "@/types/aftersales";
import type { OrderDetail } from "@/types/order";
import { OrderStatus } from "@/types/order";

/** 用 fixed order_no 走参数。 */
const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, back: vi.fn() }),
  useParams: () => ({ orderNo: "AS-ORDER-1" }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/orders/AS-ORDER-1/aftersales/new",
}));

function wrap(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function makeOrder(status: OrderStatus): OrderDetail {
  return {
    id: 100,
    order_no: "AS-ORDER-1",
    shop: { id: 12, name: "小李杂货铺" },
    status,
    subtotal_cents: 20000,
    shipping_fee_cents: 0,
    discount_cents: 0,
    total_cents: 20000,
    payment_deadline_at: null,
    paid_at: "2026-07-01T00:00:00Z",
    shipped_at: null,
    completed_at: null,
    cancelled_at: null,
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
    items: [
      {
        id: 5001,
        order_id: 100,
        sku_id: 1001,
        spu_id: 800,
        shop_id: 12,
        spu_title: "商品 A",
        sku_specs: { color: "红" },
        sku_image: null,
        unit_price_cents: 10000,
        quantity: 2,
        subtotal_cents: 20000,
        created_at: "2026-07-01T00:00:00Z",
      },
    ],
    items_count: 1,
    receiver_name: "买家",
    receiver_phone: "13800001234",
    receiver_address: "杭州西湖区某街 1 号",
    user_note: null,
    merchant_note: null,
    cancel_reason: null,
    cancel_note: null,
    shipping_carrier: null,
    tracking_no: null,
    auto_complete_at: null,
    status_history: [],
    payment_sessions: [],
    shipment_events: [],
  };
}

beforeEach(() => {
  pushMock.mockReset();
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

describe("AftersalesApplyPage 类型联动", () => {
  it("paid 订单：仅显示仅退款选项", async () => {
    vi.spyOn(orderApi, "getOrder").mockResolvedValue(
      makeOrder(OrderStatus.Paid),
    );

    render(wrap(<ApplyPage />));
    await waitFor(() => {
      expect(screen.getByTestId("type-picker")).toBeInTheDocument();
    });
    expect(
      screen.getByTestId(`type-option-${AftersalesType.RefundOnly}`),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId(`type-option-${AftersalesType.ReturnRefund}`),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId(`type-option-${AftersalesType.Exchange}`),
    ).not.toBeInTheDocument();
  });

  it("shipped 订单：三种类型都可选", async () => {
    vi.spyOn(orderApi, "getOrder").mockResolvedValue(
      makeOrder(OrderStatus.Shipped),
    );

    render(wrap(<ApplyPage />));
    await waitFor(() => {
      expect(
        screen.getByTestId(`type-option-${AftersalesType.RefundOnly}`),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByTestId(`type-option-${AftersalesType.ReturnRefund}`),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(`type-option-${AftersalesType.Exchange}`),
    ).toBeInTheDocument();
  });

  it("completed 订单：只有 退货退款 / 换货 可选", async () => {
    vi.spyOn(orderApi, "getOrder").mockResolvedValue(
      makeOrder(OrderStatus.Completed),
    );

    render(wrap(<ApplyPage />));
    await waitFor(() => {
      expect(
        screen.getByTestId(`type-option-${AftersalesType.ReturnRefund}`),
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByTestId(`type-option-${AftersalesType.RefundOnly}`),
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId(`type-option-${AftersalesType.Exchange}`),
    ).toBeInTheDocument();
  });

  it("cancelled 订单：不允许发起", async () => {
    vi.spyOn(orderApi, "getOrder").mockResolvedValue(
      makeOrder(OrderStatus.Cancelled),
    );

    render(wrap(<ApplyPage />));
    await waitFor(() => {
      expect(screen.getByText(/当前订单不支持发起售后/)).toBeInTheDocument();
    });
  });
});

describe("AftersalesApplyPage 表单校验与提交", () => {
  it("说明少于 10 字提交时报错，不发请求", async () => {
    vi.spyOn(orderApi, "getOrder").mockResolvedValue(
      makeOrder(OrderStatus.Shipped),
    );
    const createSpy = vi.spyOn(aftersalesApi, "createAftersales");

    render(wrap(<ApplyPage />));
    await waitFor(() => {
      expect(screen.getByTestId("type-picker")).toBeInTheDocument();
    });

    // 未选原因 & 未填说明
    fireEvent.click(screen.getByTestId("submit-aftersales"));
    await waitFor(() => {
      expect(screen.getByText(/请选择售后原因/)).toBeInTheDocument();
    });
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("金额超过最大可退时给出错误", async () => {
    vi.spyOn(orderApi, "getOrder").mockResolvedValue(
      makeOrder(OrderStatus.Shipped),
    );
    const createSpy = vi.spyOn(aftersalesApi, "createAftersales");

    render(wrap(<ApplyPage />));
    // 等待订单加载完成 + 各 effect settle：max 金额稳定为 ¥200.00
    await waitFor(() => {
      expect(screen.getByText(/最多可退\s*¥200\.00/)).toBeInTheDocument();
    });

    const amount = screen.getByTestId("refund-amount") as HTMLInputElement;
    fireEvent.change(amount, { target: { value: "999" } });
    fireEvent.click(screen.getByTestId(`reason-quality_issue`));
    fireEvent.change(screen.getByTestId("reason-note"), {
      target: { value: "商品收到时外壳有明显裂痕。" },
    });

    fireEvent.click(screen.getByTestId("submit-aftersales"));
    await waitFor(() => {
      expect(screen.getByTestId("refund-error")).toBeInTheDocument();
    });
    expect(screen.getByTestId("refund-error").textContent).toMatch(
      /退款金额不能超过/,
    );
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("填齐所有必填 → 调用 createAftersales 并跳详情", async () => {
    vi.spyOn(orderApi, "getOrder").mockResolvedValue(
      makeOrder(OrderStatus.Shipped),
    );
    const createSpy = vi
      .spyOn(aftersalesApi, "createAftersales")
      .mockResolvedValue({
        id: 42,
        aftersales_no: "AS20260723",
        order_id: 100,
        order_no: "AS-ORDER-1",
        shop: { id: 12, name: "小李杂货铺" },
        type: AftersalesType.RefundOnly,
        status: AftersalesStatus.PendingMerchantReview,
        reason_category: "quality_issue",
        refund_amount_cents: 20000,
        actual_refund_cents: null,
        merchant_review_deadline: null,
        created_at: "2026-07-23T00:00:00Z",
        updated_at: "2026-07-23T00:00:00Z",
        items: [],
        items_count: 0,
        user_id: 1,
        shop_id: 12,
        reason_note: "商品收到时外壳有明显裂痕。",
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
      });

    render(wrap(<ApplyPage />));
    await waitFor(() => {
      expect(screen.getByText(/最多可退\s*¥200\.00/)).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByTestId(`type-option-${AftersalesType.RefundOnly}`),
    );
    fireEvent.click(screen.getByTestId("reason-quality_issue"));
    fireEvent.change(screen.getByTestId("reason-note"), {
      target: { value: "商品收到时外壳有明显裂痕。" },
    });

    fireEvent.click(screen.getByTestId("submit-aftersales"));

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledTimes(1);
    });
    const call = createSpy.mock.calls[0];
    expect(call).toBeDefined();
    const [orderIdArg, payloadArg, idempKey] = call!;
    expect(orderIdArg).toBe(100);
    expect(payloadArg.type).toBe(AftersalesType.RefundOnly);
    expect(payloadArg.reason_category).toBe("quality_issue");
    expect(payloadArg.items[0]).toEqual({ order_item_id: 5001, quantity: 2 });
    expect(payloadArg.refund_amount_cents).toBe(20000);
    expect(typeof idempKey).toBe("string");
    expect(idempKey.length).toBeGreaterThanOrEqual(8);

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/aftersales/42");
    });
  });
});
