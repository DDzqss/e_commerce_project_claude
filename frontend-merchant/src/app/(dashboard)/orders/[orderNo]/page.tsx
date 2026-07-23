"use client";

/**
 * 商家订单详情页（Phase 3 §10.2）。
 *
 * 结构：
 *   - 顶部：状态 badge + 操作按钮（发货 / 取消 / 备注）
 *   - 收货信息（电话脱敏）
 *   - 商品明细
 *   - 金额明细
 *   - Timeline（order_status_history）
 *   - 物流卡片（若 shipped：carrier + tracking_no + shipment_events）
 *   - 用户备注
 *   - 商家备注（可编辑）
 */

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { OrderStatusBadge } from "@/components/ui/OrderStatusBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { carrierLabel } from "@/components/ui/CarrierPicker";
import { CancelOrderModal } from "@/components/orders/CancelOrderModal";
import { ShipOrderModal } from "@/components/orders/ShipOrderModal";
import { MerchantNoteEditor } from "@/components/orders/MerchantNoteEditor";
import { useMerchantOrder } from "@/hooks/useMerchantOrders";
import { imageUrl } from "@/lib/image";
import { cn } from "@/lib/cn";
import {
  formatCentsCny,
  formatDateTime,
  maskPhone,
} from "@/lib/order-utils";
import {
  CANCEL_REASON_LABEL,
  ORDER_STATUS_LABEL,
  OrderStatus,
  SHIPMENT_EVENT_LABEL,
  type MerchantOrderDetail,
  type OrderItem,
  type OrderStatusHistoryItem,
  type ShipmentEvent,
} from "@/types/order";

const ACTOR_LABEL: Record<OrderStatusHistoryItem["actor_type"], string> = {
  user: "用户",
  merchant: "商家",
  admin: "平台",
  system: "系统",
};

export default function MerchantOrderDetailPage() {
  const params = useParams<{ orderNo: string }>();
  const orderNo = params.orderNo;
  const { data, isLoading, isError, refetch } = useMerchantOrder(orderNo);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-3">
        <Link
          href="/orders"
          className="text-sm text-[var(--color-primary)] hover:underline"
        >
          ← 返回订单列表
        </Link>
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          订单加载失败。
          <button
            type="button"
            className="ml-2 underline"
            onClick={() => refetch()}
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  return <OrderDetailBody order={data} />;
}

function OrderDetailBody({ order }: { order: MerchantOrderDetail }) {
  const [shipOpen, setShipOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const canShip = order.status === OrderStatus.Paid;
  const canCancel = order.status === OrderStatus.Paid;

  return (
    <div className="space-y-6">
      {/* 面包屑 */}
      <div>
        <Link
          href="/orders"
          className="text-sm text-neutral-500 hover:text-[var(--color-primary)]"
        >
          ← 返回订单列表
        </Link>
      </div>

      {/* 标题 + 操作栏 */}
      <header className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-mono text-xl font-semibold text-neutral-900">
              {order.order_no}
            </h2>
            <OrderStatusBadge status={order.status} size="lg" />
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            下单于 {formatDateTime(order.created_at)}
            {order.paid_at ? ` · 付款于 ${formatDateTime(order.paid_at)}` : null}
            {order.shipped_at
              ? ` · 发货于 ${formatDateTime(order.shipped_at)}`
              : null}
          </p>
          {order.status === OrderStatus.Cancelled && order.cancel_reason ? (
            <p className="mt-2 max-w-2xl rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <span className="font-semibold">
                取消原因（{CANCEL_REASON_LABEL[order.cancel_reason]}）：
              </span>
              {order.cancel_note ?? "无说明"}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {canShip ? (
            <Button variant="primary" onClick={() => setShipOpen(true)}>
              发货
            </Button>
          ) : null}
          {canCancel ? (
            <Button variant="danger" onClick={() => setCancelOpen(true)}>
              取消订单
            </Button>
          ) : null}
        </div>
      </header>

      {/* 双栏布局 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 左栏：主要信息 */}
        <div className="space-y-6 lg:col-span-2">
          <ReceiverCard order={order} />
          <OrderItemsCard items={order.items} />
          <AmountCard order={order} />
          {order.shipping_carrier || order.shipment_events.length > 0 ? (
            <ShipmentCard order={order} />
          ) : null}
        </div>

        {/* 右栏：辅助信息 */}
        <div className="space-y-6">
          <TimelineCard history={order.status_history} />
          <UserNoteCard note={order.user_note} />
          <MerchantNoteEditor order={order} />
        </div>
      </div>

      {/* Modals */}
      <ShipOrderModal
        open={shipOpen}
        onClose={() => setShipOpen(false)}
        order={order}
      />
      <CancelOrderModal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        order={order}
      />
    </div>
  );
}

// ============================================================================
// 收货信息
// ============================================================================

function ReceiverCard({ order }: { order: MerchantOrderDetail }) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5">
      <h3 className="mb-3 text-sm font-semibold text-neutral-900">收货信息</h3>
      <dl className="grid grid-cols-1 gap-y-2 text-sm sm:grid-cols-[6rem_1fr]">
        <dt className="text-neutral-500">收货人</dt>
        <dd className="text-neutral-900">{order.receiver_name}</dd>
        <dt className="text-neutral-500">联系电话</dt>
        <dd className="font-mono text-neutral-900" title="出于隐私已脱敏">
          {maskPhone(order.receiver_phone)}
        </dd>
        <dt className="text-neutral-500">收货地址</dt>
        <dd className="text-neutral-900">{order.receiver_address}</dd>
      </dl>
    </section>
  );
}

// ============================================================================
// 商品明细
// ============================================================================

function OrderItemsCard({ items }: { items: OrderItem[] }) {
  return (
    <section className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <header className="border-b border-neutral-100 px-5 py-3">
        <h3 className="text-sm font-semibold text-neutral-900">商品明细</h3>
      </header>
      <table className="w-full text-sm">
        <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
          <tr>
            <th className="w-16 px-4 py-2">图</th>
            <th className="px-4 py-2">商品</th>
            <th className="w-24 px-4 py-2 text-right">单价</th>
            <th className="w-16 px-4 py-2 text-right">数量</th>
            <th className="w-28 px-4 py-2 text-right">小计</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {items.map((it) => (
            <tr key={it.id}>
              <td className="px-4 py-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl(it.sku_image)}
                  alt={it.spu_title}
                  className="h-12 w-12 rounded object-cover"
                />
              </td>
              <td className="px-4 py-3">
                <div className="line-clamp-2 text-neutral-900">
                  {it.spu_title}
                </div>
                {Object.keys(it.sku_specs).length > 0 ? (
                  <div className="mt-0.5 text-xs text-neutral-500">
                    {Object.entries(it.sku_specs)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(" · ")}
                  </div>
                ) : null}
              </td>
              <td className="px-4 py-3 text-right text-neutral-700">
                {formatCentsCny(it.unit_price_cents)}
              </td>
              <td className="px-4 py-3 text-right text-neutral-700">
                × {it.quantity}
              </td>
              <td className="px-4 py-3 text-right font-medium text-neutral-900">
                {formatCentsCny(it.subtotal_cents)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// ============================================================================
// 金额明细
// ============================================================================

function AmountCard({ order }: { order: MerchantOrderDetail }) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5">
      <h3 className="mb-3 text-sm font-semibold text-neutral-900">金额明细</h3>
      <dl className="space-y-1.5 text-sm">
        <Row label="商品小计" value={formatCentsCny(order.subtotal_cents)} />
        <Row label="运费" value={formatCentsCny(order.shipping_fee_cents)} />
        {order.discount_cents > 0 ? (
          <Row
            label="优惠"
            value={`- ${formatCentsCny(order.discount_cents)}`}
            valueClassName="text-emerald-700"
          />
        ) : null}
        <div className="mt-2 flex items-center justify-between border-t border-neutral-100 pt-2">
          <span className="text-sm font-medium text-neutral-700">应付总额</span>
          <span className="text-lg font-semibold text-[var(--color-primary)]">
            {formatCentsCny(order.total_cents)}
          </span>
        </div>
      </dl>
    </section>
  );
}

function Row({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex justify-between">
      <dt className="text-neutral-500">{label}</dt>
      <dd className={cn("text-neutral-900", valueClassName)}>{value}</dd>
    </div>
  );
}

// ============================================================================
// 物流卡片
// ============================================================================

function ShipmentCard({ order }: { order: MerchantOrderDetail }) {
  const [expanded, setExpanded] = useState(true);
  const events = [...order.shipment_events].sort(
    (a, b) => new Date(b.event_time).getTime() - new Date(a.event_time).getTime(),
  );

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-900">物流信息</h3>
        {events.length > 0 ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-[var(--color-primary)] hover:underline"
          >
            {expanded ? "收起轨迹" : `展开轨迹（${events.length}）`}
          </button>
        ) : null}
      </header>
      <dl className="grid grid-cols-1 gap-y-2 text-sm sm:grid-cols-[6rem_1fr]">
        <dt className="text-neutral-500">快递公司</dt>
        <dd className="text-neutral-900">
          {carrierLabel(order.shipping_carrier)}
        </dd>
        <dt className="text-neutral-500">运单号</dt>
        <dd className="font-mono text-neutral-900">
          {order.tracking_no ?? "-"}
        </dd>
      </dl>
      {expanded && events.length > 0 ? (
        <ol className="mt-4 space-y-3 border-t border-neutral-100 pt-3">
          {events.map((e) => (
            <ShipmentEventRow key={e.id} event={e} />
          ))}
        </ol>
      ) : null}
    </section>
  );
}

function ShipmentEventRow({ event }: { event: ShipmentEvent }) {
  return (
    <li className="flex items-start gap-3 text-sm">
      <span
        aria-hidden
        className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--color-primary)]"
      />
      <div className="flex-1">
        <div className="text-neutral-900">
          <span className="mr-2 text-xs font-medium text-[var(--color-primary)]">
            [{SHIPMENT_EVENT_LABEL[event.event_type]}]
          </span>
          {event.description}
        </div>
        <div className="text-xs text-neutral-400">
          {formatDateTime(event.event_time)}
        </div>
      </div>
    </li>
  );
}

// ============================================================================
// 用户备注
// ============================================================================

function UserNoteCard({ note }: { note: string | null }) {
  if (!note) return null;
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5">
      <h3 className="mb-2 text-sm font-semibold text-neutral-900">用户留言</h3>
      <p className="whitespace-pre-line text-sm text-neutral-700">{note}</p>
    </section>
  );
}

// ============================================================================
// Timeline（状态历史）
// ============================================================================

function TimelineCard({ history }: { history: OrderStatusHistoryItem[] }) {
  // 老的在下，最新的在上
  const sorted = [...history].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5">
      <h3 className="mb-3 text-sm font-semibold text-neutral-900">订单时间轴</h3>
      {sorted.length === 0 ? (
        <p className="text-sm text-neutral-400">暂无历史</p>
      ) : (
        <ol className="space-y-3">
          {sorted.map((h) => (
            <li key={h.id} className="flex items-start gap-3 text-sm">
              <span
                aria-hidden
                className="mt-1 h-2 w-2 shrink-0 rounded-full bg-neutral-400"
              />
              <div className="flex-1">
                <div className="text-neutral-900">
                  {ACTOR_LABEL[h.actor_type]}
                  <span className="mx-1 text-neutral-400">·</span>
                  {h.from_status ? (
                    <>
                      {ORDER_STATUS_LABEL[h.from_status]}
                      <span className="mx-1 text-neutral-400">→</span>
                    </>
                  ) : null}
                  <span className="font-medium text-[var(--color-primary)]">
                    {ORDER_STATUS_LABEL[h.to_status]}
                  </span>
                </div>
                {h.note ? (
                  <div className="mt-0.5 text-xs text-neutral-500">{h.note}</div>
                ) : null}
                <div className="text-xs text-neutral-400">
                  {formatDateTime(h.created_at)}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
