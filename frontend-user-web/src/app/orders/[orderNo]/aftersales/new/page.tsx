"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { RequireAuth } from "@/components/auth/RequireAuth";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Price, formatYuan } from "@/components/ui/Price";
import { ImageWithFallback } from "@/components/ui/ImageWithFallback";
import { toast } from "@/components/ui/Toast";
import { ReasonCategoryPicker } from "@/components/aftersales/ReasonCategoryPicker";
import {
  EvidenceUploader,
  type EvidenceItem,
} from "@/components/aftersales/EvidenceUploader";
import { AftersalesTypeIcon } from "@/components/aftersales/AftersalesTypeIcon";
import { useOrder } from "@/hooks/useOrders";
import { useCreateAftersales } from "@/hooks/useAftersales";
import {
  clearIdempotencyKey,
  getOrCreateIdempotencyKey,
} from "@/lib/idempotency";
import { ApiError } from "@/lib/api";
import { messageForCode } from "@/types/errors";
import {
  AFTERSALES_TYPE_LABEL,
  AftersalesType,
  allowedAftersalesTypes,
  type ReasonCategory,
} from "@/types/aftersales";
import type { OrderItem } from "@/types/order";

export default function AftersalesApplyPage() {
  return (
    <RequireAuth>
      <div className="min-h-screen bg-neutral-50">
        <SiteHeader />
        <AftersalesApplyContent />
      </div>
    </RequireAuth>
  );
}

function AftersalesApplyContent() {
  const params = useParams<{ orderNo: string }>();
  const router = useRouter();
  const orderNo = params.orderNo;
  const {
    data: order,
    isLoading,
    isError,
    refetch,
  } = useOrder(orderNo);

  // 售后类型可选集合（依订单状态）
  const availableTypes = useMemo(
    () => (order ? allowedAftersalesTypes(order.status) : []),
    [order],
  );

  const [type, setType] = useState<AftersalesType | "">("");
  // 每个 order_item_id 对应用户希望退的数量（0 = 未选中）
  const [itemQty, setItemQty] = useState<Record<number, number>>({});
  const [refundAmountYuan, setRefundAmountYuan] = useState<string>("");
  const [reasonCategory, setReasonCategory] = useState<ReasonCategory | "">("");
  const [reasonNote, setReasonNote] = useState("");
  const [evidences, setEvidences] = useState<EvidenceItem[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const createMutation = useCreateAftersales();

  // 默认选中第一个可选类型
  useEffect(() => {
    const first = availableTypes[0];
    if (first && type === "") {
      setType(first);
    }
    if (first && type && !availableTypes.includes(type)) {
      setType(first);
    }
  }, [availableTypes, type]);

  // 初始化：默认全选，且数量 = 订单 quantity
  useEffect(() => {
    if (!order) return;
    setItemQty((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      const next: Record<number, number> = {};
      for (const it of order.items) {
        next[it.id] = it.quantity;
      }
      return next;
    });
  }, [order]);

  // 根据当前 itemQty 计算"最大可退"金额（分）
  const maxRefundCents = useMemo(() => {
    if (!order) return 0;
    let total = 0;
    for (const it of order.items) {
      const qty = itemQty[it.id] ?? 0;
      total += it.unit_price_cents * qty;
    }
    return total;
  }, [order, itemQty]);

  // 每次 max 变化：把金额自动预填为 max（用户可再改）
  useEffect(() => {
    if (maxRefundCents <= 0) {
      setRefundAmountYuan("");
      return;
    }
    setRefundAmountYuan((maxRefundCents / 100).toFixed(2));
  }, [maxRefundCents]);

  const selectedItems = useMemo(() => {
    if (!order) return [];
    return order.items.filter((it) => (itemQty[it.id] ?? 0) > 0);
  }, [order, itemQty]);

  const anyUploading = evidences.some((e) => e.uploading);

  // 校验并提交
  const submit = async () => {
    if (!order || !type) return;
    const nextErr: Record<string, string> = {};

    if (selectedItems.length === 0) {
      nextErr.items = "请至少选择一件商品";
    }
    if (!reasonCategory) {
      nextErr.reason_category = "请选择售后原因";
    }
    if (reasonNote.trim().length < 10) {
      nextErr.reason_note = "说明至少 10 个字";
    }
    if (reasonNote.trim().length > 500) {
      nextErr.reason_note = "说明不超过 500 字";
    }

    // 金额（仅 REFUND_ONLY / RETURN_REFUND 有校验，EXCHANGE 契约里 refund_amount_cents 无实际意义
    // 但后端仍要求 = 0 或与 max 一致；这里前端统一以数字校验）
    const yuanNum = Number(refundAmountYuan);
    if (
      type !== AftersalesType.Exchange &&
      (Number.isNaN(yuanNum) || yuanNum <= 0)
    ) {
      nextErr.refund_amount = "请填写有效的退款金额";
    } else if (yuanNum > maxRefundCents / 100) {
      nextErr.refund_amount = `退款金额不能超过 ${formatYuan(maxRefundCents)}`;
    }

    if (anyUploading) {
      nextErr.evidences = "还有图片正在上传中，请稍候";
    }

    setErrors(nextErr);
    if (Object.keys(nextErr).length > 0) return;

    const refundCents =
      type === AftersalesType.Exchange
        ? 0
        : Math.round(yuanNum * 100);
    const items = selectedItems.map((it) => ({
      order_item_id: it.id,
      quantity: itemQty[it.id] ?? 0,
    }));
    const evidence_image_keys = evidences
      .filter((e) => e.object_key && !e.uploading)
      .map((e) => e.object_key);

    // 幂等 key：按订单号+一次会话 scoping
    const idempotencyScope = `aftersales-apply:${order.order_no}`;
    const idempotencyKey = getOrCreateIdempotencyKey(idempotencyScope);

    setSubmitting(true);
    try {
      const detail = await createMutation.mutateAsync({
        orderIdOrNo: order.id,
        payload: {
          type,
          reason_category: reasonCategory as ReasonCategory,
          reason_note: reasonNote.trim(),
          items,
          refund_amount_cents: refundCents,
          evidence_image_keys,
        },
        idempotencyKey,
      });
      clearIdempotencyKey(idempotencyScope);
      toast.success("售后申请已提交");
      router.push(`/aftersales/${detail.id}`);
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? messageForCode(e.code, e.message)
          : "提交失败，请稍后重试";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-6">
        <Skeleton className="h-64 w-full" />
      </main>
    );
  }
  if (isError || !order) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-6">
        <div className="rounded-md border border-[color:var(--color-primary-200)] bg-[color:var(--color-primary-50)] px-4 py-3 text-sm text-[color:var(--color-primary-700)]">
          订单加载失败，
          <button
            type="button"
            className="ml-1 underline"
            onClick={() => refetch()}
          >
            重试
          </button>
        </div>
      </main>
    );
  }

  // 订单不允许发起售后 → 展示提示
  if (availableTypes.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-lg border border-neutral-200 bg-white p-8 text-center">
          <h1 className="text-lg font-semibold text-neutral-900">
            当前订单不支持发起售后
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            仅「已支付」「已发货」或「已完成」的订单可发起售后。
          </p>
          <div className="mt-4">
            <Link href={`/orders/${order.order_no}`}>
              <Button variant="secondary">返回订单</Button>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-6 pb-24">
      <h1 className="mb-4 text-2xl font-semibold text-neutral-900">
        发起售后申请
      </h1>

      {/* 订单摘要 */}
      <section className="mb-4 rounded-lg border border-neutral-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="text-neutral-500">
            订单号 {order.order_no} · {order.shop.name}
          </span>
          <Link
            href={`/orders/${order.order_no}`}
            className="text-neutral-500 hover:text-[color:var(--color-primary)]"
          >
            查看订单
          </Link>
        </div>
        <p className="text-sm text-neutral-600">
          请选择需要退货/退款的商品与数量，部分退款按选中项累计。
        </p>
      </section>

      {/* 类型选择 */}
      <section className="mb-4 rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-medium text-neutral-800">售后类型</h2>
        <div
          role="radiogroup"
          aria-label="售后类型"
          className="flex flex-wrap gap-2"
          data-testid="type-picker"
        >
          {availableTypes.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={type === t}
              onClick={() => setType(t)}
              data-testid={`type-option-${t}`}
              className={
                type === t
                  ? "flex items-center gap-2 rounded-md border border-[color:var(--color-primary)] bg-[color:var(--color-primary-50)] px-3 py-2 text-sm text-[color:var(--color-primary-700)]"
                  : "flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 hover:border-neutral-400"
              }
            >
              <AftersalesTypeIcon type={t} />
              {AFTERSALES_TYPE_LABEL[t]}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          {typeHint(type)}
        </p>
      </section>

      {/* 商品明细 */}
      <section className="mb-4 rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-medium text-neutral-800">
          选择商品与数量
        </h2>
        <ul className="divide-y divide-neutral-100">
          {order.items.map((it) => (
            <OrderItemRow
              key={it.id}
              item={it}
              qty={itemQty[it.id] ?? 0}
              onQtyChange={(q) =>
                setItemQty((prev) => ({ ...prev, [it.id]: q }))
              }
            />
          ))}
        </ul>
        {errors.items && (
          <p className="mt-2 text-xs text-[color:var(--color-primary)]">
            {errors.items}
          </p>
        )}
      </section>

      {/* 退款金额（EXCHANGE 时隐藏） */}
      {type !== AftersalesType.Exchange && (
        <section className="mb-4 rounded-lg border border-neutral-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-medium text-neutral-800">
            退款金额
          </h2>
          <div className="flex items-baseline gap-2">
            <span className="text-neutral-500">¥</span>
            <input
              type="text"
              inputMode="decimal"
              value={refundAmountYuan}
              onChange={(e) => setRefundAmountYuan(e.target.value)}
              className="h-10 w-40 rounded-md border border-neutral-300 bg-white px-3 text-sm tabular-nums focus:border-[color:var(--color-primary)] focus:outline-none"
              data-testid="refund-amount"
            />
            <span className="text-xs text-neutral-500">
              最多可退 {formatYuan(maxRefundCents)}
            </span>
          </div>
          {errors.refund_amount && (
            <p
              data-testid="refund-error"
              className="mt-2 text-xs text-[color:var(--color-primary)]"
            >
              {errors.refund_amount}
            </p>
          )}
        </section>
      )}

      {/* 原因分类 + 说明 */}
      <section className="mb-4 rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-medium text-neutral-800">
          售后原因
        </h2>
        <ReasonCategoryPicker
          value={reasonCategory}
          onChange={(c) => setReasonCategory(c)}
          error={errors.reason_category ?? null}
        />
        <div className="mt-4">
          <label
            htmlFor="reason-note"
            className="mb-1.5 block text-sm font-medium text-neutral-800"
          >
            详细说明
            <span
              aria-hidden
              className="ml-0.5 text-[color:var(--color-danger)]"
            >
              *
            </span>
            <span className="ml-2 text-xs text-neutral-500">
              {reasonNote.length} / 500，至少 10 字
            </span>
          </label>
          <textarea
            id="reason-note"
            data-testid="reason-note"
            maxLength={500}
            rows={4}
            aria-required="true"
            aria-invalid={Boolean(errors.reason_note) || undefined}
            aria-describedby={errors.reason_note ? "reason-note-err" : undefined}
            value={reasonNote}
            onChange={(e) => setReasonNote(e.target.value)}
            placeholder="请具体描述问题，便于商家/客服快速处理"
            className="block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-[color:var(--color-primary)] focus:outline-none"
          />
          {errors.reason_note && (
            <p
              id="reason-note-err"
              role="alert"
              aria-live="polite"
              className="mt-1 text-xs text-[color:var(--color-danger)]"
            >
              {errors.reason_note}
            </p>
          )}
        </div>
      </section>

      {/* 凭证 */}
      <section className="mb-4 rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-medium text-neutral-800">
          上传凭证（可选）
        </h2>
        <EvidenceUploader
          value={evidences}
          onChange={setEvidences}
          purpose="aftersales_apply"
          max={8}
        />
        {errors.evidences && (
          <p className="mt-2 text-xs text-[color:var(--color-primary)]">
            {errors.evidences}
          </p>
        )}
      </section>

      {/* 提交 */}
      <div className="sticky bottom-0 -mx-6 flex items-center justify-end gap-2 border-t border-neutral-200 bg-white/95 px-6 py-3 backdrop-blur">
        <span className="mr-auto text-xs text-neutral-500">
          {selectedItems.length > 0 && (
            <>
              已选 {selectedItems.length} 件商品，退款
              <Price cents={Math.min(maxRefundCents, Number(refundAmountYuan) * 100)} size="sm" className="ml-1" />
            </>
          )}
        </span>
        <Button variant="secondary" onClick={() => router.back()}>
          取消
        </Button>
        <Button
          onClick={() => void submit()}
          loading={submitting}
          data-testid="submit-aftersales"
        >
          提交申请
        </Button>
      </div>
    </main>
  );
}

/** 单个订单商品行：勾选 + 数量调节。 */
function OrderItemRow({
  item,
  qty,
  onQtyChange,
}: {
  item: OrderItem;
  qty: number;
  onQtyChange: (q: number) => void;
}) {
  const specText = Object.values(item.sku_specs ?? {}).join(" / ");
  const checked = qty > 0;
  return (
    <li className="flex items-start gap-3 py-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onQtyChange(e.target.checked ? item.quantity : 0)}
        aria-label={`选择 ${item.spu_title}`}
        data-testid={`item-check-${item.id}`}
        className="mt-2 h-4 w-4"
      />
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded border border-neutral-200 bg-neutral-50">
        <ImageWithFallback
          objectKey={item.sku_image}
          alt={item.spu_title}
          className="h-full w-full"
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="line-clamp-2 text-sm text-neutral-900">
          {item.spu_title}
        </div>
        {specText && (
          <div className="text-xs text-neutral-500">{specText}</div>
        )}
        <div className="mt-1 text-xs text-neutral-500">
          单价 {formatYuan(item.unit_price_cents)} · 已购 {item.quantity} 件
        </div>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs text-neutral-500" htmlFor={`qty-${item.id}`}>
          退货数量
        </label>
        <input
          id={`qty-${item.id}`}
          data-testid={`qty-${item.id}`}
          type="number"
          min={0}
          max={item.quantity}
          value={qty}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isNaN(v)) return;
            onQtyChange(Math.min(item.quantity, Math.max(0, Math.floor(v))));
          }}
          className="h-8 w-16 rounded border border-neutral-300 px-2 text-sm tabular-nums focus:border-[color:var(--color-primary)] focus:outline-none"
        />
      </div>
    </li>
  );
}

function typeHint(type: AftersalesType | ""): string {
  switch (type) {
    case AftersalesType.RefundOnly:
      return "仅退款：商家审核通过后，款项将原路退回。";
    case AftersalesType.ReturnRefund:
      return "退货退款：商家同意后你需按填入的地址寄回商品，商家验货后完成退款。";
    case AftersalesType.Exchange:
      return "换货：商家同意后你寄回原商品，商家验货后再发一件给你。";
    default:
      return "请选择售后类型";
  }
}
