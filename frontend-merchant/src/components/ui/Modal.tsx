"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/cn";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** 宽度（tailwind width class）默认 max-w-lg */
  widthClass?: string;
}

/**
 * 轻量 modal：Esc 关闭 / 点击遮罩关闭 / 页面滚动锁定。
 * 使用 portal 直挂 body，避免祖先 overflow/z-index 影响。
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  widthClass = "max-w-lg",
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
    >
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden
      />
      <div
        className={cn(
          "relative z-10 flex max-h-[90vh] w-full flex-col overflow-hidden rounded-lg bg-white shadow-xl",
          widthClass,
        )}
      >
        <header className="flex items-center justify-between border-b border-neutral-200 px-5 py-3">
          <h3 className="text-base font-semibold text-neutral-900">{title}</h3>
          <button
            type="button"
            aria-label="关闭"
            onClick={onClose}
            className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            ×
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <footer className="flex items-center justify-end gap-2 border-t border-neutral-200 bg-neutral-50 px-5 py-3">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
