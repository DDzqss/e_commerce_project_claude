"use client";

/**
 * SKU 管理 tab —— 在 [id]/page.tsx 内被引用为 client 组件。
 * 保持与 wizard 中 SKU 面板一致的视觉，但走 REST API。
 */

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { imageUrl } from "@/lib/image";
import { centsToYuanString } from "@/components/ui/PriceInput";
import {
  SKUFormModal,
  type SKUFormOutput,
} from "@/components/products/SKUFormModal";
import { SKUS_QUERY_KEY, useSKUs } from "@/hooks/useSKUs";
import {
  createSKU,
  deleteSKU,
  updateSKU,
} from "@/lib/sku-api";
import { ApiError } from "@/types/errors";
import type { SKUOut, SPUDetailOut } from "@/types/api";

export function SKUManagementTab({ spu }: { spu: SPUDetailOut }) {
  const queryClient = useQueryClient();
  const { data: skus, isLoading, isError, refetch } = useSKUs(spu.id, {
    initialData: spu.skus,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SKUOut | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SKUOut | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: SKUS_QUERY_KEY });
    // 详情页 SPU 也可能变化 min_price_cents / max_price_cents
    queryClient.invalidateQueries({
      queryKey: ["merchant", "spus", "detail"],
    });
  };

  const createMutation = useMutation({
    mutationFn: (out: SKUFormOutput) => {
      if (out.mode !== "create") throw new Error("非法调用");
      return createSKU(spu.id, out.payload);
    },
    onSuccess: () => {
      toast.success("SKU 已添加");
      invalidate();
      setModalOpen(false);
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const updateMutation = useMutation({
    mutationFn: (args: { skuId: number; out: SKUFormOutput }) => {
      if (args.out.mode !== "update") throw new Error("非法调用");
      return updateSKU(spu.id, args.skuId, args.out.payload);
    },
    onSuccess: () => {
      toast.success("SKU 已保存");
      invalidate();
      setModalOpen(false);
      setEditing(null);
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const toggleMutation = useMutation({
    mutationFn: (sku: SKUOut) =>
      updateSKU(spu.id, sku.id, { is_active: !sku.is_active }),
    onSuccess: () => {
      toast.success("状态已更新");
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: (skuId: number) => deleteSKU(spu.id, skuId),
    onSuccess: () => {
      toast.success("SKU 已删除");
      invalidate();
      setPendingDelete(null);
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const existingCodes = useMemo(
    () =>
      (skus ?? [])
        .filter((s) => (editing ? s.id !== editing.id : true))
        .map((s) => s.sku_code),
    [skus, editing],
  );

  const onFormSubmit = (out: SKUFormOutput) => {
    if (editing) {
      updateMutation.mutate({ skuId: editing.id, out });
    } else {
      createMutation.mutate(out);
    }
  };

  return (
    <section className="space-y-4 rounded-lg border border-neutral-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-medium text-neutral-900">SKU 列表</h3>
          <p className="mt-1 text-xs text-neutral-500">
            管理商品的规格 / 价格 / 库存；
            {spu.spec_axes.length > 0
              ? `规格轴：[${spu.spec_axes.join(", ")}]`
              : "单规格商品"}
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          ＋ 新增 SKU
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : isError ? (
        <div className="text-sm text-red-600">
          加载失败。
          <button
            type="button"
            className="ml-2 underline"
            onClick={() => refetch()}
          >
            重试
          </button>
        </div>
      ) : !skus || skus.length === 0 ? (
        <div className="rounded border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-400">
          暂无 SKU，点击右上角「新增 SKU」添加
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
            <tr>
              <th className="w-12 px-3 py-2">图</th>
              <th className="px-3 py-2">编码</th>
              <th className="px-3 py-2">规格</th>
              <th className="px-3 py-2">价格</th>
              <th className="px-3 py-2">库存</th>
              <th className="px-3 py-2">启用</th>
              <th className="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {skus.map((sku) => (
              <tr key={sku.id}>
                <td className="px-3 py-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl(sku.image ?? spu.main_image)}
                    alt={sku.sku_code}
                    className="h-8 w-8 rounded object-cover"
                  />
                </td>
                <td className="px-3 py-2 font-mono text-xs">{sku.sku_code}</td>
                <td className="px-3 py-2 text-xs text-neutral-600">
                  {Object.entries(sku.specs)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(" / ") || "—"}
                </td>
                <td className="px-3 py-2">
                  <span>¥{centsToYuanString(sku.price_cents)}</span>
                  {sku.original_price_cents ? (
                    <span className="ml-1 text-xs text-neutral-400 line-through">
                      ¥{centsToYuanString(sku.original_price_cents)}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  <span>{sku.stock}</span>
                  {sku.locked_stock > 0 ? (
                    <span className="ml-1 text-xs text-amber-600">
                      (锁 {sku.locked_stock})
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => toggleMutation.mutate(sku)}
                    disabled={toggleMutation.isPending}
                    className={cn(
                      "inline-flex h-6 w-11 items-center rounded-full transition-colors",
                      sku.is_active
                        ? "bg-emerald-500"
                        : "bg-neutral-300",
                      toggleMutation.isPending && "opacity-60",
                    )}
                    aria-label={sku.is_active ? "禁用" : "启用"}
                  >
                    <span
                      className={cn(
                        "h-5 w-5 rounded-full bg-white transition-transform",
                        sku.is_active ? "translate-x-5" : "translate-x-0.5",
                      )}
                    />
                  </button>
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      className="text-xs text-[var(--color-primary)] hover:underline"
                      onClick={() => {
                        setEditing(sku);
                        setModalOpen(true);
                      }}
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      className="text-xs text-red-600 hover:underline"
                      onClick={() => setPendingDelete(sku)}
                    >
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <SKUFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        specAxes={spu.spec_axes}
        editing={editing}
        existingCodes={existingCodes}
        saving={createMutation.isPending || updateMutation.isPending}
        onSubmit={onFormSubmit}
      />

      <Modal
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        title="确认删除 SKU"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setPendingDelete(null)}
              disabled={deleteMutation.isPending}
            >
              取消
            </Button>
            <Button
              variant="danger"
              loading={deleteMutation.isPending}
              onClick={() => {
                if (pendingDelete) deleteMutation.mutate(pendingDelete.id);
              }}
            >
              确认删除
            </Button>
          </>
        }
      >
        <p className="text-sm text-neutral-700">
          确定要删除 SKU「{pendingDelete?.sku_code}」吗？该操作为软删除。
        </p>
      </Modal>
    </section>
  );
}

function errMsg(e: unknown): string {
  if (e instanceof ApiError) return e.toUserMessage();
  if (e instanceof Error) return e.message;
  return "操作失败";
}
