"use client";

import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/cn";
import type { CategoryOut } from "@/types/api";

export interface CategoryPickerProps {
  /** 完整类目树（root -> level2 -> level3） */
  tree: CategoryOut[];
  /** 当前选中的叶子类目 ID（level=3 或 tree 中的叶子节点） */
  value: number | null | undefined;
  onChange: (leafId: number | null) => void;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
}

/**
 * 3 级级联类目选择器（受控 value + 内部维护展开路径）。
 *
 * 契约 §3.3：SPU 只允许挂在叶子类目（level=3）。
 * 只有当 3 级全部选中时才 onChange(leafId)；中途 selection 变动 → onChange(null)。
 */
export function CategoryPicker({
  tree,
  value,
  onChange,
  disabled,
  invalid,
  className,
}: CategoryPickerProps) {
  const derived = useMemo(() => derivePath(tree, value ?? null), [tree, value]);
  const [l1Id, setL1Id] = useState<number | null>(derived[0]);
  const [l2Id, setL2Id] = useState<number | null>(derived[1]);
  const [l3Id, setL3Id] = useState<number | null>(derived[2]);

  // 外部 value 变化时同步内部路径（避免受控回退不同步）
  useEffect(() => {
    setL1Id(derived[0]);
    setL2Id(derived[1]);
    setL3Id(derived[2]);
  }, [derived]);

  const l2List = useMemo(
    () => (l1Id ? findNode(tree, l1Id)?.children ?? [] : []),
    [tree, l1Id],
  );
  const l3List = useMemo(
    () => (l2Id ? findNode(l2List, l2Id)?.children ?? [] : []),
    [l2List, l2Id],
  );

  const selectClass = cn(
    "block h-10 rounded-md border bg-white px-3 text-sm text-neutral-900",
    "focus:outline-none focus-visible:ring-2",
    disabled ? "cursor-not-allowed bg-neutral-50 text-neutral-400" : "",
    invalid
      ? "border-red-400 focus-visible:ring-red-300"
      : "border-neutral-300 focus-visible:border-[var(--color-primary)] focus-visible:ring-blue-200",
  );

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <select
        aria-label="一级类目"
        disabled={disabled}
        className={selectClass}
        value={l1Id ?? ""}
        onChange={(e) => {
          const id = e.target.value ? Number(e.target.value) : null;
          setL1Id(id);
          setL2Id(null);
          setL3Id(null);
          onChange(null);
        }}
      >
        <option value="">请选择一级</option>
        {tree.map((n) => (
          <option key={n.id} value={n.id}>
            {n.name}
          </option>
        ))}
      </select>

      <select
        aria-label="二级类目"
        disabled={disabled || !l1Id}
        className={selectClass}
        value={l2Id ?? ""}
        onChange={(e) => {
          const id = e.target.value ? Number(e.target.value) : null;
          setL2Id(id);
          setL3Id(null);
          onChange(null);
        }}
      >
        <option value="">请选择二级</option>
        {l2List.map((n) => (
          <option key={n.id} value={n.id}>
            {n.name}
          </option>
        ))}
      </select>

      <select
        aria-label="三级类目"
        disabled={disabled || !l2Id}
        className={selectClass}
        value={l3Id ?? ""}
        onChange={(e) => {
          const id = e.target.value ? Number(e.target.value) : null;
          setL3Id(id);
          onChange(id);
        }}
      >
        <option value="">请选择三级</option>
        {l3List.map((n) => (
          <option key={n.id} value={n.id}>
            {n.name}
          </option>
        ))}
      </select>
    </div>
  );
}

// ---------- helpers ----------

function findNode(
  list: CategoryOut[] | undefined,
  id: number,
): CategoryOut | undefined {
  if (!list) return undefined;
  for (const n of list) {
    if (n.id === id) return n;
    const found = findNode(n.children, id);
    if (found) return found;
  }
  return undefined;
}

function derivePath(
  tree: CategoryOut[],
  leafId: number | null,
): [number | null, number | null, number | null] {
  if (!leafId) return [null, null, null];
  const stack: [CategoryOut, number[]][] = tree.map((n) => [n, [n.id]]);
  while (stack.length > 0) {
    const [node, path] = stack.pop()!;
    if (node.id === leafId) {
      return [path[0] ?? null, path[1] ?? null, path[2] ?? null];
    }
    for (const child of node.children ?? []) {
      stack.push([child, [...path, child.id]]);
    }
  }
  return [null, null, null];
}
