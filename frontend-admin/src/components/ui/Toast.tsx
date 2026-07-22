"use client";

/**
 * 极简 Toast 组件（无外部依赖）。
 *
 * 场景：
 * - 登录失败、审批成功、密码修改成功等一次性反馈
 * - 破坏性操作 confirm 请用 Modal，不用 Toast
 *
 * 用法：
 *   <ToastProvider>
 *     ...页面
 *   </ToastProvider>
 *
 *   const { push } = useToast();
 *   push({ type: "success", message: "已通过" });
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import clsx from "clsx";

export type ToastType = "info" | "success" | "warning" | "error";

export interface ToastMessage {
  id: number;
  type: ToastType;
  message: string;
  /** ms；默认 3000，error 类 5000 */
  duration?: number;
}

interface ToastContextValue {
  push: (t: Omit<ToastMessage, "id">) => void;
  remove: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TYPE_CLASS: Record<ToastType, string> = {
  info: "border-blue-200 bg-blue-50 text-blue-800",
  success: "border-green-200 bg-green-50 text-green-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  error:
    "border-red-200 bg-[color:var(--color-danger-soft)] text-[color:var(--color-danger)]",
};

const TYPE_LABEL: Record<ToastType, string> = {
  info: "提示",
  success: "成功",
  warning: "警告",
  error: "错误",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const idRef = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (t: Omit<ToastMessage, "id">) => {
      const id = ++idRef.current;
      const duration = t.duration ?? (t.type === "error" ? 5000 : 3000);
      const item: ToastMessage = { ...t, id };
      setToasts((prev) => [...prev, item]);
      if (duration > 0) {
        setTimeout(() => remove(id), duration);
      }
    },
    [remove],
  );

  const value = useMemo(() => ({ push, remove }), [push, remove]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed right-6 top-6 z-50 flex w-80 flex-col gap-2"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={clsx(
              "pointer-events-auto flex items-start gap-3 rounded border px-3 py-2 text-sm shadow-md",
              TYPE_CLASS[t.type],
            )}
          >
            <span className="text-xs font-semibold">{TYPE_LABEL[t.type]}</span>
            <span className="flex-1">{t.message}</span>
            <button
              type="button"
              aria-label="关闭提示"
              className="text-current opacity-60 hover:opacity-100"
              onClick={() => remove(t.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * 便捷 hook：获取 push/remove。必须放在 ToastProvider 内部使用。
 */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast 必须在 <ToastProvider> 内部使用");
  }
  return ctx;
}
