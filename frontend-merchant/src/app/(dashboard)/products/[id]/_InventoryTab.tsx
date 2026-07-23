"use client";

/**
 * 库存管理 tab —— [id]/page.tsx 引用。
 *
 * 展示：
 *   - 每个 SKU 的当前库存（顶部卡片） + "调整"按钮
 *   - 选中某 SKU 后下方展示其库存流水（分页）
 *
 * 调整弹窗字段：delta / reason / note
 */

import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { adjust } from "@/lib/inventory-api";
import { SKUS_QUERY_KEY, useSKUs } from "@/hooks/useSKUs";
import {
  INVENTORY_LOGS_QUERY_KEY,
  useInventoryLogs,
} from "@/hooks/useInventoryLogs";
import { ApiError } from "@/types/errors";
import type {
  AdjustInventoryIn,
  InventoryReason,
  SKUOut,
  SPUDetailOut,
} from "@/types/api";

const REASON_LABEL: Record<InventoryReason, string> = {
  purchase: "进货补货",
  sale: "销售",
  refund_return: "退货入库",
  adjust: "盘点调整",
  initial: "初始化",
};

const REASON_OPTIONS: InventoryReason[] = [
  "purchase",
  "adjust",
  "refund_return",
];

export function InventoryTab({ spu }: { spu: SPUDetailOut }) {
  const { data: skus, isLoading } = useSKUs(spu.id, {
    initialData: spu.skus,
  });
  const [selectedSkuId, setSelectedSkuId] = useState<number | null>(
    spu.skus[0]?.id ?? null,
  );
  const [adjusting, setAdjusting] = useState<SKUOut | null>(null);

  const activeSku = useMemo(
    () => skus?.find((s) => s.id === selectedSkuId) ?? skus?.[0] ?? null,
    [skus, selectedSkuId],
  );

  return (
    <section className="space-y-6">
      {/* SKU 库存卡片区 */}
      <div className="rounded-lg border border-neutral-200 bg-white p-6">
        <h3 className="text-base font-medium text-neutral-900">SKU 当前库存</h3>
        {isLoading ? (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        ) : !skus || skus.length === 0 ? (
          <div className="mt-4 rounded border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-400">
            尚未添加 SKU，请先到「SKU 管理」tab 添加。
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {skus.map((sku) => {
              const isSelected = sku.id === activeSku?.id;
              return (
                <div
                  key={sku.id}
                  className={cn(
                    "flex flex-col justify-between rounded border p-4 transition-colors",
                    isSelected
                      ? "border-[var(--color-primary)] bg-blue-50/40"
                      : "border-neutral-200 hover:bg-neutral-50",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedSkuId(sku.id)}
                    className="text-left"
                  >
                    <div className="text-xs text-neutral-500">
                      {Object.entries(sku.specs)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(" / ") || "单规格"}
                    </div>
                    <div className="mt-1 font-mono text-xs text-neutral-700">
                      {sku.sku_code}
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-2xl font-semibold text-neutral-900">
                        {sku.stock}
                      </span>
                      <span className="text-xs text-neutral-500">当前可用</span>
                    </div>
                    {sku.locked_stock > 0 ? (
                      <div className="mt-0.5 text-xs text-amber-600">
                        锁定 {sku.locked_stock} 件
                      </div>
                    ) : null}
                  </button>
                  <div className="mt-3 flex justify-end">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setAdjusting(sku)}
                    >
                      调整库存
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 流水 */}
      {activeSku ? (
        <InventoryLogsSection
          spuId={spu.id}
          sku={activeSku}
        />
      ) : null}

      {/* 调整弹窗 */}
      {adjusting ? (
        <AdjustInventoryModal
          sku={adjusting}
          onClose={() => setAdjusting(null)}
        />
      ) : null}
    </section>
  );
}

// ============================================================================
// 库存流水表
// ============================================================================

function InventoryLogsSection({
  spuId,
  sku,
}: {
  spuId: number;
  sku: SKUOut;
}) {
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useInventoryLogs(sku.id, {
    page,
    size: PAGE_SIZE,
  });
  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / (data.size || PAGE_SIZE)))
    : 1;
  void spuId;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-base font-medium text-neutral-900">
            库存流水
          </h3>
          <p className="mt-1 text-xs text-neutral-500">
            SKU：<span className="font-mono">{sku.sku_code}</span> ·
            {Object.entries(sku.specs)
              .map(([k, v]) => ` ${k}: ${v}`)
              .join(" /") || " 单规格"}
          </p>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
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
      ) : !data || data.items.length === 0 ? (
        <div className="rounded border border-dashed border-neutral-200 p-6 text-center text-sm text-neutral-400">
          暂无流水
        </div>
      ) : (
        <>
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
              <tr>
                <th className="px-3 py-2">时间</th>
                <th className="px-3 py-2">操作类型</th>
                <th className="px-3 py-2">变更</th>
                <th className="px-3 py-2">变更后</th>
                <th className="px-3 py-2">操作方</th>
                <th className="px-3 py-2">备注</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {data.items.map((log) => (
                <tr key={log.id}>
                  <td className="px-3 py-2 text-xs text-neutral-500">
                    {new Date(log.created_at).toLocaleString("zh-CN")}
                  </td>
                  <td className="px-3 py-2">
                    {REASON_LABEL[log.reason] ?? log.reason}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2 font-medium",
                      log.delta > 0
                        ? "text-emerald-700"
                        : log.delta < 0
                          ? "text-red-600"
                          : "text-neutral-700",
                    )}
                  >
                    {log.delta > 0 ? `+${log.delta}` : log.delta}
                  </td>
                  <td className="px-3 py-2">{log.balance_after}</td>
                  <td className="px-3 py-2 text-xs text-neutral-500">
                    {log.operator_type}
                    {log.operator_id ? ` #${log.operator_id}` : ""}
                  </td>
                  <td className="px-3 py-2 text-xs text-neutral-600">
                    {log.note ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 flex items-center justify-between text-xs text-neutral-500">
            <div>
              共 {data.total} 条 · 第 {page} / {totalPages} 页
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                上一页
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                下一页
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// 调整库存 Modal
// ============================================================================

interface AdjustFormValues {
  delta: number;
  reason: InventoryReason;
  note: string;
}

function AdjustInventoryModal({
  sku,
  onClose,
}: {
  sku: SKUOut;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<AdjustFormValues>({
    defaultValues: { delta: 0, reason: "purchase", note: "" },
  });

  const delta = watch("delta");
  const projected = (sku.stock ?? 0) + Number(delta || 0);
  const willBeNegative = projected < 0;

  const mutation = useMutation({
    mutationFn: (payload: AdjustInventoryIn) => adjust(sku.id, payload),
    onSuccess: () => {
      toast.success("库存已调整");
      queryClient.invalidateQueries({ queryKey: SKUS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: INVENTORY_LOGS_QUERY_KEY });
      onClose();
    },
    onError: (e) =>
      toast.error(e instanceof ApiError ? e.toUserMessage() : "调整失败"),
  });

  const submit = handleSubmit((values) => {
    const d = Math.trunc(Number(values.delta));
    if (!Number.isFinite(d) || d === 0) {
      toast.error("请填写非零的变化量");
      return;
    }
    if ((sku.stock ?? 0) + d < 0) {
      toast.error("库存不能减为负数");
      return;
    }
    mutation.mutate({
      delta: d,
      reason: values.reason,
      note: values.note?.trim() || undefined,
    });
  });

  return (
    <Modal
      open
      onClose={() => (mutation.isPending ? undefined : onClose())}
      title={`调整库存 · ${sku.sku_code}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
            取消
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            loading={mutation.isPending}
            disabled={willBeNegative || !delta}
          >
            确认调整
          </Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={submit} noValidate>
        <div className="rounded border border-neutral-200 bg-neutral-50 p-3 text-xs">
          <div>
            当前库存：<span className="font-semibold">{sku.stock}</span>
          </div>
          <div>
            调整后：
            <span
              className={cn(
                "ml-1 font-semibold",
                willBeNegative ? "text-red-600" : "text-emerald-700",
              )}
            >
              {projected}
            </span>
            {willBeNegative ? (
              <span className="ml-2 text-red-600">库存不能为负</span>
            ) : null}
          </div>
        </div>

        <FormField
          label="变化量（+ 进货 / - 出货）"
          required
          error={errors.delta?.message}
        >
          {(id) => (
            <Input
              id={id}
              type="number"
              step="1"
              placeholder="如 20 或 -5"
              invalid={!!errors.delta}
              {...register("delta", {
                valueAsNumber: true,
                required: "请填写变化量",
                validate: (v) => (v === 0 ? "变化量不能为 0" : true),
              })}
            />
          )}
        </FormField>

        <FormField label="原因" required>
          {() => (
            <Controller
              control={control}
              name="reason"
              render={({ field }) => (
                <select
                  className="block h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-900 focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-blue-200"
                  value={field.value}
                  onChange={field.onChange}
                >
                  {REASON_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {REASON_LABEL[r]}
                    </option>
                  ))}
                </select>
              )}
            />
          )}
        </FormField>

        <FormField label="备注" hint="可选，最多 200 字">
          {(id) => (
            <textarea
              id={id}
              rows={3}
              className="block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="如 补货 20 件"
              {...register("note", {
                maxLength: { value: 200, message: "备注不超过 200 字" },
              })}
            />
          )}
        </FormField>
      </form>
    </Modal>
  );
}
