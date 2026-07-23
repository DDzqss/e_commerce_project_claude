"use client";

/**
 * 极简 Modal（无外部依赖）。
 *
 * 特性：
 * - ESC 关闭 / 点击遮罩关闭（可关闭）
 * - 焦点陷阱只做简化：打开时把焦点放到容器；关闭时归还
 * - 只支持 sm/md/lg 三档宽度，管理端不追求花哨动画
 *
 * 用法：
 *   <Modal open={open} onClose={close} title="通过审批">...</Modal>
 */

import {
  useEffect,
  useRef,
  type ReactNode,
  type MouseEvent as ReactMouseEvent,
} from "react";
import clsx from "clsx";

type ModalSize = "sm" | "md" | "lg";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: ModalSize;
  /** 是否允许点遮罩关闭。破坏性 confirm 建议设 false */
  closeOnOverlay?: boolean;
  /** 是否显示关闭 X。默认 true */
  showClose?: boolean;
}

const SIZE_CLASS: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
};

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
  closeOnOverlay = true,
  showClose = true,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prevActive = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    // 锁背景滚动
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prevOverflow;
      prevActive?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const onOverlayClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!closeOnOverlay) return;
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
      onClick={onOverlayClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
        ref={dialogRef}
        tabIndex={-1}
        className={clsx(
          "flex w-full flex-col overflow-hidden rounded-md bg-white shadow-lg outline-none",
          SIZE_CLASS[size],
        )}
      >
        {(title || showClose) && (
          <header className="flex items-center justify-between border-b border-[color:var(--color-border)] px-4 py-3">
            <h2
              id="modal-title"
              className="text-sm font-semibold text-neutral-900"
            >
              {title}
            </h2>
            {showClose ? (
              <button
                type="button"
                aria-label="关闭"
                onClick={onClose}
                className="rounded p-1 text-neutral-500 hover:bg-neutral-100"
              >
                ×
              </button>
            ) : null}
          </header>
        )}
        <div className="flex-1 overflow-y-auto p-4 text-sm text-neutral-800">
          {children}
        </div>
        {footer ? (
          <footer className="flex items-center justify-end gap-2 border-t border-[color:var(--color-border)] bg-neutral-50 px-4 py-3">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
