"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { RequireAuth } from "@/components/auth/RequireAuth";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Price, formatYuan } from "@/components/ui/Price";
import { ImageWithFallback } from "@/components/ui/ImageWithFallback";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { toast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { useOrder, useInvalidateOrders } from "@/hooks/useOrders";
import { cancelOrder, confirmReceipt } from "@/lib/order-api";
import { ApiError } from "@/lib/api";
import { messageForCode } from "@/types/errors";
import {
  ORDER_STATUS_LABEL,
  OrderStatus,
  type OrderStatusHistoryEntry,
} from "@/types/order";
import { allowedAftersalesTypes } from "@/types/aftersales";

export default function OrderDetailPage() {
  return (
    <RequireAuth>
      <div className="min-h-screen bg-neutral-50">
        <SiteHeader />
        <OrderDetailContent />
      </div>
    </RequireAuth>
  );
}

function OrderDetailContent() {
  const params = useParams<{ orderNo: string }>();
  const router = useRouter();
  const orderNo = params.orderNo;
  const { data, isLoading, isError, refetch } = useOrder(orderNo);
  const invalidate = useInvalidateOrders();

  const [cancelOpen, setCancelOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const doCancel = async () => {
    setCancelling(true);
    try {
      await cancelOrder(orderNo);
      toast.success("订单已取消");
      invalidate.all();
      setCancelOpen(false);
    } catch (e) {
      const msg =
        e instanceof ApiError ? messageForCode(e.code, e.message) : "取消失败";
      toast.error(msg);
    } finally {
      setCancelling(false);
    }
  };

  const doConfirm = async () => {
    setConfirming(true);
    try {
      await confirmReceipt(orderNo);
      toast.success("已确认收货");
      invalidate.all();
      setConfirmOpen(false);
    } catch (e) {
      const msg =
        e instanceof ApiError ? messageForCode(e.code, e.message) : "操作失败";
      toast.error(msg);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <main className="mx-auto max-w-4xl px-6 py-6 pb-24">
      {isLoading && <Skeleton className="h-64 w-full" />}
      {isError && (
        <div className="rounded-md border border-[color:var(--color-primary-200)] bg-[color:var(--color-primary-50)] px-4 py-3 text-sm text-[color:var(--color-primary-700)]">
          加载失败，
          <button
            type="button"
            className="ml-1 underline"
            onClick={() => refetch()}
          >
            重试
          </button>
        </div>
      )}

      {data && (
        <div className="flex flex-col gap-4">
          {/* 顶部 status + 主操作 */}
          <section className="rounded-lg border border-neutral-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-neutral-900">
                  {ORDER_STATUS_LABEL[data.status] ?? data.status}
                </div>
                <div className="mt-1 text-xs text-neutral-500">
                  订单号 {data.order_no}
                  <span className="mx-2">·</span>
                  下单于 {formatDateTime(data.created_at)}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {data.status === OrderStatus.PendingPayment && (
                  <>
                    <Button
                      variant="secondary"
                      onClick={() => setCancelOpen(true)}
                    >
                      取消订单
                    </Button>
                    <Link href={`/orders/${data.order_no}/pay`}>
                      <Button>立即支付</Button>
                    </Link>
                  </>
                )}
                {data.status === OrderStatus.Shipped && (
                  <>
                    <Link href={`/orders/${data.order_no}/shipment`}>
                      <Button variant="secondary">查看物流</Button>
                    </Link>
                    <Button onClick={() => setConfirmOpen(true)}>
                      确认收货
                    </Button>
                  </>
                )}
                {data.status === OrderStatus.Paid && (
                  <span className="text-sm text-neutral-500">
                    等待商家发货
                  </span>
                )}
                {data.status === OrderStatus.Completed && (
                  <>
                    <span className="text-sm text-green-700">交易完成</span>
                    <Link
                      href={`/orders/${data.order_no}/reviews/new`}
                      data-testid="btn-write-review"
                    >
                      <Button>评价商品</Button>
                    </Link>
                  </>
                )}
                {allowedAftersalesTypes(data.status).length > 0 && (
                  <Link
                    href={`/orders/${data.order_no}/aftersales/new`}
                    data-testid="btn-apply-aftersales"
                  >
                    <Button variant="secondary">申请售后</Button>
                  </Link>
                )}
              </div>
            </div>
            {data.cancel_reason && (
              <p className="mt-3 text-xs text-neutral-500">
                取消原因：{cancelReasonLabel(data.cancel_reason)}
                {data.cancel_note ? `（${data.cancel_note}）` : ""}
              </p>
            )}
          </section>

          {/* Timeline */}
          {data.status_history && data.status_history.length > 0 && (
            <section className="rounded-lg border border-neutral-200 bg-white p-5">
              <h2 className="mb-3 text-sm font-medium text-neutral-800">
                订单进度
              </h2>
              <Timeline entries={data.status_history} />
            </section>
          )}

          {/* 收货信息 */}
          <section className="rounded-lg border border-neutral-200 bg-white p-5">
            <h2 className="mb-2 text-sm font-medium text-neutral-800">
              收货信息
            </h2>
            <p className="text-sm text-neutral-900">
              {data.receiver_name}
              <span className="ml-3 text-neutral-600">
                {data.receiver_phone}
              </span>
            </p>
            <p className="mt-1 text-sm text-neutral-600">
              {data.receiver_address}
            </p>
          </section>

          {/* 商品明细 */}
          <section className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
            <header className="border-b border-neutral-100 bg-neutral-50 px-5 py-2 text-sm font-medium text-neutral-800">
              {data.shop?.name ?? "商品"}
            </header>
            <ul className="divide-y divide-neutral-100">
              {data.items.map((it) => {
                const specText = Object.values(it.sku_specs ?? {}).join(" / ");
                return (
                  <li key={it.id} className="flex items-start gap-3 px-5 py-3">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded border border-neutral-200 bg-neutral-50">
                      <ImageWithFallback
                        objectKey={it.sku_image}
                        alt={it.spu_title}
                        className="h-full w-full"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-sm text-neutral-900">
                        {it.spu_title}
                      </span>
                      {specText && (
                        <span className="text-xs text-neutral-500">
                          {specText}
                        </span>
                      )}
                      <div className="mt-1">
                        <Price cents={it.unit_price_cents} size="sm" />
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="text-neutral-500">×{it.quantity}</div>
                      <div className="mt-0.5 font-semibold text-neutral-900 tabular-nums">
                        {formatYuan(it.subtotal_cents)}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* 金额明细 */}
          <section className="rounded-lg border border-neutral-200 bg-white p-5 text-sm">
            <div className="flex justify-between py-1 text-neutral-600">
              <span>商品小计</span>
              <span>{formatYuan(data.subtotal_cents)}</span>
            </div>
            <div className="flex justify-between py-1 text-neutral-600">
              <span>运费</span>
              <span>{formatYuan(data.shipping_fee_cents)}</span>
            </div>
            {data.discount_cents > 0 && (
              <div className="flex justify-between py-1 text-neutral-600">
                <span>优惠</span>
                <span>-{formatYuan(data.discount_cents)}</span>
              </div>
            )}
            <div className="mt-2 flex justify-between border-t border-neutral-100 pt-2 text-base font-semibold text-neutral-900">
              <span>合计</span>
              <Price cents={data.total_cents} />
            </div>
          </section>

          {/* 付款信息 */}
          {data.payment_sessions && data.payment_sessions.length > 0 && (
            <section className="rounded-lg border border-neutral-200 bg-white p-5 text-sm">
              <h2 className="mb-2 font-medium text-neutral-800">付款信息</h2>
              <ul className="divide-y divide-neutral-100">
                {data.payment_sessions.map((s) => (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-2"
                  >
                    <span className="text-neutral-700">
                      {formatDateTime(s.created_at)}
                    </span>
                    <span className="text-neutral-500">{s.channel}</span>
                    <span className="text-neutral-700">
                      {formatYuan(s.amount_cents)}
                    </span>
                    <span
                      className={cn(
                        "rounded px-2 py-0.5 text-xs",
                        s.status === "succeeded"
                          ? "bg-green-50 text-green-700"
                          : s.status === "failed"
                            ? "bg-neutral-100 text-neutral-600"
                            : "bg-blue-50 text-blue-700",
                      )}
                    >
                      {s.status}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* 物流卡片 */}
          {(data.shipping_carrier || data.tracking_no) && (
            <section className="rounded-lg border border-neutral-200 bg-white p-5 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-neutral-800">物流信息</div>
                  <p className="mt-1 text-neutral-600">
                    {data.shipping_carrier ?? "-"}
                    <span className="mx-2">·</span>
                    <span className="tabular-nums">{data.tracking_no ?? "-"}</span>
                  </p>
                </div>
                <Link href={`/orders/${data.order_no}/shipment`}>
                  <Button variant="secondary" size="sm">
                    查看轨迹
                  </Button>
                </Link>
              </div>
            </section>
          )}

          {/* 备注 */}
          {(data.user_note || data.merchant_note) && (
            <section className="rounded-lg border border-neutral-200 bg-white p-5 text-sm">
              <h2 className="mb-2 font-medium text-neutral-800">备注</h2>
              {data.user_note && (
                <p className="text-neutral-700">
                  <span className="text-neutral-500">我的备注：</span>
                  {data.user_note}
                </p>
              )}
              {data.merchant_note && (
                <p className="mt-1 text-neutral-700">
                  <span className="text-neutral-500">商家备注：</span>
                  {data.merchant_note}
                </p>
              )}
            </section>
          )}

          {/* 底部 fallback 操作（重复但便于底部再确认） */}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => router.push("/orders")}>
              返回订单列表
            </Button>
          </div>
        </div>
      )}

      <ConfirmModal
        open={cancelOpen}
        title="确认取消该订单？"
        description="取消后已锁定的库存会释放，订单不可恢复。"
        confirmText="取消订单"
        danger
        loading={cancelling}
        onConfirm={doCancel}
        onCancel={() => setCancelOpen(false)}
      />
      <ConfirmModal
        open={confirmOpen}
        title="确认已收到商品？"
        description="确认收货后订单将转为已完成，若有问题请提前联系商家。"
        confirmText="确认收货"
        loading={confirming}
        onConfirm={doConfirm}
        onCancel={() => setConfirmOpen(false)}
      />
    </main>
  );
}

/** 状态时间轴组件。 */
function Timeline({ entries }: { entries: OrderStatusHistoryEntry[] }) {
  const sorted = [...entries].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  return (
    <ol className="flex flex-col gap-3">
      {sorted.map((e, idx) => (
        <li key={e.id} className="flex gap-3">
          <div className="flex flex-col items-center pt-1">
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                idx === sorted.length - 1
                  ? "bg-[color:var(--color-primary)]"
                  : "bg-neutral-300",
              )}
            />
            {idx !== sorted.length - 1 && (
              <span className="mt-1 h-full w-px bg-neutral-200" />
            )}
          </div>
          <div className="flex flex-col pb-2">
            <span className="text-sm text-neutral-800">
              {statusChangeLabel(e.from_status, e.to_status)}
              {e.note ? ` · ${e.note}` : ""}
            </span>
            <span className="text-xs text-neutral-500">
              {formatDateTime(e.created_at)}
              <span className="ml-2">
                by {actorLabel(e.actor_type)}
              </span>
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}

function actorLabel(actor: string): string {
  switch (actor) {
    case "user":
      return "买家";
    case "merchant":
      return "商家";
    case "admin":
      return "客服";
    case "system":
      return "系统";
    default:
      return actor;
  }
}

function statusChangeLabel(from: string | null, to: string): string {
  const fromLabel = from ? ORDER_STATUS_LABEL[from as OrderStatus] ?? from : "创建";
  const toLabel = ORDER_STATUS_LABEL[to as OrderStatus] ?? to;
  if (!from) return `订单${toLabel}`;
  return `${fromLabel} → ${toLabel}`;
}

function cancelReasonLabel(reason: string): string {
  switch (reason) {
    case "user_cancel":
      return "用户主动取消";
    case "payment_timeout":
      return "支付超时自动取消";
    case "merchant_cancel":
      return "商家取消";
    case "admin_intervene":
      return "客服干预";
    case "out_of_stock":
      return "库存不足";
    default:
      return reason;
  }
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("zh-CN", { hour12: false });
  } catch {
    return iso;
  }
}
