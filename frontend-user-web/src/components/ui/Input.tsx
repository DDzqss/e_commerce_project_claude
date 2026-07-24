"use client";

import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";

export interface InputProps
  extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string | null;
  leftAddon?: ReactNode;
  rightAddon?: ReactNode;
}

/**
 * 基础 Input：三态样式（默认 / focus / error）+ 可选 label 与提示。
 * error 非空时 border 变红并显示错误文案（aria-live=polite 无障碍）。
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    hint,
    error,
    leftAddon,
    rightAddon,
    className,
    id,
    ...rest
  },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const describedById = error ? `${inputId}-err` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-sm font-medium text-neutral-800"
        >
          {label}
          {rest.required ? (
            <span
              aria-hidden
              className="ml-0.5 text-[color:var(--color-danger)]"
            >
              *
            </span>
          ) : null}
        </label>
      )}
      <div
        className={cn(
          "flex h-10 items-center rounded-md border bg-white px-3 shadow-sm transition",
          "focus-within:ring-2 focus-within:ring-[color:var(--color-primary)]/40",
          error
            ? "border-[color:var(--color-primary)] focus-within:border-[color:var(--color-primary)]"
            : "border-neutral-300 focus-within:border-[color:var(--color-primary)]",
          rest.disabled && "opacity-60",
          className,
        )}
      >
        {leftAddon && (
          <div className="mr-2 flex items-center text-neutral-500">
            {leftAddon}
          </div>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error) || undefined}
          aria-required={rest.required || undefined}
          aria-describedby={describedById}
          className="min-w-0 flex-1 bg-transparent text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
          {...rest}
        />
        {rightAddon && (
          <div className="ml-2 flex items-center text-neutral-500">
            {rightAddon}
          </div>
        )}
      </div>
      {error ? (
        <p
          id={`${inputId}-err`}
          role="alert"
          aria-live="polite"
          className="mt-1 text-xs text-[color:var(--color-primary)]"
        >
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="mt-1 text-xs text-neutral-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
