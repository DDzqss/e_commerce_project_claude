"use client";

/**
 * 商家备注编辑器 —— 内嵌于订单详情页。
 * 与 backend `POST /merchant/orders/{id}/note` 对齐，覆盖式更新。
 *
 * 交互：
 *   - 只读态显示当前备注（如无则显示占位）
 *   - 点"编辑" 进入受控 textarea；"保存"/"取消" 按钮
 *   - 保存成功后回落只读态
 */

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { addMerchantNote } from "@/lib/order-api";
import { ApiError } from "@/types/errors";
import {
  MERCHANT_ORDER_QUERY_KEY,
  MERCHANT_ORDERS_QUERY_KEY,
} from "@/hooks/useMerchantOrders";
import type { MerchantOrderDetail } from "@/types/order";

const MAX_LEN = 500;

export interface MerchantNoteEditorProps {
  order: Pick<MerchantOrderDetail, "id" | "merchant_note">;
}

export function MerchantNoteEditor({ order }: MerchantNoteEditorProps) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(order.merchant_note ?? "");

  // 数据刷新后同步本地态（避免旧值残留）
  useEffect(() => {
    if (!editing) setText(order.merchant_note ?? "");
  }, [order.merchant_note, editing]);

  const mutation = useMutation({
    mutationFn: () => addMerchantNote(order.id, { merchant_note: text.trim() }),
    onSuccess: () => {
      toast.success("备注已保存");
      queryClient.invalidateQueries({ queryKey: MERCHANT_ORDER_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: MERCHANT_ORDERS_QUERY_KEY });
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
            {order.merchant_note ? "编辑" : "添加备注"}
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
            placeholder="例：感谢您的购买，如有任何疑问随时联系店铺客服。"
            disabled={mutation.isPending}
            className="block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-neutral-50"
          />
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span>用户可在订单详情看到此备注</span>
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
                setText(order.merchant_note ?? "");
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
          {order.merchant_note ? (
            order.merchant_note
          ) : (
            <span className="text-neutral-400">暂无备注</span>
          )}
        </p>
      )}
    </section>
  );
}
