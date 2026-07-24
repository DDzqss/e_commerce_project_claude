"use client";

/**
 * 同意售后 Modal —— 商家在 pending_merchant_review 状态推进。
 *
 * 关键校验（§8.2 approve）：
 *   - actual_refund_cents 可减不可增：≤ 用户申请值（refund_amount_cents）
 *   - RETURN_REFUND / EXCHANGE 必填 return_address（≥ 10 字）
 *   - review_note 可选（≤ 500）
 *
 * 说明：同意 RETURN_REFUND / EXCHANGE 后，用户需 7 天内寄回，否则系统关闭。
 */

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { PriceInput } from "@/components/ui/PriceInput";
import { toast } from "@/components/ui/Toast";
import { approveAftersales } from "@/lib/aftersales-api";
import {
  MERCHANT_AFTERSALES_DETAIL_KEY,
  MERCHANT_AFTERSALES_QUERY_KEY,
  MERCHANT_AFTERSALES_STATS_KEY,
} from "@/hooks/useMerchantAftersales";
import { ApiError } from "@/types/errors";
import {
  AftersalesType,
  type MerchantAftersalesDetail,
  type MerchantAftersalesListItem,
} from "@/types/aftersales";

const MAX_ADDRESS_LEN = 200;
const MIN_ADDRESS_LEN = 10;
const MAX_NOTE_LEN = 500;

export interface ApproveModalProps {
  open: boolean;
  onClose: () => void;
  aftersales: Pick<
    MerchantAftersalesListItem,
    "id" | "aftersales_no" | "type" | "refund_amount_cents"
  >;
  onSuccess?: (updated: MerchantAftersalesDetail) => void;
}

export function ApproveModal({
  open,
  onClose,
  aftersales,
  onSuccess,
}: ApproveModalProps) {
  const queryClient = useQueryClient();

  // 用户申请金额（分）
  const maxCents = aftersales.refund_amount_cents;
  const needAddress =
    aftersales.type === AftersalesType.ReturnRefund ||
    aftersales.type === AftersalesType.Exchange;

  const [actualCents, setActualCents] = useState<number | null>(maxCents);
  const [returnAddress, setReturnAddress] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [errors, setErrors] = useState<{
    actual?: string;
    address?: string;
    note?: string;
  }>({});

  useEffect(() => {
    if (open) {
      setActualCents(maxCents);
      setReturnAddress("");
      setReviewNote("");
      setErrors({});
    }
  }, [open, maxCents]);

  const noticeText = useMemo(() => {
    if (aftersales.type === AftersalesType.RefundOnly) {
      return "同意后将立刻触发退款流程，几乎瞬时完成。此操作不可撤销。";
    }
    return "同意后用户需在 7 天内寄回商品，超时未寄回将系统关闭。";
  }, [aftersales.type]);

  const mutation = useMutation({
    mutationFn: () =>
      approveAftersales(aftersales.id, {
        actual_refund_cents: actualCents ?? 0,
        return_address: needAddress ? returnAddress.trim() : undefined,
        review_note: reviewNote.trim() ? reviewNote.trim() : undefined,
      }),
    onSuccess: (data) => {
      toast.success("已同意售后申请");
      queryClient.invalidateQueries({
        queryKey: MERCHANT_AFTERSALES_QUERY_KEY,
      });
      queryClient.invalidateQueries({
        queryKey: MERCHANT_AFTERSALES_DETAIL_KEY,
      });
      queryClient.invalidateQueries({
        queryKey: MERCHANT_AFTERSALES_STATS_KEY,
      });
      onSuccess?.(data);
      onClose();
    },
    onError: (e) => {
      const msg = e instanceof ApiError ? e.toUserMessage() : "操作失败，请重试";
      toast.error(msg);
    },
  });

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (
      actualCents === null ||
      !Number.isFinite(actualCents) ||
      actualCents <= 0 ||
      !Number.isInteger(actualCents)
    ) {
      next.actual = "请输入有效金额";
    } else if (actualCents > maxCents) {
      next.actual = `不能高于用户申请的 ¥${(maxCents / 100).toFixed(2)}`;
    }
    if (needAddress) {
      const a = returnAddress.trim();
      if (a.length < MIN_ADDRESS_LEN) {
        next.address = `退货地址不少于 ${MIN_ADDRESS_LEN} 字`;
      } else if (a.length > MAX_ADDRESS_LEN) {
        next.address = `退货地址不超过 ${MAX_ADDRESS_LEN} 字`;
      }
    }
    if (reviewNote.length > MAX_NOTE_LEN) {
      next.note = `备注不超过 ${MAX_NOTE_LEN} 字`;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = () => {
    if (mutation.isPending) return;
    if (!validate()) return;
    mutation.mutate();
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!mutation.isPending) onClose();
      }}
      title={`同意售后 · ${aftersales.aftersales_no}`}
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
            variant="primary"
            onClick={handleSubmit}
            loading={mutation.isPending}
          >
            确认同意
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {noticeText}
        </div>

        <FormField
          label="实际退款金额"
          required
          error={errors.actual}
          hint={
            !errors.actual
              ? `用户申请 ¥${(maxCents / 100).toFixed(2)}，可减不可增`
              : undefined
          }
        >
          {(id) => (
            <PriceInput
              id={id}
              valueCents={actualCents}
              onChangeCents={(v) => {
                setActualCents(v);
                if (errors.actual)
                  setErrors((s) => ({ ...s, actual: undefined }));
              }}
              invalid={!!errors.actual}
              disabled={mutation.isPending}
              allowZero={false}
            />
          )}
        </FormField>

        {needAddress ? (
          <FormField
            label="退货地址"
            required
            error={errors.address}
            hint={
              !errors.address
                ? "用户会看到此地址；请填写完整省市区门牌"
                : undefined
            }
          >
            {(id) => (
              <textarea
                id={id}
                value={returnAddress}
                onChange={(e) => {
                  setReturnAddress(e.target.value);
                  if (errors.address)
                    setErrors((s) => ({ ...s, address: undefined }));
                }}
                rows={2}
                maxLength={MAX_ADDRESS_LEN}
                placeholder="例：浙江省杭州市西湖区XX路XX号仓库 收"
                disabled={mutation.isPending}
                className="block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-neutral-50"
              />
            )}
          </FormField>
        ) : null}

        <FormField
          label="审核备注"
          error={errors.note}
          hint={!errors.note ? `可选，最多 ${MAX_NOTE_LEN} 字` : undefined}
        >
          {(id) => (
            <textarea
              id={id}
              value={reviewNote}
              onChange={(e) => {
                setReviewNote(e.target.value);
                if (errors.note)
                  setErrors((s) => ({ ...s, note: undefined }));
              }}
              rows={2}
              maxLength={MAX_NOTE_LEN}
              placeholder="例：感谢反馈，已为您安排退款。"
              disabled={mutation.isPending}
              className="block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-neutral-50"
            />
          )}
        </FormField>
      </div>
    </Modal>
  );
}
