"use client";

import { forwardRef, useState, type InputHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export interface PasswordInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  invalid?: boolean;
}

/**
 * 带"显示/隐藏"切换的密码输入框。
 * 内嵌一个 aria-controlled 的按钮控制 type。
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ invalid, className, ...rest }, ref) {
    const [visible, setVisible] = useState(false);
    return (
      <div className="relative">
        <input
          ref={ref}
          type={visible ? "text" : "password"}
          aria-invalid={invalid || undefined}
          className={cn(
            "block h-10 w-full rounded-md border bg-white pl-3 pr-16 text-sm text-neutral-900 placeholder:text-neutral-400",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-0",
            invalid
              ? "border-red-400 focus-visible:ring-red-300"
              : "border-neutral-300 focus-visible:border-[var(--color-primary)] focus-visible:ring-blue-200",
            "disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400",
            className,
          )}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "隐藏密码" : "显示密码"}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-xs text-neutral-500 hover:text-neutral-800"
        >
          {visible ? "隐藏" : "显示"}
        </button>
      </div>
    );
  },
);
