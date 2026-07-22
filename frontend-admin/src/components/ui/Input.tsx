"use client";

/**
 * 通用 Input 组件。
 * 管理端惯用高度 32px；错误态用边框 + 底部 aria-invalid，Toast 不重复展示。
 */

import { forwardRef, type InputHTMLAttributes } from "react";
import clsx from "clsx";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={clsx(
        "block h-8 w-full rounded border bg-white px-3 text-sm text-neutral-900 shadow-sm outline-none transition",
        "placeholder:text-neutral-400",
        "focus:border-[color:var(--color-primary)] focus:ring-1 focus:ring-[color:var(--color-primary)]/20",
        "disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400",
        invalid
          ? "border-[color:var(--color-danger)] focus:border-[color:var(--color-danger)] focus:ring-red-100"
          : "border-[color:var(--color-border)]",
        className,
      )}
      {...rest}
    />
  );
});
