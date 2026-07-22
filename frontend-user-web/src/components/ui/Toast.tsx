"use client";

import { create } from "zustand";
import { useEffect } from "react";
import { cn } from "@/lib/cn";

export type ToastVariant = "success" | "error" | "info";

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
      duration: duration ?? 3000,
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
      className="pointer-events-none fixed inset-x-0 top-4 z-[9999] flex flex-col items-center gap-2 px-4"
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
      className={cn(
        "pointer-events-auto max-w-sm rounded-md border px-4 py-2 text-sm shadow-lg",
        item.variant === "success" && "border-green-300 bg-green-50 text-green-800",
        item.variant === "error" &&
          "border-[color:var(--color-primary)] bg-[color:var(--color-primary-50)] text-[color:var(--color-primary-700)]",
        item.variant === "info" && "border-neutral-300 bg-white text-neutral-800",
      )}
    >
      {item.message}
    </div>
  );
}
