"use client";

import { create } from "zustand";
import { useEffect } from "react";
import { cn } from "@/lib/cn";

/**
 * 全局 Toast 组件 —— Phase 7 三端一致性。
 *
 * 规范（对齐 §5.1）：
 * - 位置：右上角固定（top-4 right-4）
 * - 颜色：error red-600 / success green-600 / warning amber-600 / info sky-600
 * - 动画：300ms 淡入
 * - 错误 role="alert" + aria-live="assertive"；其他 role="status" + aria-live="polite"
 */
export type ToastVariant = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number;
}

interface ToastState {
  items: ToastItem[];
  push: (t: Omit<ToastItem, "id" | "duration"> & { duration?: number }) => string;
  dismiss: (id: string) => void;
}

/** 全局 toast store（单例）。UI 组件订阅它并渲染。 */
export const useToastStore = create<ToastState>((set, get) => ({
  items: [],
  push: ({ message, variant, duration }) => {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
    const item: ToastItem = {
      id,
      message,
      variant,
      duration: duration ?? (variant === "error" ? 4000 : 3000),
    };
    set({ items: [...get().items, item] });
    return id;
  },
  dismiss: (id) => set({ items: get().items.filter((t) => t.id !== id) }),
}));

/**
 * 语法糖（imperative API）。
 * 用法：
 *   toast.success("已保存");
 *   toast.error("操作失败");
 */
export const toast = {
  success: (message: string, duration?: number) =>
    useToastStore.getState().push({ message, variant: "success", duration }),
  error: (message: string, duration?: number) =>
    useToastStore.getState().push({ message, variant: "error", duration }),
  info: (message: string, duration?: number) =>
    useToastStore.getState().push({ message, variant: "info", duration }),
  warning: (message: string, duration?: number) =>
    useToastStore.getState().push({ message, variant: "warning", duration }),
  dismiss: (id: string) => useToastStore.getState().dismiss(id),
};

const VARIANT_CLASS: Record<ToastVariant, string> = {
  success: "bg-green-600 text-white border-green-700",
  error: "bg-red-600 text-white border-red-700",
  warning: "bg-amber-600 text-white border-amber-700",
  info: "bg-sky-600 text-white border-sky-700",
};

/**
 * Toast 容器：挂在 root layout 内，全局只需一份。
 * 每条 toast 自带定时器自动 dismiss。
 */
export function ToastViewport() {
  const items = useToastStore((s) => s.items);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed right-4 top-4 z-[9999] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2"
    >
      {items.map((t) => (
        <ToastCard key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, item.duration);
    return () => clearTimeout(timer);
  }, [item.duration, onDismiss]);

  return (
    <div
      role={item.variant === "error" ? "alert" : "status"}
      aria-live={item.variant === "error" ? "assertive" : "polite"}
      className={cn(
        "pointer-events-auto flex items-start gap-3 rounded-md border px-4 py-2 text-sm shadow-lg",
        "animate-[fade-in_300ms_ease-out]",
        VARIANT_CLASS[item.variant],
      )}
    >
      <span className="flex-1 whitespace-pre-line">{item.message}</span>
      <button
        type="button"
        aria-label="关闭提示"
        onClick={onDismiss}
        className="text-white/80 hover:text-white"
      >
        ×
      </button>
    </div>
  );
}
