"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { RequireAuth } from "@/components/auth/RequireAuth";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { useShipment } from "@/hooks/useOrders";
import type { ShipmentEvent } from "@/types/order";

export default function ShipmentPage() {
  return (
    <RequireAuth>
      <div className="min-h-screen bg-neutral-50">
        <SiteHeader />
        <ShipmentContent />
      </div>
    </RequireAuth>
  );
}

function ShipmentContent() {
  const params = useParams<{ orderNo: string }>();
  const orderNo = params.orderNo;
  const { data, isLoading, isError, refetch } = useShipment(orderNo);
  const [copied, setCopied] = useState(false);

  const copyTracking = async (no: string) => {
    try {
      await navigator.clipboard.writeText(no);
      setCopied(true);
      toast.success("已复制运单号");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("复制失败");
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-6 py-6">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">物流轨迹</h1>
        <Link
          href={`/orders/${orderNo}`}
          className="text-sm text-neutral-500 hover:text-[color:var(--color-primary)]"
        >
          返回订单 →
        </Link>
      </div>

      {isLoading && <Skeleton className="h-40 w-full" />}
      {isError && (
        <div className="rounded-md border border-[color:var(--color-primary-200)] bg-[color:var(--color-primary-50)] px-4 py-3 text-sm text-[color:var(--color-primary-700)]">
          物流信息加载失败，
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
        <>
          <section className="mb-4 rounded-lg border border-neutral-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-neutral-500">快递公司</div>
                <div className="mt-0.5 text-sm font-medium text-neutral-900">
                  {data.carrier ?? "-"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-neutral-500">运单号</div>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="text-sm font-medium text-neutral-900 tabular-nums">
                    {data.tracking_no ?? "-"}
                  </span>
                  {data.tracking_no && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyTracking(data.tracking_no!)}
                    >
                      {copied ? "已复制" : "复制"}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </section>

          {data.events.length === 0 ? (
            <EmptyState title="暂无物流轨迹" description="请稍后再来查看" />
          ) : (
            <section className="rounded-lg border border-neutral-200 bg-white p-5">
              <EventTimeline events={data.events} />
            </section>
          )}
        </>
      )}
    </main>
  );
}

function EventTimeline({ events }: { events: ShipmentEvent[] }) {
  const sorted = [...events].sort(
    (a, b) => new Date(b.event_time).getTime() - new Date(a.event_time).getTime(),
  );
  return (
    <ol className="flex flex-col gap-3">
      {sorted.map((e, idx) => (
        <li key={e.id} className="flex gap-3">
          <div className="flex flex-col items-center pt-1">
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                idx === 0
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
              {shipmentTypeLabel(e.event_type)} · {e.description}
            </span>
            <span className="text-xs text-neutral-500">
              {new Date(e.event_time).toLocaleString("zh-CN", { hour12: false })}
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}

function shipmentTypeLabel(type: string): string {
  switch (type) {
    case "picked_up":
      return "已揽收";
    case "in_transit":
      return "运输中";
    case "arrived_city":
      return "到达城市";
    case "out_for_delivery":
      return "派送中";
    case "delivered":
      return "已签收";
    default:
      return type;
  }
}
