"use client";

/**
 * 商家售后备注就地编辑器 —— 内嵌于售后详情页。
 * 复用 Phase 3 订单备注 UI 风格，改为售后端点。
 *
 * 与 backend `POST /merchant/aftersales/{id}/note` 对齐：覆盖式更新
 * `merchant_review_note`；任意状态可写。
 */

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { addMerchantNote } from "@/lib/aftersales-api";
import { ApiError } from "@/types/errors";
import {
  MERCHANT_AFTERSALES_DETAIL_KEY,
  MERCHANT_AFTERSALES_QUERY_KEY,
} from "@/hooks/useMerchantAftersales";
import type { MerchantAftersalesDetail } from "@/types/aftersales";

const MAX_LEN = 500;

export interface AftersalesNoteEditorProps {
  aftersales: Pick<MerchantAftersalesDetail, "id" | "merchant_review_note">;
}

export function AftersalesNoteEditor({ aftersales }: AftersalesNoteEditorProps) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(aftersales.merchant_review_note ?? "");

  useEffect(() => {
    if (!editing) setText(aftersales.merchant_review_note ?? "");
  }, [aftersales.merchant_review_note, editing]);

  const mutation = useMutation({
    mutationFn: () =>
      addMerchantNote(aftersales.id, { note: text.trim() }),
    onSuccess: () => {
      toast.success("备注已保存");
      queryClient.invalidateQueries({
        queryKey: MERCHANT_AFTERSALES_DETAIL_KEY,
      });
      queryClient.invalidateQueries({ queryKey: MERCHANT_AFTERSALES_QUERY_KEY });
      setEditing(false);
    },
    onError: (e) => {
      const msg = e instanceof ApiError ? e.toUserMessage() : "保存失败";
      toast.error(msg);
    },
  });

  const handleSave = () => {
    if (mutation.isPending) return;
    if (text.length > MAX_LEN) {
      toast.error(`备注不超过 ${MAX_LEN} 字`);
      return;
    }
    mutation.mutate();
  };

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-900">商家备注</h3>
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs text-[var(--color-primary)] hover:underline"
          >
            {aftersales.merchant_review_note ? "编辑" : "添加备注"}
          </button>
        ) : null}
      </header>

      {editing ? (
        <div className="space-y-3">
          <textarea
            rows={3}
            maxLength={MAX_LEN}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="例：已核对物流与商品，同意退款处理。"
            disabled={mutation.isPending}
            className="block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-neutral-50"
          />
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span>用户可在售后详情看到此备注</span>
            <span>
              {text.length} / {MAX_LEN}
            </span>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setEditing(false);
                setText(aftersales.merchant_review_note ?? "");
              }}
              disabled={mutation.isPending}
            >
              取消
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              loading={mutation.isPending}
            >
              保存
            </Button>
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-line text-sm text-neutral-700">
          {aftersales.merchant_review_note ? (
            aftersales.merchant_review_note
          ) : (
            <span className="text-neutral-400">暂无备注</span>
          )}
        </p>
      )}
    </section>
  );
}
