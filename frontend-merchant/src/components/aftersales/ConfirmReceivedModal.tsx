"use client";

/**
 * 确认收货 Modal —— return_shipped_waiting_receive → refunding / merchant_agreed_waiting_ship。
 *
 * 关键点（§8.3 confirm-received）：
 *   - note 可选（≤ 200）
 *   - evidence 可选（0..8 张，purpose=aftersales_merchant_receive）
 *   - RETURN_REFUND 后自动进入 refunding
 *   - EXCHANGE 后进入 waiting_ship，商家再发货
 */

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { MultiImageUpload } from "@/components/ui/MultiImageUpload";
import { toast } from "@/components/ui/Toast";
import { confirmReceived } from "@/lib/aftersales-api";
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

const MAX_NOTE_LEN = 200;

export interface ConfirmReceivedModalProps {
  open: boolean;
  onClose: () => void;
  aftersales: Pick<
    MerchantAftersalesListItem,
    "id" | "aftersales_no" | "type"
  >;
  onSuccess?: (updated: MerchantAftersalesDetail) => void;
}

export function ConfirmReceivedModal({
  open,
  onClose,
  aftersales,
  onSuccess,
}: ConfirmReceivedModalProps) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [evidenceKeys, setEvidenceKeys] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setNote("");
      setEvidenceKeys([]);
    }
  }, [open]);

  const noticeText =
    aftersales.type === AftersalesType.Exchange
      ? "确认收货后将进入 “待再发货” 状态，请及时安排换货发出。"
      : "确认收货后将立刻触发退款流程，此操作不可撤销。";

  const mutation = useMutation({
    mutationFn: () =>
      confirmReceived(aftersales.id, {
        note: note.trim() ? note.trim() : undefined,
        evidence_image_keys: evidenceKeys.length > 0 ? evidenceKeys : undefined,
      }),
    onSuccess: (data) => {
      toast.success("已确认收货");
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
      const msg = e instanceof ApiError ? e.toUserMessage() : "操作失败，请重试";
      toast.error(msg);
    },
  });

  const handleSubmit = () => {
    if (mutation.isPending) return;
    if (note.length > MAX_NOTE_LEN) {
      toast.error(`备注不超过 ${MAX_NOTE_LEN} 字`);
      return;
    }
    mutation.mutate();
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!mutation.isPending) onClose();
      }}
      title={`确认收货 · ${aftersales.aftersales_no}`}
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
            确认收货
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          {noticeText}
        </div>

        <FormField
          label="收货备注"
          hint={`可选，最多 ${MAX_NOTE_LEN} 字，仅内部可见`}
        >
          {(id) => (
            <textarea
              id={id}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={MAX_NOTE_LEN}
              placeholder="例：商品外观良好，附件齐全。"
              disabled={mutation.isPending}
              className="block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-neutral-50"
            />
          )}
        </FormField>

        <FormField label="收货凭证" hint="可选，最多 8 张（JPG/PNG/WebP）">
          {() => (
            <MultiImageUpload
              value={evidenceKeys}
              onChange={setEvidenceKeys}
              purpose="aftersales_merchant_receive"
              max={8}
              disabled={mutation.isPending}
            />
          )}
        </FormField>
      </div>
    </Modal>
  );
}
