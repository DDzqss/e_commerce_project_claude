"use client";

/**
 * 轻量 Toast 组件与 provider —— Phase 7 三端一致性。
 *
 * 规范（对齐 §5.1）：
 * - 位置：右上角固定（top-4 right-4）
 * - 颜色：error red-600 / success green-600 / warning amber-600 / info sky-600
 * - 动画：300ms 淡入
 * - 错误 role="alert" + aria-live="assertive"；其他 role="status" + aria-live="polite"
 *
 * 采用 zustand store 管理 toast 队列；无第三方依赖。
 * 使用方式：
 *   ```tsx
 *   toast.success("保存成功")
 *   toast.error(error.toUserMessage())
 *   ```
 * 在 root layout 中挂 `<ToastRegion />`。
 */

import { useEffect } from "react";
import { create } from "zustand";

import { cn } from "@/lib/cn";

type ToastTone = "success" | "error" | "info" | "warning";

interface ToastItem {
  id: string;
  tone: ToastTone;
  message: string;
  /** 自动消失毫秒；null 表示不自动关 */
  durationMs: number | null;
}

interface ToastState {
  items: ToastItem[];
  push: (item: Omit<ToastItem, "id">) => string;
  dismiss: (id: string) => void;
}

const useToastStore = create<ToastState>((set) => ({
  items: [],
  push: (item) => {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    set((s) => ({ items: [...s.items, { id, ...item }] }));
    return id;
  },
  dismiss: (id) =>
    set((s) => ({ items: s.items.filter((it) => it.id !== id) })),
}));

/** 命令式 API，供业务代码调用。 */
export const toast = {
  success(message: string, durationMs: number | null = 3000) {
    return useToastStore
      .getState()
      .push({ tone: "success", message, durationMs });
  },
  error(message: string, durationMs: number | null = 4000) {
    return useToastStore
      .getState()
      .push({ tone: "error", message, durationMs });
  },
  info(message: string, durationMs: number | null = 3000) {
    return useToastStore.getState().push({ tone: "info", message, durationMs });
  },
  warning(message: string, durationMs: number | null = 3500) {
    return useToastStore
      .getState()
      .push({ tone: "warning", message, durationMs });
  },
  dismiss(id: string) {
    useToastStore.getState().dismiss(id);
  },
};

const TONE_STYLES: Record<ToastTone, string> = {
  success: "bg-green-600 text-white border-green-700",
  error: "bg-red-600 text-white border-red-700",
  info: "bg-sky-600 text-white border-sky-700",
  warning: "bg-amber-600 text-white border-amber-700",
};

function ToastCard({ item }: { item: ToastItem }) {
  useEffect(() => {
    if (item.durationMs == null) return;
    const timer = window.setTimeout(
      () => useToastStore.getState().dismiss(item.id),
      item.durationMs,
    );
    return () => window.clearTimeout(timer);
  }, [item]);

  return (
    <div
      role={item.tone === "error" ? "alert" : "status"}
      aria-live={item.tone === "error" ? "assertive" : "polite"}
      className={cn(
        "pointer-events-auto flex min-w-[240px] max-w-sm items-start gap-3 rounded-md border px-4 py-3 text-sm shadow-lg",
        "animate-[fade-in_300ms_ease-out]",
        TONE_STYLES[item.tone],
      )}
    >
      <span className="flex-1 whitespace-pre-line">{item.message}</span>
      <button
        type="button"
        aria-label="关闭提示"
        onClick={() => useToastStore.getState().dismiss(item.id)}
        className="text-white/80 hover:text-white"
      >
        ×
      </button>
    </div>
  );
}

/**
 * 挂在 root layout 内的 Toast 展示区。
 */
export function ToastRegion() {
  const items = useToastStore((s) => s.items);
  if (items.length === 0) return null;
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 top-4 z-[100] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2"
    >
      {items.map((it) => (
        <ToastCard key={it.id} item={it} />
      ))}
    </div>
  );
}
