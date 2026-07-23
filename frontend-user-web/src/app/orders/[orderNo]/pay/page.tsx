"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Price } from "@/components/ui/Price";
import { toast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { useOrder } from "@/hooks/useOrders";
import { createPaymentSession } from "@/lib/payment-api";
import {
  clearIdempotencyKey,
  getOrCreateIdempotencyKey,
} from "@/lib/idempotency";
import { ApiError } from "@/lib/api";
import { ErrorCode, messageForCode } from "@/types/errors";
import {
  OrderStatus,
  PAYMENT_CHANNEL_LABEL,
  type PaymentChannel,
} from "@/types/order";

const CHANNELS: { value: PaymentChannel; icon: string; hint: string }[] = [
  { value: "mock_alipay", icon: "支", hint: "推荐使用" },
  { value: "mock_wechat", icon: "微", hint: "" },
  { value: "mock_bank", icon: "行", hint: "" },
];

export default function PayPage() {
  return (
    <RequireAuth>
      <div className="min-h-screen bg-neutral-50">
        <SiteHeader />
        <PayContent />
      </div>
    </RequireAuth>
  );
}

function PayContent() {
  const params = useParams<{ orderNo: string }>();
  const router = useRouter();
  const orderNo = params.orderNo;
  const { data: order, isLoading, isError } = useOrder(orderNo);
  const [choosing, setChoosing] = useState<PaymentChannel | null>(null);

  const idemScope = `pay:${orderNo}`;

  const startPay = async (channel: PaymentChannel) => {
    if (!order) return;
    setChoosing(channel);
    const idem = getOrCreateIdempotencyKey(idemScope);
    try {
      const session = await createPaymentSession(
        order.order_no,
        { channel },
        idem,
      );
      // 创建成功后不清 key —— 若用户在支付页失败重试可用同一 pending session（后端也会去重）
      // 但既然后端保证同 (order, pending) UNIQUE，我们生成新一次也会返回同一 session；
      // 为了避免长期堆积，仍然在跳完页面后清理。
      clearIdempotencyKey(idemScope);
      router.push(`/mock-payment/${session.session_id}?order=${orderNo}`);
    } catch (e) {
      if (e instanceof ApiError) {
        toast.error(messageForCode(e.code, e.message));
        if (e.code === ErrorCode.OrderPaymentDeadlinePassed) {
          router.push(`/orders/${orderNo}`);
        }
      } else {
        toast.error("发起支付失败，请重试");
      }
    } finally {
      setChoosing(null);
    }
  };

  return (
    <main className="mx-auto max-w-lg px-6 py-8">
      <h1 className="mb-2 text-xl font-semibold text-neutral-900">选择支付方式</h1>
      <p className="mb-4 text-xs text-neutral-500">
        订单号 {orderNo}
      </p>

      {isLoading && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {isError && (
        <div className="rounded-md border border-[color:var(--color-primary-200)] bg-[color:var(--color-primary-50)] px-4 py-3 text-sm text-[color:var(--color-primary-700)]">
          订单加载失败，请返回订单列表重试
        </div>
      )}

      {order && (
        <>
          <div className="mb-4 rounded-lg border border-neutral-200 bg-white p-4">
            <div className="text-sm text-neutral-600">
              待支付金额
            </div>
            <div className="mt-1">
              <Price cents={order.total_cents} size="lg" />
            </div>
            {order.payment_deadline_at && (
              <p className="mt-1 text-xs text-neutral-500">
                请在 {new Date(order.payment_deadline_at).toLocaleString("zh-CN")}{" "}
                前完成支付
              </p>
            )}
          </div>

          {order.status !== OrderStatus.PendingPayment ? (
            <div className="rounded-md border border-neutral-200 bg-white p-6 text-center text-sm text-neutral-600">
              订单状态为「
              {order.status}
              」，不需要支付
              <div className="mt-4">
                <Button onClick={() => router.push(`/orders/${orderNo}`)}>
                  查看订单
                </Button>
              </div>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {CHANNELS.map((c) => (
                <li key={c.value}>
                  <button
                    type="button"
                    onClick={() => startPay(c.value)}
                    disabled={choosing !== null}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg border border-neutral-200 bg-white p-4 text-left transition",
                      choosing === c.value
                        ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary-50)]"
                        : "hover:border-[color:var(--color-primary)]",
                    )}
                    data-testid={`channel-${c.value}`}
                  >
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-primary-100)] text-[color:var(--color-primary)]">
                      {c.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-neutral-900">
                        {PAYMENT_CHANNEL_LABEL[c.value]}
                      </div>
                      {c.hint && (
                        <div className="text-xs text-neutral-500">{c.hint}</div>
                      )}
                    </div>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden
                    >
                      <path
                        d="M9 6l6 6-6 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
