"use client";

import { useId, type ReactNode } from "react";

import { cn } from "@/lib/cn";

export interface FormFieldProps {
  label: ReactNode;
  htmlFor?: string;
  required?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: (id: string) => ReactNode;
}

/**
 * 表单字段容器：label + control + hint/error。
 * children 是 render prop：接收生成的 htmlFor id。
 */
export function FormField({
  label,
  htmlFor,
  required,
  hint,
  error,
  className,
  children,
}: FormFieldProps) {
  const generatedId = useId();
  const id = htmlFor ?? generatedId;
  const describedById = `${id}-desc`;

  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-neutral-800"
      >
        {label}
        {required ? (
          <span aria-hidden className="ml-0.5 text-red-500">
            *
          </span>
        ) : null}
      </label>
      {children(id)}
      {error ? (
        <p
          id={describedById}
          role="alert"
          className="text-xs text-red-600"
        >
          {error}
        </p>
      ) : hint ? (
        <p id={describedById} className="text-xs text-neutral-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
