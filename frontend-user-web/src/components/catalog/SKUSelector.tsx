"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import type { SKUOut } from "@/types/catalog";

interface SKUSelectorProps {
  /** SPU.spec_axes：规格轴顺序，如 ["color","size"] */
  specAxes: string[];
  /** SPU.skus：全部 SKU（含 inactive；本组件内部过滤 is_active/stock） */
  skus: SKUOut[];
  /** SKU 变更回调；无法选出唯一 SKU 时传 null */
  onChange?: (sku: SKUOut | null) => void;
  className?: string;
}

/**
 * 详情页 SKU 选择器。
 *
 * 逻辑：
 *   - 为每个 spec 轴生成一个选项组（如"颜色"、"尺码"）
 *   - 用户点击某个选项 → 更新选中态
 *   - 一个选项按钮的可用性 = "存在一个 active/有货 SKU，其在这条轴取该值，且在其它已选轴上匹配"
 *     · 未选其它轴时，只要该值在任一有效 SKU 出现即可
 *     · 已选其它轴 A=x → 该轴 B 的可用值 = 仅考虑 A=x 的 SKU
 *   - 全部轴选完后，唯一命中的 SKU 才通过 onChange 抛出
 *
 * 举例（契约中的例子）：
 *   spec_axes=["color","size"]，SKU 有 (红,L)/(红,M)/(蓝,L)/(蓝,XL)
 *   选 "红" → size 面板 XL 应禁用（因为红没有 XL）
 */
export function SKUSelector({
  specAxes,
  skus,
  onChange,
  className,
}: SKUSelectorProps) {
  // 只考虑上架且有库存的 SKU
  const availableSkus = useMemo(
    () => skus.filter((s) => s.is_active && s.stock > 0),
    [skus],
  );

  // 单规格特殊情况：spec_axes 为空 → 直接暴露第一个可用 SKU
  const hasAxes = specAxes.length > 0;

  const [selected, setSelected] = useState<Record<string, string | undefined>>({});

  /** 每个轴的所有可能值（按 SKU 出现顺序去重）。 */
  const axisValues = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const axis of specAxes) {
      const seen = new Set<string>();
      for (const sku of skus) {
        const v = sku.specs[axis];
        if (v && !seen.has(v)) {
          seen.add(v);
          (out[axis] ??= []).push(v);
        }
      }
      out[axis] ??= [];
    }
    return out;
  }, [specAxes, skus]);

  /**
   * 判断某个 (axis,value) 在当前其它已选轴下是否可选。
   * 只考虑上架且有货的 SKU。
   */
  function isValueEnabled(axis: string, value: string): boolean {
    return availableSkus.some((sku) => {
      if (sku.specs[axis] !== value) return false;
      for (const other of specAxes) {
        if (other === axis) continue;
        const chosen = selected[other];
        if (chosen && sku.specs[other] !== chosen) return false;
      }
      return true;
    });
  }

  /** 已选组合命中的 SKU；未全部选完或不匹配返回 null。 */
  const matchedSku = useMemo<SKUOut | null>(() => {
    if (!hasAxes) return skus.find((s) => s.is_active) ?? null;
    if (specAxes.some((axis) => !selected[axis])) return null;
    return (
      skus.find((sku) => {
        if (!sku.is_active) return false;
        return specAxes.every((axis) => sku.specs[axis] === selected[axis]);
      }) ?? null
    );
  }, [hasAxes, specAxes, selected, skus]);

  useEffect(() => {
    onChange?.(matchedSku);
  }, [matchedSku, onChange]);

  const pick = (axis: string, value: string) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[axis] === value) {
        delete next[axis]; // 再次点击 = 取消
      } else {
        next[axis] = value;
      }
      return next;
    });
  };

  if (!hasAxes) {
    // 单规格：无需选择器；调用方可根据 matchedSku 直接展示价格/库存
    return null;
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {specAxes.map((axis) => {
        const values = axisValues[axis] ?? [];
        return (
          <div key={axis}>
            <div className="mb-2 text-xs text-neutral-500">
              {axis}
              {selected[axis] && (
                <span className="ml-1 text-neutral-800">
                  · {selected[axis]}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {values.map((v) => {
                const enabled = isValueEnabled(axis, v);
                const active = selected[axis] === v;
                return (
                  <button
                    key={v}
                    type="button"
                    disabled={!enabled}
                    aria-pressed={active}
                    onClick={() => pick(axis, v)}
                    data-testid={`sku-option-${axis}-${v}`}
                    className={cn(
                      "min-w-[3rem] rounded border px-3 py-1.5 text-xs transition",
                      active
                        ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary-50)] text-[color:var(--color-primary-700)]"
                        : "border-neutral-300 bg-white text-neutral-700 hover:border-[color:var(--color-primary)]",
                      !enabled &&
                        "cursor-not-allowed border-neutral-200 bg-neutral-50 text-neutral-300 line-through hover:border-neutral-200",
                    )}
                  >
                    {v}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
