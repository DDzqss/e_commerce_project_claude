"use client";

/**
 * 拒收 Modal —— return_shipped_waiting_receive → admin_arbitrating。
 *
 * 关键点（§8.3 refuse-receive）：
 *   - refuse_note ≥ 10 字必填
 *   - **强警告**："拒收将自动升级平台仲裁"，需二次勾选
 *   - 附凭证图片强烈建议（用户端可看）
 */

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { MultiImageUpload } from "@/components/ui/MultiImageUpload";
import { toast } from "@/components/ui/Toast";
import { refuseReceive } from "@/lib/aftersales-api";
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

const MIN_NOTE_LEN = 10;
const MAX_NOTE_LEN = 500;

export interface RefuseReceiveModalProps {
  open: boolean;
  onClose: () => void;
  aftersales: Pick<MerchantAftersalesListItem, "id" | "aftersales_no">;
  onSuccess?: (updated: MerchantAftersalesDetail) => void;
}

export function RefuseReceiveModal({
  open,
  onClose,
  aftersales,
  onSuccess,
}: RefuseReceiveModalProps) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [evidenceKeys, setEvidenceKeys] = useState<string[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [confirmChecked, setConfirmChecked] = useState(false);

  useEffect(() => {
    if (open) {
      setNote("");
      setEvidenceKeys([]);
      setError(undefined);
      setConfirmChecked(false);
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: () =>
      refuseReceive(aftersales.id, {
        refuse_note: note.trim(),
        evidence_image_keys: evidenceKeys.length > 0 ? evidenceKeys : undefined,
      }),
    onSuccess: (data) => {
      toast.success("已拒收，售后单已升级至平台仲裁");
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
    const trimmed = note.trim();
    if (trimmed.length < MIN_NOTE_LEN) {
      setError(`请填写拒收原因（至少 ${MIN_NOTE_LEN} 字）`);
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
      title={`拒收商品 · ${aftersales.aftersales_no}`}
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
            确认拒收
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-3 text-xs text-red-800">
          <p className="font-bold text-sm text-red-900">
            ⚠ 严重警告：拒收将自动升级平台仲裁
          </p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
            <li>
              售后单立即转入 <strong>平台仲裁中</strong>，商家无法再自行处理
            </li>
            <li>平台客服将介入调查，可能强制退款</li>
            <li>频繁拒收将影响店铺信用评级</li>
            <li>请务必确认商品确实存在问题（如破损、非本店商品等）</li>
          </ul>
        </div>

        <FormField
          label="拒收原因"
          required
          error={error && error.includes("原因") ? error : undefined}
          hint={
            !error || !error.includes("原因")
              ? `至少 ${MIN_NOTE_LEN} 字，详细说明拒收依据。`
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
              placeholder="例：包裹外观完好，但拆开后发现内含物非本店商品，编号 XX 与订单不匹配。"
              disabled={mutation.isPending}
              className="block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-neutral-50"
            />
          )}
        </FormField>
        <div className="text-right text-[11px] text-neutral-400">
          {note.length} / {MAX_NOTE_LEN}
        </div>

        <FormField label="拒收凭证" hint="强烈建议上传拆包照片、外包装照片">
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

        <label className="flex items-start gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={confirmChecked}
            onChange={(e) => {
              setConfirmChecked(e.target.checked);
              if (error && error.includes("勾选")) setError(undefined);
            }}
            disabled={mutation.isPending}
            className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-red-600 focus:ring-red-500"
          />
          <span>
            我已知悉：拒收后售后单将自动升级至<strong>平台仲裁</strong>
            ，无法撤回；如信息不实将影响店铺信用。
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
