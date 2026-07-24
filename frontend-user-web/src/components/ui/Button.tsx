"use client";

import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

/**
 * 通用按钮：四种 variant + loading 三态。
 * - primary：京东红主按钮，页面主 CTA
 * - secondary：白底灰边，中性操作
 * - ghost：透明背景，用于弹窗次按钮或表格行内操作
 * - danger：破坏性操作（取消订单、删除地址等），走 --color-danger
 *
 * loading=true 时：禁用点击 + 显示 spinner + 保持宽度。
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      loading = false,
      fullWidth = false,
      leftIcon,
      rightIcon,
      className,
      children,
      disabled,
      type = "button",
      ...rest
    },
    ref,
  ) {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-md font-medium transition select-none",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-primary)]",
          "disabled:cursor-not-allowed disabled:opacity-60",
          // size
          size === "sm" && "h-8 px-3 text-xs",
          size === "md" && "h-10 px-4 text-sm",
          size === "lg" && "h-12 px-6 text-base",
          // variant
          variant === "primary" &&
            "bg-[color:var(--color-primary)] text-white shadow-sm hover:opacity-90 active:opacity-100",
          variant === "secondary" &&
            "border border-neutral-300 bg-white text-neutral-800 shadow-sm hover:bg-neutral-100",
          variant === "ghost" &&
            "bg-transparent text-neutral-700 hover:bg-neutral-100",
          variant === "danger" &&
            "bg-[color:var(--color-danger)] text-white shadow-sm hover:bg-red-700 active:bg-red-800",
          fullWidth && "w-full",
          className,
        )}
        {...rest}
      >
        {loading ? <Spinner /> : leftIcon}
        <span>{children}</span>
        {!loading && rightIcon}
      </button>
    );
  },
);

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin text-current"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="4"
      />
      <path
        d="M4 12a8 8 0 018-8"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}
