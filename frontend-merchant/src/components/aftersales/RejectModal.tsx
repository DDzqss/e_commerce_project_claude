"use client";

/**
 * 拒绝售后 Modal —— pending_merchant_review → merchant_rejected。
 *
 * 关键点（§8.2 reject）：
 *   - review_note ≥ 5 字必填
 *   - 二次确认："驳回后用户可申诉 1 次"
 *   - 拒绝的措辞会展示给用户 —— UI 提示需谨慎
 */

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toast";
import { rejectAftersales } from "@/lib/aftersales-api";
import {
  MERCHANT_AFTERSALES_DETAIL_KEY,
  MERCHANT_AFTERSALES_QUERY_KEY,
  MERCHANT_AFTERSALES_STATS_KEY,
} from "@/hooks/useMerchantAftersales";
import { ApiError } from "@/types/errors";
import type {
  MerchantAftersalesDetail,
  MerchantAftersalesListItem,
} from "@/types/aftersales";

const MIN_NOTE_LEN = 5;
const MAX_NOTE_LEN = 500;

export interface RejectModalProps {
  open: boolean;
  onClose: () => void;
  aftersales: Pick<MerchantAftersalesListItem, "id" | "aftersales_no">;
  onSuccess?: (updated: MerchantAftersalesDetail) => void;
}

export function RejectModal({
  open,
  onClose,
  aftersales,
  onSuccess,
}: RejectModalProps) {
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
    mutationFn: () =>
      rejectAftersales(aftersales.id, { review_note: note.trim() }),
    onSuccess: (data) => {
      toast.success("已驳回售后申请");
      queryClient.invalidateQueries({ queryKey: MERCHANT_AFTERSALES_QUERY_KEY });
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
      const msg = e instanceof ApiError ? e.toUserMessage() : "驳回失败，请重试";
      toast.error(msg);
    },
  });

  const handleSubmit = () => {
    if (mutation.isPending) return;
    const trimmed = note.trim();
    if (trimmed.length < MIN_NOTE_LEN) {
      setError(`请填写驳回原因（至少 ${MIN_NOTE_LEN} 字），用户可看到`);
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
      title={`驳回售后 · ${aftersales.aftersales_no}`}
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
            确认驳回
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <p className="font-semibold">请谨慎驳回：</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            <li>用户可在售后详情看到驳回原因</li>
            <li>
              <strong>用户可申诉 1 次</strong>；申诉后售后单将升级至平台仲裁
            </li>
            <li>建议在驳回前先与用户沟通清楚</li>
          </ul>
        </div>

        <FormField
          label="驳回原因"
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
              rows={4}
              maxLength={MAX_NOTE_LEN}
              placeholder="例：您好，商品经检验符合出厂标准，未发现质量问题；如有疑问可申诉由平台仲裁。"
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
            我已知悉：驳回后用户可申诉 1 次，申诉将升级至平台客服仲裁。
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
