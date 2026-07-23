"use client";

/**
 * 平台订单详情 (`/console/orders/[orderNo]`)。
 *
 * 契约 §11：
 * - GET  /admin/orders/{id}                        完整字段（含 admin_note + payment_sessions）
 * - POST /admin/orders/{id}/cancel   { cancel_note ≥10 }  强制取消（pending_payment / paid）
 * - POST /admin/orders/{id}/note     { admin_note }       内部备注
 * - POST /admin/orders/{id}/logistics/simulate           模拟物流推进（shipped）
 *
 * 说明：URL 段是 order_no（18 位字符串）；后端支持 order_no 精确查找。
 *
 * UI 要素：
 * - 顶部：状态 badge + 干预按钮（强制取消 / 添加备注 / 模拟物流）
 * - 用户信息卡 / 店铺信息卡 / 收货信息卡（明文完整地址）
 * - 商品明细 / 金额明细
 * - **完整 Timeline**（含 actor_type 徽章）
 * - **支付会话列表**（可能多次尝试；含 external_txn_no + failure_reason）
 * - 物流卡片：完整 shipment_events + 模拟推进入口（仅 shipped 状态）
 * - **内部备注区**：醒目黄色框，"仅管理员可见"
 * - **强制取消 Modal**：cancel_note 必填 ≥ 10 字符 + 强警告 + 二次确认
 * - **模拟物流事件 Modal**：event_type 下拉 + description
 */

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RequirePermission } from "@/components/auth/RequirePermission";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { CarrierBadge } from "@/components/ui/CarrierBadge";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import {
  OrderStatusBadge,
  getOrderStatusLabel,
} from "@/components/ui/OrderStatusBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { Table, type TableColumn } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { useAdminOrder } from "@/hooks/useOrders";
import { usePermission } from "@/hooks/useAuth";
import {
  addAdminNote,
  adminCancelOrder,
  simulateLogistics,
} from "@/lib/order-api";
import { ApiError } from "@/lib/api";
import { getErrorMessage } from "@/types/errors";
import { imagePlaceholder, imageUrl } from "@/lib/image";
import type {
  AdminOrderDetail,
  OrderActorType,
  OrderItemOut,
  OrderShipmentEvent,
  OrderStatus,
  OrderStatusHistoryOut,
  PaymentSessionOut,
  ShipmentEventType,
} from "@/types/order";

interface PageProps {
  params: Promise<{ orderNo: string }>;
}

export default function AdminOrderDetailPage(props: PageProps) {
  const { orderNo } = use(props.params);
  return (
    <RequirePermission permission="admin:order:read_all">
      <AdminOrderDetailInner orderNo={orderNo} />
    </RequirePermission>
  );
}

type ModalKind = "cancel" | "note" | "logistics" | null;

function AdminOrderDetailInner({ orderNo }: { orderNo: string }) {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const canIntervene = usePermission("admin:order:intervene");
  const canAddNote = usePermission("admin:order:add_note");

  const { data, isLoading, isError, error } = useAdminOrder(orderNo);

  const [modal, setModal] = useState<ModalKind>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: ["admin", "order", String(orderNo)],
    });
    queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "order-overview"] });
  };

  const cancelMutation = useMutation({
    mutationFn: (cancel_note: string) =>
      adminCancelOrder(orderNo, { cancel_note }),
    onSuccess: () => {
      setModal(null);
      toast.push({ type: "success", message: "已强制取消订单，库存已释放" });
      invalidate();
    },
    onError: (err) => showError(err, toast),
  });

  const noteMutation = useMutation({
    mutationFn: (admin_note: string) =>
      addAdminNote(orderNo, { admin_note }),
    onSuccess: () => {
      setModal(null);
      toast.push({ type: "success", message: "内部备注已更新" });
      invalidate();
    },
    onError: (err) => showError(err, toast),
  });

  const logisticsMutation = useMutation({
    mutationFn: (payload: { event_type: ShipmentEventType; description: string }) =>
      simulateLogistics(orderNo, payload),
    onSuccess: () => {
      setModal(null);
      toast.push({ type: "success", message: "已追加一条物流事件" });
      invalidate();
    },
    onError: (err) => showError(err, toast),
  });

  if (isLoading) return <DetailSkeleton />;

  if (isError || !data) {
    return (
      <div className="rounded border border-red-200 bg-[color:var(--color-danger-soft)] px-4 py-3 text-sm text-[color:var(--color-danger)]">
        {error instanceof ApiError
          ? getErrorMessage(error.code, error.message)
          : "订单详情加载失败"}
        <div className="mt-2">
          <Link
            href="/console/orders"
            className="text-[color:var(--color-info)] hover:underline"
          >
            返回订单大盘
          </Link>
        </div>
      </div>
    );
  }

  const order = data;
  const cancellable =
    canIntervene &&
    (order.status === "pending_payment" || order.status === "paid");
  const canSimulate = canIntervene && order.status === "shipped";

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link
            href="/console/orders"
            className="mb-2 inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-800"
          >
            ← 返回订单大盘
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-lg font-semibold text-neutral-900">
              {order.order_no}
            </h1>
            <OrderStatusBadge status={order.status} />
            {order.cancel_reason ? (
              <Badge tone="default">
                取消原因：{cancelReasonLabel(order.cancel_reason)}
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            订单 #{order.id} · 下单于 {formatDateTime(order.created_at)}
          </p>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          {canAddNote ? (
            <Button variant="secondary" onClick={() => setModal("note")}>
              {order.admin_note ? "编辑内部备注" : "添加内部备注"}
            </Button>
          ) : null}
          {canSimulate ? (
            <Button
              variant="secondary"
              onClick={() => setModal("logistics")}
            >
              手动追加物流
            </Button>
          ) : null}
          {cancellable ? (
            <Button variant="danger" onClick={() => setModal("cancel")}>
              强制取消订单
            </Button>
          ) : null}
        </div>
      </div>

      {/* 内部备注（醒目黄色框） */}
      {order.admin_note ? (
        <section
          aria-label="管理员内部备注"
          className="rounded-md border-2 border-amber-300 bg-amber-50 p-3"
        >
          <div className="mb-1 flex items-center gap-2">
            <Badge tone="warning">仅管理员可见</Badge>
            <span className="text-xs font-medium text-amber-800">
              内部备注
            </span>
          </div>
          <p className="whitespace-pre-wrap text-sm text-amber-900">
            {order.admin_note}
          </p>
        </section>
      ) : null}

      {/* 三卡：用户 / 店铺 / 收货 */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card title="用户信息">
          <Field label="用户 ID">
            <span className="font-mono">#{order.user_id}</span>
          </Field>
          {order.user?.nickname ? (
            <Field label="昵称">{order.user.nickname}</Field>
          ) : null}
          {order.user?.phone ? (
            <Field label="手机（明文）">
              <span className="tabular-nums">{order.user.phone}</span>
            </Field>
          ) : null}
          {order.user?.email ? (
            <Field label="邮箱">{order.user.email}</Field>
          ) : null}
        </Card>

        <Card title="店铺信息">
          <Field label="店铺">
            {order.shop?.name ?? "—"}
            <span className="ml-1 text-xs text-neutral-400">
              #{order.shop_id}
            </span>
          </Field>
          {order.shop?.contact_name ? (
            <Field label="联系人">{order.shop.contact_name}</Field>
          ) : null}
          {order.shop?.contact_phone ? (
            <Field label="联系电话">
              <span className="tabular-nums">{order.shop.contact_phone}</span>
            </Field>
          ) : null}
        </Card>

        <Card title="收货信息">
          <Field label="收货人">{order.receiver_name}</Field>
          <Field label="电话">
            <span className="tabular-nums">{order.receiver_phone}</span>
          </Field>
          <Field label="完整地址">
            <span className="text-neutral-800">{order.receiver_address}</span>
          </Field>
          {order.user_note ? (
            <Field label="用户备注">
              <span className="text-neutral-600">{order.user_note}</span>
            </Field>
          ) : null}
        </Card>
      </section>

      {/* 商品明细 */}
      <section className="rounded-md border border-[color:var(--color-border)] bg-white">
        <header className="border-b border-[color:var(--color-border)] px-4 py-3 text-sm font-semibold text-neutral-800">
          商品明细（{order.items.length}）
        </header>
        <div className="p-4">
          <OrderItemsTable rows={[...order.items]} />
        </div>
      </section>

      {/* 金额明细 */}
      <section className="rounded-md border border-[color:var(--color-border)] bg-white p-4">
        <div className="mb-3 text-sm font-semibold text-neutral-800">
          金额明细
        </div>
        <div className="ml-auto max-w-xs space-y-1 text-sm">
          <AmountRow label="商品小计" cents={order.subtotal_cents} />
          <AmountRow label="运费" cents={order.shipping_fee_cents} />
          {order.discount_cents ? (
            <AmountRow
              label="优惠"
              cents={-order.discount_cents}
              highlight="negative"
            />
          ) : null}
          <div className="my-1 border-t border-[color:var(--color-border)]" />
          <div className="flex justify-between text-base">
            <span className="text-neutral-600">应付合计</span>
            <span className="font-semibold text-[color:var(--color-danger)] tabular-nums">
              ¥{(order.total_cents / 100).toFixed(2)}
            </span>
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="rounded-md border border-[color:var(--color-border)] bg-white">
        <header className="border-b border-[color:var(--color-border)] px-4 py-3 text-sm font-semibold text-neutral-800">
          订单时间轴（{order.status_history.length}）
        </header>
        <ul className="flex flex-col gap-3 p-4 text-sm">
          {order.status_history.length === 0 ? (
            <li className="text-xs text-neutral-400">暂无历史记录</li>
          ) : (
            order.status_history
              .slice()
              .sort(
                (a, b) =>
                  new Date(a.created_at).getTime() -
                  new Date(b.created_at).getTime(),
              )
              .map((h) => <TimelineItem key={h.id} history={h} />)
          )}
        </ul>
      </section>

      {/* 支付会话列表 */}
      <section className="rounded-md border border-[color:var(--color-border)] bg-white">
        <header className="border-b border-[color:var(--color-border)] px-4 py-3 text-sm font-semibold text-neutral-800">
          支付会话（{order.payment_sessions.length}）
        </header>
        <div className="p-4">
          {order.payment_sessions.length === 0 ? (
            <div className="text-xs text-neutral-400">
              该订单尚无支付会话记录
            </div>
          ) : (
            <PaymentSessionsTable rows={[...order.payment_sessions]} />
          )}
        </div>
      </section>

      {/* 物流卡片 */}
      <section className="rounded-md border border-[color:var(--color-border)] bg-white">
        <header className="flex items-center justify-between border-b border-[color:var(--color-border)] px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
            物流轨迹
            {order.shipping_carrier ? (
              <CarrierBadge carrier={order.shipping_carrier} />
            ) : null}
            {order.tracking_no ? (
              <span className="font-mono text-xs text-neutral-600">
                {order.tracking_no}
              </span>
            ) : null}
          </div>
          {canSimulate ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setModal("logistics")}
            >
              手动追加事件
            </Button>
          ) : null}
        </header>
        <div className="p-4">
          {order.shipment_events.length === 0 ? (
            <div className="text-xs text-neutral-400">
              {order.status === "pending_payment" || order.status === "paid"
                ? "订单尚未发货"
                : "暂无物流事件"}
            </div>
          ) : (
            <ShipmentTimeline events={[...order.shipment_events]} />
          )}
        </div>
      </section>

      {/* 强制取消 Modal */}
      <CancelOrderModal
        open={modal === "cancel"}
        onClose={() => setModal(null)}
        onSubmit={(note) => cancelMutation.mutate(note)}
        submitting={cancelMutation.isPending}
        status={order.status}
      />

      {/* 添加内部备注 Modal */}
      <AdminNoteModal
        open={modal === "note"}
        onClose={() => setModal(null)}
        onSubmit={(note) => noteMutation.mutate(note)}
        submitting={noteMutation.isPending}
        initial={order.admin_note ?? ""}
      />

      {/* 模拟物流 Modal */}
      <SimulateLogisticsModal
        open={modal === "logistics"}
        onClose={() => setModal(null)}
        onSubmit={(payload) => logisticsMutation.mutate(payload)}
        submitting={logisticsMutation.isPending}
      />

      {/* 底部导航 */}
      <div className="pt-4 text-xs text-neutral-400">
        <button
          type="button"
          onClick={() => router.back()}
          className="hover:text-neutral-700"
        >
          ← 返回上一页
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 商品明细 Table
// ---------------------------------------------------------------------------

function OrderItemsTable({ rows }: { rows: OrderItemOut[] }) {
  const columns: TableColumn<OrderItemOut>[] = [
    {
      key: "sku_image",
      title: "图",
      width: 60,
      render: (r) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl(r.sku_image ?? undefined)}
          alt={r.spu_title}
          width={40}
          height={40}
          className="h-10 w-10 rounded border border-neutral-200 object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = imagePlaceholder();
          }}
        />
      ),
    },
    {
      key: "title",
      title: "商品",
      render: (r) => (
        <div>
          <div className="text-sm font-medium text-neutral-900">
            {r.spu_title}
          </div>
          <div className="mt-0.5 text-xs text-neutral-500">
            {Object.entries(r.sku_specs)
              .map(([k, v]) => `${k}=${v}`)
              .join(" · ") || "—"}
          </div>
          <div className="mt-0.5 text-[10px] text-neutral-400">
            SKU #{r.sku_id} · SPU #{r.spu_id}
          </div>
        </div>
      ),
    },
    {
      key: "unit_price",
      title: "单价",
      align: "right",
      width: 100,
      render: (r) => (
        <span className="tabular-nums">
          ¥{(r.unit_price_cents / 100).toFixed(2)}
        </span>
      ),
    },
    {
      key: "quantity",
      title: "数量",
      align: "center",
      width: 70,
      render: (r) => <span className="tabular-nums">×{r.quantity}</span>,
    },
    {
      key: "subtotal",
      title: "小计",
      align: "right",
      width: 110,
      render: (r) => (
        <span className="tabular-nums font-semibold text-neutral-900">
          ¥{(r.subtotal_cents / 100).toFixed(2)}
        </span>
      ),
    },
  ];
  return (
    <Table
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      emptyText="订单无商品明细"
    />
  );
}

// ---------------------------------------------------------------------------
// 支付会话 Table
// ---------------------------------------------------------------------------

const CHANNEL_LABEL: Record<string, string> = {
  mock_alipay: "模拟支付宝",
  mock_wechat: "模拟微信",
  mock_bank: "模拟网银",
};

const SESSION_TONE = {
  pending: "warning",
  succeeded: "success",
  failed: "danger",
  expired: "default",
} as const;

const SESSION_LABEL = {
  pending: "待支付",
  succeeded: "支付成功",
  failed: "支付失败",
  expired: "已过期",
} as const;

function PaymentSessionsTable({ rows }: { rows: PaymentSessionOut[] }) {
  const columns: TableColumn<PaymentSessionOut>[] = [
    {
      key: "id",
      title: "会话 ID",
      width: 100,
      render: (r) => <span className="font-mono text-xs">#{r.id}</span>,
    },
    {
      key: "channel",
      title: "渠道",
      render: (r) => (
        <span className="text-xs text-neutral-700">
          {CHANNEL_LABEL[r.channel] ?? r.channel}
        </span>
      ),
    },
    {
      key: "amount",
      title: "金额",
      align: "right",
      width: 100,
      render: (r) => (
        <span className="tabular-nums">
          ¥{(r.amount_cents / 100).toFixed(2)}
        </span>
      ),
    },
    {
      key: "status",
      title: "状态",
      width: 100,
      render: (r) => (
        <Badge tone={SESSION_TONE[r.status]}>{SESSION_LABEL[r.status]}</Badge>
      ),
    },
    {
      key: "external_txn_no",
      title: "外部单号",
      render: (r) =>
        r.external_txn_no ? (
          <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px]">
            {r.external_txn_no}
          </code>
        ) : (
          <span className="text-xs text-neutral-400">—</span>
        ),
    },
    {
      key: "failure_reason",
      title: "失败原因",
      render: (r) => (
        <span className="text-xs text-[color:var(--color-danger)]">
          {r.failure_reason ?? ""}
        </span>
      ),
    },
    {
      key: "created_at",
      title: "创建",
      render: (r) => (
        <span className="tabular-nums text-xs text-neutral-500">
          {formatDateTime(r.created_at)}
        </span>
      ),
    },
  ];
  return (
    <Table
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      emptyText="—"
    />
  );
}

// ---------------------------------------------------------------------------
// 物流事件时间线
// ---------------------------------------------------------------------------

const SHIPMENT_EVENT_LABEL: Record<ShipmentEventType, string> = {
  picked_up: "已揽收",
  in_transit: "运输中",
  arrived_city: "到达城市",
  out_for_delivery: "派送中",
  delivered: "已签收",
};

function ShipmentTimeline({ events }: { events: OrderShipmentEvent[] }) {
  const sorted = events
    .slice()
    .sort(
      (a, b) =>
        new Date(a.event_time).getTime() - new Date(b.event_time).getTime(),
    );
  return (
    <ol className="flex flex-col gap-3">
      {sorted.map((e, i) => (
        <li key={e.id} className="flex gap-3">
          <span className="flex flex-col items-center">
            <span
              aria-hidden
              className="mt-1 inline-block h-2.5 w-2.5 rounded-full bg-[color:var(--color-primary)]"
            />
            {i < sorted.length - 1 ? (
              <span
                aria-hidden
                className="mt-1 w-px flex-1 bg-neutral-200"
              />
            ) : null}
          </span>
          <div className="flex-1 pb-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium text-neutral-800">
                {SHIPMENT_EVENT_LABEL[e.event_type] ?? e.event_type}
              </span>
              <span className="text-xs text-neutral-400 tabular-nums">
                {formatDateTime(e.event_time)}
              </span>
            </div>
            <div className="mt-0.5 text-xs text-neutral-600">
              {e.description}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// 订单状态历史 Timeline item（含 actor 徽章）
// ---------------------------------------------------------------------------

/**
 * actor_type 颜色规则（任务说明）：
 * - system   灰
 * - user     蓝
 * - merchant 绿
 * - admin    红
 */
const ACTOR_TONE: Record<
  OrderActorType,
  { tone: "default" | "info" | "success" | "danger"; label: string }
> = {
  system: { tone: "default", label: "系统" },
  user: { tone: "info", label: "用户" },
  merchant: { tone: "success", label: "商家" },
  admin: { tone: "danger", label: "管理员" },
};

function TimelineItem({ history }: { history: OrderStatusHistoryOut }) {
  const actorMeta = ACTOR_TONE[history.actor_type];
  const from = history.from_status
    ? getOrderStatusLabel(history.from_status)
    : "（初始）";
  const to = getOrderStatusLabel(history.to_status);

  return (
    <li className="flex gap-3">
      <span
        aria-hidden
        className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${dotClass(
          actorMeta.tone,
        )}`}
      />
      <div className="flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge tone={actorMeta.tone}>{actorMeta.label}</Badge>
            <span className="text-sm text-neutral-800">
              {from} → <span className="font-medium">{to}</span>
            </span>
          </div>
          <span className="text-xs text-neutral-400 tabular-nums">
            {formatDateTime(history.created_at)}
          </span>
        </div>
        <div className="mt-0.5 text-xs text-neutral-500">
          {history.actor_display_name
            ? history.actor_display_name
            : history.actor_id
              ? `${actorMeta.label} #${history.actor_id}`
              : actorMeta.label}
          {history.note ? (
            <span className="ml-2 rounded bg-neutral-50 px-1.5 py-0.5 text-[11px] text-neutral-700">
              {history.note}
            </span>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function dotClass(tone: "default" | "info" | "success" | "danger"): string {
  switch (tone) {
    case "default":
      return "bg-neutral-300";
    case "info":
      return "bg-blue-500";
    case "success":
      return "bg-[color:var(--color-success)]";
    case "danger":
      return "bg-[color:var(--color-danger)]";
  }
}

// ---------------------------------------------------------------------------
// Modals
// ---------------------------------------------------------------------------

/**
 * 强制取消 Modal。
 *
 * 契约合规：cancel_note 必填；本组件强制 ≥ 10 字符（比商家侧的 5 更严格）。
 * 已支付订单会展示更强的警告（"钱没退给用户"）。
 */
function CancelOrderModal({
  open,
  onClose,
  onSubmit,
  submitting,
  status,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (note: string) => void;
  submitting: boolean;
  status: OrderStatus;
}) {
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 打开时清空
  const openKey = open ? "open" : "closed";
  const [lastOpen, setLastOpen] = useState("closed");
  if (openKey !== lastOpen) {
    setLastOpen(openKey);
    if (open) {
      setNote("");
      setConfirmed(false);
      setError(null);
    }
  }

  const handleSubmit = () => {
    const trimmed = note.trim();
    if (trimmed.length < 10) {
      setError("原因需 ≥ 10 字符（管理员干预要求更详细的说明）");
      return;
    }
    if (trimmed.length > 500) {
      setError("原因不得超过 500 字符");
      return;
    }
    if (!confirmed) {
      setError("请勾选二次确认");
      return;
    }
    setError(null);
    onSubmit(trimmed);
  };

  const isPaid = status === "paid";

  return (
    <Modal
      open={open}
      onClose={submitting ? () => undefined : onClose}
      title="强制取消订单"
      closeOnOverlay={false}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={submitting}
          >
            返回
          </Button>
          <Button
            variant="danger"
            loading={submitting}
            onClick={handleSubmit}
          >
            确认强制取消
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="rounded border-2 border-red-300 bg-[color:var(--color-danger-soft)] p-3 text-sm text-[color:var(--color-danger)]">
          <div className="mb-1 font-semibold">⚠ 此为破坏性操作，不可撤回</div>
          <ul className="ml-4 list-disc space-y-1 text-xs">
            <li>订单会立即变更为「已取消」，全部 SKU 库存回滚释放</li>
            <li>操作会以 <code>admin_intervene</code> 记入订单时间轴（永久留痕）</li>
            {isPaid ? (
              <li className="font-medium">
                该订单<strong>已支付</strong>——本操作不会退款，请务必先与用户 /
                商家协商退款方案，再回来执行取消
              </li>
            ) : null}
          </ul>
        </div>

        <FormField
          label="取消原因（管理员留档）"
          required
          error={
            error && error.startsWith("请勾选")
              ? null
              : error
          }
        >
          <textarea
            className="block h-28 w-full resize-none rounded border border-[color:var(--color-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:var(--color-danger)] focus:ring-1 focus:ring-[color:var(--color-danger)]/20"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            aria-invalid={Boolean(error)}
            placeholder="请填写详细取消原因，10-500 字。例如：与用户 / 商家协商一致，因缺货导致订单需退款处理。"
          />
        </FormField>
        <div className="text-right text-xs text-neutral-400">
          {note.trim().length} / 500 · 至少 10 字
        </div>

        <label className="flex items-start gap-2 rounded border border-[color:var(--color-border)] bg-neutral-50 p-2 text-xs text-neutral-700">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            我已确认：知晓此操作会释放库存且无法撤销
            {isPaid ? "，且已就退款问题与相关方达成一致" : ""}。
          </span>
        </label>
        {error && error.startsWith("请勾选") ? (
          <p
            className="text-xs text-[color:var(--color-danger)]"
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

/**
 * 添加内部备注 Modal（可覆盖式编辑已有备注）。
 */
function AdminNoteModal({
  open,
  onClose,
  onSubmit,
  submitting,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (note: string) => void;
  submitting: boolean;
  initial: string;
}) {
  const [note, setNote] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  const openKey = open ? "open" : "closed";
  const [lastOpen, setLastOpen] = useState("closed");
  if (openKey !== lastOpen) {
    setLastOpen(openKey);
    if (open) {
      setNote(initial);
      setError(null);
    }
  }

  const handleSubmit = () => {
    const trimmed = note.trim();
    if (trimmed.length === 0) {
      setError("备注不能为空");
      return;
    }
    if (trimmed.length > 1000) {
      setError("备注不得超过 1000 字符");
      return;
    }
    setError(null);
    onSubmit(trimmed);
  };

  return (
    <Modal
      open={open}
      onClose={submitting ? () => undefined : onClose}
      title="内部备注（仅管理员可见）"
      closeOnOverlay={!submitting}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            取消
          </Button>
          <Button loading={submitting} onClick={handleSubmit}>
            保存备注
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="rounded bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
          此备注仅在管理端可见，用户 / 商家看不到。用于团队内部记录跟进情况。
        </p>
        <FormField label="备注内容" required error={error}>
          <textarea
            className="block h-32 w-full resize-none rounded border border-[color:var(--color-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)] focus:ring-1 focus:ring-[color:var(--color-primary)]/20"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={1000}
            aria-invalid={Boolean(error)}
            placeholder="例如：已电话联系用户，用户同意重发…"
          />
        </FormField>
        <div className="text-right text-xs text-neutral-400">
          {note.trim().length} / 1000
        </div>
      </div>
    </Modal>
  );
}

const EVENT_TYPES: readonly {
  value: ShipmentEventType;
  label: string;
}[] = [
  { value: "picked_up", label: "已揽收" },
  { value: "in_transit", label: "运输中" },
  { value: "arrived_city", label: "到达城市" },
  { value: "out_for_delivery", label: "派送中" },
  { value: "delivered", label: "已签收" },
];

/**
 * 模拟物流事件 Modal。event_type + description，两项都必填。
 */
function SimulateLogisticsModal({
  open,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    event_type: ShipmentEventType;
    description: string;
  }) => void;
  submitting: boolean;
}) {
  const [eventType, setEventType] = useState<ShipmentEventType>("in_transit");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const openKey = open ? "open" : "closed";
  const [lastOpen, setLastOpen] = useState("closed");
  if (openKey !== lastOpen) {
    setLastOpen(openKey);
    if (open) {
      setEventType("in_transit");
      setDescription("");
      setError(null);
    }
  }

  const handleSubmit = () => {
    const trimmed = description.trim();
    if (trimmed.length < 2) {
      setError("请填写事件说明（≥ 2 字符）");
      return;
    }
    if (trimmed.length > 200) {
      setError("说明不得超过 200 字符");
      return;
    }
    setError(null);
    onSubmit({ event_type: eventType, description: trimmed });
  };

  return (
    <Modal
      open={open}
      onClose={submitting ? () => undefined : onClose}
      title="手动追加物流事件"
      closeOnOverlay={!submitting}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            取消
          </Button>
          <Button loading={submitting} onClick={handleSubmit}>
            追加事件
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-xs text-neutral-500">
          仅追加一条 <code>shipment_event</code>；不改变订单状态。
        </p>
        <FormField label="事件类型" required>
          <select
            value={eventType}
            onChange={(e) =>
              setEventType(e.target.value as ShipmentEventType)
            }
            className="block h-8 w-full rounded border border-[color:var(--color-border)] bg-white px-2 text-sm outline-none focus:border-[color:var(--color-primary)] focus:ring-1 focus:ring-[color:var(--color-primary)]/20"
          >
            {EVENT_TYPES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="事件说明" required error={error}>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={200}
            placeholder="例如：已到达杭州转运中心"
          />
        </FormField>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-[color:var(--color-border)] bg-white">
      <header className="border-b border-[color:var(--color-border)] px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {title}
      </header>
      <dl className="flex flex-col gap-2 p-4">{children}</dl>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-neutral-800">{children}</dd>
    </div>
  );
}

function AmountRow({
  label,
  cents,
  highlight,
}: {
  label: string;
  cents: number;
  highlight?: "negative";
}) {
  const yuan = (cents / 100).toFixed(2);
  const cls =
    highlight === "negative"
      ? "text-[color:var(--color-danger)]"
      : "text-neutral-800";
  return (
    <div className="flex justify-between text-sm">
      <span className="text-neutral-600">{label}</span>
      <span className={`tabular-nums ${cls}`}>
        {cents < 0 ? "-" : ""}¥{Math.abs(Number(yuan)).toFixed(2)}
      </span>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-6 w-56" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function cancelReasonLabel(reason: string): string {
  switch (reason) {
    case "user_cancel":
      return "用户主动取消";
    case "payment_timeout":
      return "支付超时";
    case "merchant_cancel":
      return "商家取消";
    case "admin_intervene":
      return "管理员干预";
    case "out_of_stock":
      return "缺货";
    default:
      return reason;
  }
}

function showError(err: unknown, toast: { push: (t: { type: "error"; message: string }) => void }) {
  const msg =
    err instanceof ApiError
      ? getErrorMessage(err.code, err.message)
      : "操作失败";
  toast.push({ type: "error", message: msg });
}

export type { AdminOrderDetail };
