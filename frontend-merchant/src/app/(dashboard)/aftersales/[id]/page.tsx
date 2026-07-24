"use client";

/**
 * 商家售后详情页（Phase 4 §8）。
 *
 * 布局：
 *   - 左（2/3）：用户 / 订单 / 售后单摘要 / 金额 / 商品明细 / 退货地址 / 凭证画廊
 *   - 右（1/3）：状态操作面板 + Timeline + 商家备注（就地编辑）
 *
 * 状态-操作面板依售后状态显示不同按钮组：
 *   - pending_merchant_review          → 同意 / 拒绝
 *   - merchant_agreed_waiting_return   → 等用户寄回（只读）
 *   - return_shipped_waiting_receive   → 确认收货 / 拒收
 *   - merchant_agreed_waiting_ship     → 发货换货
 *   - exchange_shipped_waiting_receive → 等用户确认（只读）
 *   - 其他终态 / admin_arbitrating     → 只读
 */

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { AftersalesEvidenceGallery } from "@/components/aftersales/AftersalesEvidenceGallery";
import { AftersalesNoteEditor } from "@/components/aftersales/AftersalesNoteEditor";
import { AftersalesStatusBadge } from "@/components/aftersales/AftersalesStatusBadge";
import { AftersalesTimeline } from "@/components/aftersales/AftersalesTimeline";
import { AftersalesTypeIcon } from "@/components/aftersales/AftersalesTypeIcon";
import { ApproveModal } from "@/components/aftersales/ApproveModal";
import { ConfirmReceivedModal } from "@/components/aftersales/ConfirmReceivedModal";
import { RefuseReceiveModal } from "@/components/aftersales/RefuseReceiveModal";
import { RejectModal } from "@/components/aftersales/RejectModal";
import { ShipExchangeModal } from "@/components/aftersales/ShipExchangeModal";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { carrierLabel } from "@/components/ui/CarrierPicker";
import { useMerchantAftersalesDetail } from "@/hooks/useMerchantAftersales";
import { imageUrl } from "@/lib/image";
import { cn } from "@/lib/cn";
import {
  computeDeadlineInfo,
  deadlineTextClass,
} from "@/lib/aftersales-utils";
import {
  formatCentsCny,
  formatDateTime,
  maskPhone,
} from "@/lib/order-utils";
import {
  AFTERSALES_REASON_LABEL,
  AFTERSALES_TYPE_LABEL,
  AftersalesStatus,
  AftersalesType,
  CLOSE_REASON_LABEL,
  ESCALATION_REASON_LABEL,
  isFinalStatus,
  type AftersalesItem,
  type MerchantAftersalesDetail,
} from "@/types/aftersales";

export default function MerchantAftersalesDetailPage() {
  const params = useParams<{ id: string }>();
  const idOrNo = params.id;
  const { data, isLoading, isError, refetch } =
    useMerchantAftersalesDetail(idOrNo);

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
          href="/aftersales"
          className="text-sm text-[var(--color-primary)] hover:underline"
        >
          ← 返回售后列表
        </Link>
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          售后单加载失败。
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

  return <AftersalesDetailBody aftersales={data} />;
}

function AftersalesDetailBody({
  aftersales,
}: {
  aftersales: MerchantAftersalesDetail;
}) {
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [refuseOpen, setRefuseOpen] = useState(false);
  const [shipOpen, setShipOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* 面包屑 */}
      <div>
        <Link
          href="/aftersales"
          className="text-sm text-neutral-500 hover:text-[var(--color-primary)]"
        >
          ← 返回售后列表
        </Link>
      </div>

      {/* 头部 */}
      <header className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-mono text-xl font-semibold text-neutral-900">
              {aftersales.aftersales_no}
            </h2>
            <AftersalesStatusBadge status={aftersales.status} size="lg" />
            <AftersalesTypeIcon type={aftersales.type} />
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            创建于 {formatDateTime(aftersales.created_at)}
            {aftersales.merchant_reviewed_at
              ? ` · 审核于 ${formatDateTime(aftersales.merchant_reviewed_at)}`
              : null}
          </p>
          {aftersales.escalation_reason ? (
            <p className="mt-2 max-w-2xl rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <span className="font-semibold">
                升级原因：{ESCALATION_REASON_LABEL[aftersales.escalation_reason]}
              </span>
              {aftersales.escalated_at
                ? ` · ${formatDateTime(aftersales.escalated_at)}`
                : null}
            </p>
          ) : null}
          {aftersales.close_reason ? (
            <p className="mt-2 max-w-2xl rounded border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
              <span className="font-semibold">
                关闭原因：{CLOSE_REASON_LABEL[aftersales.close_reason]}
              </span>
              {aftersales.closed_at
                ? ` · ${formatDateTime(aftersales.closed_at)}`
                : null}
            </p>
          ) : null}
        </div>
      </header>

      {/* 双栏 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 左栏 */}
        <div className="space-y-6 lg:col-span-2">
          <UserOrderCard aftersales={aftersales} />
          <SummaryCard aftersales={aftersales} />
          <ItemsCard items={aftersales.items} />
          <ReturnLogisticsCard aftersales={aftersales} />
          <ExchangeLogisticsCard aftersales={aftersales} />
          <AftersalesEvidenceGallery evidences={aftersales.evidences} />
        </div>

        {/* 右栏 */}
        <div className="space-y-6">
          <ActionsPanel
            aftersales={aftersales}
            onApprove={() => setApproveOpen(true)}
            onReject={() => setRejectOpen(true)}
            onConfirmReceived={() => setConfirmOpen(true)}
            onRefuseReceive={() => setRefuseOpen(true)}
            onShipExchange={() => setShipOpen(true)}
          />
          <TimelineCard aftersales={aftersales} />
          <AftersalesNoteEditor aftersales={aftersales} />
        </div>
      </div>

      {/* Modals */}
      <ApproveModal
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        aftersales={aftersales}
      />
      <RejectModal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        aftersales={aftersales}
      />
      <ConfirmReceivedModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        aftersales={aftersales}
      />
      <RefuseReceiveModal
        open={refuseOpen}
        onClose={() => setRefuseOpen(false)}
        aftersales={aftersales}
      />
      <ShipExchangeModal
        open={shipOpen}
        onClose={() => setShipOpen(false)}
        aftersales={aftersales}
      />
    </div>
  );
}

// ============================================================================
// 状态操作面板
// ============================================================================

function ActionsPanel({
  aftersales,
  onApprove,
  onReject,
  onConfirmReceived,
  onRefuseReceive,
  onShipExchange,
}: {
  aftersales: MerchantAftersalesDetail;
  onApprove: () => void;
  onReject: () => void;
  onConfirmReceived: () => void;
  onRefuseReceive: () => void;
  onShipExchange: () => void;
}) {
  const { status } = aftersales;
  const deadline = getRelevantDeadline(aftersales);

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5">
      <h3 className="mb-3 text-sm font-semibold text-neutral-900">状态操作</h3>

      <div className="flex items-center gap-2 text-sm">
        <AftersalesStatusBadge status={status} />
        {deadline ? (
          <span className={cn("text-xs", deadlineTextClass(deadline.level))}>
            · {deadline.text}
          </span>
        ) : null}
      </div>

      <div className="mt-4 space-y-2">
        {status === AftersalesStatus.PendingMerchantReview ? (
          <>
            <Button variant="primary" fullWidth onClick={onApprove}>
              同意售后
            </Button>
            <Button variant="danger" fullWidth onClick={onReject}>
              驳回
            </Button>
            <p className="text-xs text-neutral-500">
              审核超时（72h）将自动升级至平台仲裁
            </p>
          </>
        ) : status === AftersalesStatus.MerchantAgreedWaitingReturn ? (
          <p className="rounded-md bg-blue-50 px-3 py-2 text-xs text-neutral-700">
            已同意售后，等待用户 7 天内寄回商品。
            {aftersales.return_ship_deadline
              ? ` 寄回截止：${formatDateTime(aftersales.return_ship_deadline)}`
              : null}
          </p>
        ) : status === AftersalesStatus.ReturnShippedWaitingReceive ? (
          <>
            <Button variant="primary" fullWidth onClick={onConfirmReceived}>
              确认收货
            </Button>
            <Button variant="danger" fullWidth onClick={onRefuseReceive}>
              拒收（升级平台）
            </Button>
            <p className="text-xs text-neutral-500">
              15 天未处理将自动认为已收货
              {aftersales.merchant_receive_deadline
                ? ` · 截止 ${formatDateTime(aftersales.merchant_receive_deadline)}`
                : ""}
            </p>
          </>
        ) : status === AftersalesStatus.MerchantAgreedWaitingShip ? (
          <>
            <Button variant="primary" fullWidth onClick={onShipExchange}>
              发货换货
            </Button>
            <p className="text-xs text-neutral-500">
              请及时安排换货发出，用户已在等待。
            </p>
          </>
        ) : status === AftersalesStatus.ExchangeShippedWaitingReceive ? (
          <p className="rounded-md bg-blue-50 px-3 py-2 text-xs text-neutral-700">
            换货已发出，等待用户确认。
            {aftersales.exchange_confirm_deadline
              ? ` 15 天后系统自动确认（截止 ${formatDateTime(
                  aftersales.exchange_confirm_deadline,
                )}）。`
              : null}
          </p>
        ) : status === AftersalesStatus.Refunding ? (
          <p className="rounded-md bg-purple-50 px-3 py-2 text-xs text-purple-800">
            退款处理中，请稍候。
          </p>
        ) : status === AftersalesStatus.AdminArbitrating ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
            售后单已升级至平台仲裁，商家无法直接操作，请等待客服处理。
          </p>
        ) : status === AftersalesStatus.MerchantRejected ? (
          <p className="rounded-md bg-neutral-100 px-3 py-2 text-xs text-neutral-600">
            已驳回。用户 1 次内可发起申诉；申诉后将升级至平台仲裁。
          </p>
        ) : isFinalStatus(status) ? (
          <p className="rounded-md bg-neutral-100 px-3 py-2 text-xs text-neutral-500">
            售后单已结束，无可用操作。
          </p>
        ) : null}
      </div>
    </section>
  );
}

/**
 * 依据当前状态选择要展示的 deadline。
 */
function getRelevantDeadline(a: MerchantAftersalesDetail) {
  switch (a.status) {
    case AftersalesStatus.PendingMerchantReview:
      return computeDeadlineInfo(a.merchant_review_deadline);
    case AftersalesStatus.MerchantAgreedWaitingReturn:
      return computeDeadlineInfo(a.return_ship_deadline);
    case AftersalesStatus.ReturnShippedWaitingReceive:
      return computeDeadlineInfo(a.merchant_receive_deadline);
    case AftersalesStatus.ExchangeShippedWaitingReceive:
      return computeDeadlineInfo(a.exchange_confirm_deadline);
    default:
      return null;
  }
}

// ============================================================================
// 用户 + 订单信息
// ============================================================================

function UserOrderCard({
  aftersales,
}: {
  aftersales: MerchantAftersalesDetail;
}) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5">
      <h3 className="mb-3 text-sm font-semibold text-neutral-900">
        用户 & 订单
      </h3>
      <dl className="grid grid-cols-1 gap-y-2 text-sm sm:grid-cols-[6rem_1fr]">
        <dt className="text-neutral-500">用户</dt>
        <dd className="text-neutral-900">
          {aftersales.user_display_name ?? `用户 #${aftersales.user_id}`}
        </dd>
        {aftersales.user_phone ? (
          <>
            <dt className="text-neutral-500">联系电话</dt>
            <dd className="font-mono text-neutral-900" title="出于隐私已脱敏">
              {maskPhone(aftersales.user_phone)}
            </dd>
          </>
        ) : null}
        <dt className="text-neutral-500">订单号</dt>
        <dd>
          <Link
            href={`/orders/${aftersales.order_no}`}
            className="font-mono text-[var(--color-primary)] hover:underline"
          >
            {aftersales.order_no}
          </Link>
        </dd>
        {aftersales.receiver_name ? (
          <>
            <dt className="text-neutral-500">收货人</dt>
            <dd className="text-neutral-900">
              {aftersales.receiver_name}
              {aftersales.receiver_phone ? (
                <span className="ml-2 font-mono text-xs text-neutral-500">
                  {maskPhone(aftersales.receiver_phone)}
                </span>
              ) : null}
            </dd>
          </>
        ) : null}
        {aftersales.receiver_address ? (
          <>
            <dt className="text-neutral-500">原收货地址</dt>
            <dd className="text-neutral-900">{aftersales.receiver_address}</dd>
          </>
        ) : null}
      </dl>
    </section>
  );
}

// ============================================================================
// 售后摘要
// ============================================================================

function SummaryCard({ aftersales }: { aftersales: MerchantAftersalesDetail }) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5">
      <h3 className="mb-3 text-sm font-semibold text-neutral-900">
        售后申请摘要
      </h3>
      <dl className="grid grid-cols-1 gap-y-2 text-sm sm:grid-cols-[6rem_1fr]">
        <dt className="text-neutral-500">类型</dt>
        <dd className="text-neutral-900">
          {AFTERSALES_TYPE_LABEL[aftersales.type]}
        </dd>
        <dt className="text-neutral-500">原因分类</dt>
        <dd className="text-neutral-900">
          {AFTERSALES_REASON_LABEL[aftersales.reason_category]}
        </dd>
        <dt className="text-neutral-500">用户说明</dt>
        <dd className="whitespace-pre-line text-neutral-900">
          {aftersales.reason_note}
        </dd>
        <dt className="text-neutral-500">申请金额</dt>
        <dd className="font-medium text-neutral-900">
          {formatCentsCny(aftersales.refund_amount_cents)}
        </dd>
        {aftersales.actual_refund_cents !== null ? (
          <>
            <dt className="text-neutral-500">实退金额</dt>
            <dd className="font-medium text-emerald-700">
              {formatCentsCny(aftersales.actual_refund_cents)}
            </dd>
          </>
        ) : null}
        {aftersales.return_address ? (
          <>
            <dt className="text-neutral-500">退货地址</dt>
            <dd className="text-neutral-900">{aftersales.return_address}</dd>
          </>
        ) : null}
        {aftersales.refund_txn_no ? (
          <>
            <dt className="text-neutral-500">退款流水</dt>
            <dd className="font-mono text-xs text-neutral-700">
              {aftersales.refund_txn_no}
            </dd>
          </>
        ) : null}
      </dl>
    </section>
  );
}

// ============================================================================
// 商品明细
// ============================================================================

function ItemsCard({ items }: { items: AftersalesItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <header className="border-b border-neutral-100 px-5 py-3">
        <h3 className="text-sm font-semibold text-neutral-900">
          售后商品明细 · {items.length} 项
        </h3>
      </header>
      <table className="w-full text-sm">
        <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
          <tr>
            <th className="w-16 px-4 py-2">图</th>
            <th className="px-4 py-2">商品</th>
            <th className="w-24 px-4 py-2 text-right">单价</th>
            <th className="w-16 px-4 py-2 text-right">退数量</th>
            <th className="w-28 px-4 py-2 text-right">退款金额</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {items.map((it) => (
            <tr key={it.id}>
              <td className="px-4 py-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl(it.sku_image ?? null)}
                  alt={it.spu_title ?? "商品图片"}
                  className="h-12 w-12 rounded object-cover"
                />
              </td>
              <td className="px-4 py-3">
                <div className="line-clamp-2 text-neutral-900">
                  {it.spu_title ?? `商品 #${it.order_item_id}`}
                </div>
                {it.sku_specs && Object.keys(it.sku_specs).length > 0 ? (
                  <div className="mt-0.5 text-xs text-neutral-500">
                    {Object.entries(it.sku_specs)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(" · ")}
                  </div>
                ) : null}
              </td>
              <td className="px-4 py-3 text-right text-neutral-700">
                {it.unit_price_cents !== undefined
                  ? formatCentsCny(it.unit_price_cents)
                  : "—"}
              </td>
              <td className="px-4 py-3 text-right text-neutral-700">
                × {it.quantity}
              </td>
              <td className="px-4 py-3 text-right font-medium text-neutral-900">
                {formatCentsCny(it.refund_amount_cents)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// ============================================================================
// 用户回寄物流
// ============================================================================

function ReturnLogisticsCard({
  aftersales,
}: {
  aftersales: MerchantAftersalesDetail;
}) {
  // 只对 return_refund / exchange 且用户已回填过 tracking 时才显示
  if (
    aftersales.type === AftersalesType.RefundOnly ||
    !aftersales.return_tracking_no
  ) {
    return null;
  }
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5">
      <h3 className="mb-3 text-sm font-semibold text-neutral-900">
        用户回寄物流
      </h3>
      <dl className="grid grid-cols-1 gap-y-2 text-sm sm:grid-cols-[6rem_1fr]">
        <dt className="text-neutral-500">快递公司</dt>
        <dd className="text-neutral-900">
          {carrierLabel(aftersales.return_carrier)}
        </dd>
        <dt className="text-neutral-500">运单号</dt>
        <dd className="font-mono text-neutral-900">
          {aftersales.return_tracking_no}
        </dd>
        {aftersales.return_shipped_at ? (
          <>
            <dt className="text-neutral-500">寄出时间</dt>
            <dd className="text-neutral-900">
              {formatDateTime(aftersales.return_shipped_at)}
            </dd>
          </>
        ) : null}
        {aftersales.merchant_received_at ? (
          <>
            <dt className="text-neutral-500">商家收货时间</dt>
            <dd className="text-neutral-900">
              {formatDateTime(aftersales.merchant_received_at)}
            </dd>
          </>
        ) : null}
        {aftersales.merchant_refuse_receive ? (
          <>
            <dt className="text-neutral-500">拒收说明</dt>
            <dd className="text-red-700">
              {aftersales.merchant_refuse_note ?? "已拒收"}
            </dd>
          </>
        ) : null}
      </dl>
    </section>
  );
}

// ============================================================================
// 换货再发货物流
// ============================================================================

function ExchangeLogisticsCard({
  aftersales,
}: {
  aftersales: MerchantAftersalesDetail;
}) {
  if (
    aftersales.type !== AftersalesType.Exchange ||
    !aftersales.exchange_tracking_no
  ) {
    return null;
  }
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5">
      <h3 className="mb-3 text-sm font-semibold text-neutral-900">
        换货再发货物流
      </h3>
      <dl className="grid grid-cols-1 gap-y-2 text-sm sm:grid-cols-[6rem_1fr]">
        <dt className="text-neutral-500">快递公司</dt>
        <dd className="text-neutral-900">
          {carrierLabel(aftersales.exchange_carrier)}
        </dd>
        <dt className="text-neutral-500">运单号</dt>
        <dd className="font-mono text-neutral-900">
          {aftersales.exchange_tracking_no}
        </dd>
        {aftersales.exchange_shipped_at ? (
          <>
            <dt className="text-neutral-500">发货时间</dt>
            <dd className="text-neutral-900">
              {formatDateTime(aftersales.exchange_shipped_at)}
            </dd>
          </>
        ) : null}
        {aftersales.exchange_confirmed_at ? (
          <>
            <dt className="text-neutral-500">用户确认</dt>
            <dd className="text-neutral-900">
              {formatDateTime(aftersales.exchange_confirmed_at)}
            </dd>
          </>
        ) : null}
      </dl>
    </section>
  );
}

// ============================================================================
// Timeline 卡片包装
// ============================================================================

function TimelineCard({
  aftersales,
}: {
  aftersales: MerchantAftersalesDetail;
}) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5">
      <h3 className="mb-3 text-sm font-semibold text-neutral-900">
        售后时间轴
      </h3>
      <AftersalesTimeline
        history={aftersales.status_history}
        messages={aftersales.messages}
      />
    </section>
  );
}
