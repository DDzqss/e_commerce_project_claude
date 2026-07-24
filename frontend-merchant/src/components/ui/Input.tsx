"use client";

import { forwardRef, type InputHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

/**
 * 商务风格文本输入框：矩形轻圆角，聚焦蓝边。
 * 与 FormField 组合使用；也可独立使用（如搜索框）。
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, className, type = "text", ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      aria-invalid={invalid || undefined}
      aria-required={rest.required || undefined}
      className={cn(
        "block h-10 w-full rounded-md border bg-white px-3 text-sm text-neutral-900 placeholder:text-neutral-400",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-0",
        invalid
          ? "border-red-400 focus-visible:ring-red-300"
          : "border-neutral-300 focus-visible:border-[var(--color-primary)] focus-visible:ring-blue-200",
        "disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400",
        className,
      )}
      {...rest}
    />
  );
});
