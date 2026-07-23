"use client";

import { useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Price } from "@/components/ui/Price";
import { toast } from "@/components/ui/Toast";
import {
  usePaymentSession,
  useInvalidatePaymentSession,
} from "@/hooks/usePaymentSession";
import { useInvalidateOrders } from "@/hooks/useOrders";
import { mockPayFail, mockPaySucceed } from "@/lib/payment-api";
import { ApiError } from "@/lib/api";
import { messageForCode } from "@/types/errors";
import { PAYMENT_CHANNEL_LABEL } from "@/types/order";

export default function MockPaymentPage() {
  return (
    <RequireAuth>
      <div className="min-h-screen bg-neutral-50">
        <SiteHeader />
        <MockPaymentContent />
      </div>
    </RequireAuth>
  );
}

function MockPaymentContent() {
  const params = useParams<{ sessionId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = Number(params.sessionId);
  const orderNo = searchParams.get("order") ?? "";
  const invalidatePayment = useInvalidatePaymentSession(sessionId);
  const invalidateOrders = useInvalidateOrders();

  const { data: session, isLoading, isError } = usePaymentSession(
    Number.isFinite(sessionId) ? sessionId : null,
  );
  const [processing, setProcessing] = useState<"succeed" | "fail" | null>(null);

  const handleSucceed = async () => {
    setProcessing("succeed");
    try {
      const order = await mockPaySucceed(sessionId);
      toast.success("支付成功！");
      invalidatePayment();
      invalidateOrders.all();
      router.push(`/orders/${order.order_no}`);
    } catch (e) {
      const msg =
        e instanceof ApiError ? messageForCode(e.code, e.message) : "支付失败";
      toast.error(msg);
    } finally {
      setProcessing(null);
    }
  };

  const handleFail = async () => {
    setProcessing("fail");
    try {
      await mockPayFail(sessionId);
      toast.info("已模拟支付失败，可返回订单重试");
      invalidatePayment();
      invalidateOrders.all();
      if (orderNo) {
        router.push(`/orders/${orderNo}`);
      } else {
        router.push("/orders?status=pending_payment");
      }
    } catch (e) {
      const msg =
        e instanceof ApiError ? messageForCode(e.code, e.message) : "操作失败";
      toast.error(msg);
    } finally {
      setProcessing(null);
    }
  };

  return (
    <main className="mx-auto max-w-lg px-6 py-8">
      {/* 醒目提示：非真实支付 */}
      <div
        role="alert"
        className="mb-4 rounded-md border border-[color:var(--color-primary)] bg-[color:var(--color-primary-50)] px-4 py-3 text-center text-base font-semibold text-[color:var(--color-primary)]"
      >
        模拟支付 · 请勿真实付款
      </div>

      {isLoading && <Skeleton className="h-64 w-full" />}
      {isError && (
        <div className="rounded-md border border-[color:var(--color-primary-200)] bg-[color:var(--color-primary-50)] px-4 py-3 text-sm text-[color:var(--color-primary-700)]">
          支付会话加载失败或已过期
        </div>
      )}

      {session && (
        <div className="rounded-lg border border-neutral-200 bg-white p-5">
          <div className="mb-4 text-center">
            <div className="text-xs text-neutral-500">支付金额（分）</div>
            <div className="mt-1">
              <Price cents={session.amount_cents} size="lg" />
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-y-3 text-sm">
            <dt className="text-neutral-500">订单号</dt>
            <dd className="text-right text-neutral-800">{orderNo || "-"}</dd>

            <dt className="text-neutral-500">支付渠道</dt>
            <dd className="text-right text-neutral-800">
              {PAYMENT_CHANNEL_LABEL[session.channel] ?? session.channel}
            </dd>

            <dt className="text-neutral-500">支付状态</dt>
            <dd className="text-right text-neutral-800">
              {sessionStatusLabel(session.status)}
            </dd>

            {session.expires_at && (
              <>
                <dt className="text-neutral-500">到期时间</dt>
                <dd className="text-right text-neutral-800">
                  {new Date(session.expires_at).toLocaleString("zh-CN")}
                </dd>
              </>
            )}
          </dl>

          {session.status === "pending" ? (
            <div className="mt-6 flex flex-col gap-3">
              <Button
                onClick={handleSucceed}
                loading={processing === "succeed"}
                disabled={processing !== null}
                data-testid="mock-pay-succeed"
                size="lg"
              >
                模拟支付成功
              </Button>
              <Button
                onClick={handleFail}
                loading={processing === "fail"}
                disabled={processing !== null}
                variant="secondary"
                data-testid="mock-pay-fail"
                size="lg"
              >
                模拟支付失败
              </Button>
            </div>
          ) : (
            <div className="mt-6 text-center text-sm text-neutral-500">
              该支付已{sessionStatusLabel(session.status)}
              <div className="mt-3">
                {orderNo && (
                  <Button onClick={() => router.push(`/orders/${orderNo}`)}>
                    返回订单
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <p className="mt-4 text-center text-xs text-neutral-400">
        本页面为项目演示用的模拟支付，不会真实扣款。
      </p>
    </main>
  );
}

function sessionStatusLabel(s: string): string {
  switch (s) {
    case "pending":
      return "待支付";
    case "succeeded":
      return "已支付";
    case "failed":
      return "已失败";
    case "expired":
      return "已过期";
    default:
      return s;
  }
}
