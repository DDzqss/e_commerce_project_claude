"use client";

/**
 * 取消订单 Modal —— 商家侧仅支持 paid → cancelled（缺货等场景）。
 *
 * 关键点：
 *   - cancel_note 必填（≥ 5 字符）
 *   - 强提示："取消后库存自动返回；已支付订单进入 Phase 4 售后退款流程"
 *   - 二次确认防误操作
 */

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toast";
import { cancelOrder } from "@/lib/order-api";
import { ApiError } from "@/types/errors";
import type { MerchantOrderDetail } from "@/types/order";
import {
  MERCHANT_ORDER_QUERY_KEY,
  MERCHANT_ORDERS_QUERY_KEY,
  MERCHANT_ORDER_STATS_KEY,
} from "@/hooks/useMerchantOrders";

const MIN_NOTE_LEN = 5;
const MAX_NOTE_LEN = 200;

export interface CancelOrderModalProps {
  open: boolean;
  onClose: () => void;
  order: Pick<MerchantOrderDetail, "id" | "order_no" | "status">;
  onSuccess?: (updated: MerchantOrderDetail) => void;
}

export function CancelOrderModal({
  open,
  onClose,
  order,
  onSuccess,
}: CancelOrderModalProps) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [confirmChecked, setConfirmChecked] = useState(false);

  useEffect(() => {
    if (open) {
      setNote("");
      setError(undefined);
      setConfirmChecked(false);
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: () => cancelOrder(order.id, { cancel_note: note.trim() }),
    onSuccess: (data) => {
      toast.success("订单已取消，库存已返回");
      queryClient.invalidateQueries({ queryKey: MERCHANT_ORDER_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: MERCHANT_ORDERS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: MERCHANT_ORDER_STATS_KEY });
      onSuccess?.(data);
      onClose();
    },
    onError: (e) => {
      const msg = e instanceof ApiError ? e.toUserMessage() : "取消失败，请重试";
      toast.error(msg);
    },
  });

  const handleSubmit = () => {
    if (mutation.isPending) return;
    const trimmed = note.trim();
    if (trimmed.length < MIN_NOTE_LEN) {
      setError(`请填写取消原因（至少 ${MIN_NOTE_LEN} 字），用户可看到`);
      return;
    }
    if (trimmed.length > MAX_NOTE_LEN) {
      setError(`原因不超过 ${MAX_NOTE_LEN} 字`);
      return;
    }
    if (!confirmChecked) {
      setError("请勾选下方确认框");
      return;
    }
    setError(undefined);
    mutation.mutate();
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!mutation.isPending) onClose();
      }}
      title={`取消订单 · ${order.order_no}`}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            返回
          </Button>
          <Button
            variant="danger"
            onClick={handleSubmit}
            loading={mutation.isPending}
            disabled={!confirmChecked}
          >
            确认取消订单
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <p className="font-semibold">此操作不可逆，请谨慎确认：</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            <li>库存会自动返回可售池</li>
            <li>用户可在订单详情看到取消原因</li>
            <li>
              已支付订单意味着<strong>用户已付款</strong>，需通过 Phase 4 售后退款流程返还款项
            </li>
          </ul>
        </div>

        <FormField
          label="取消原因"
          required
          error={error && error.includes("原因") ? error : undefined}
          hint={
            !error || !error.includes("原因")
              ? `至少 ${MIN_NOTE_LEN} 字。用户会看到此说明，请措辞礼貌。`
              : undefined
          }
        >
          {(id) => (
            <textarea
              id={id}
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                if (error) setError(undefined);
              }}
              rows={3}
              maxLength={MAX_NOTE_LEN}
              placeholder="例：抱歉，此商品临时缺货，将协助您办理退款。"
              disabled={mutation.isPending}
              className="block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-neutral-50"
            />
          )}
        </FormField>
        <div className="text-right text-[11px] text-neutral-400">
          {note.length} / {MAX_NOTE_LEN}
        </div>

        <label className="flex items-start gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={confirmChecked}
            onChange={(e) => {
              setConfirmChecked(e.target.checked);
              if (error && error.includes("勾选")) setError(undefined);
            }}
            disabled={mutation.isPending}
            className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
          />
          <span>
            我已知悉：库存将释放，且已支付订单需在 Phase 4 售后流程中完成退款。
          </span>
        </label>
        {error && error.includes("勾选") ? (
          <p role="alert" className="text-xs text-red-600">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
