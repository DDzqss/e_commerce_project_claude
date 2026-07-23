"use client";

/**
 * 表单字段包装：label + 控件 + 错误提示 + 描述。
 * 用于登录表单、审核弹窗、修改密码等所有表单场景。
 *
 * 使用示例：
 *   <FormField label="用户名" error={errors.username?.message} required>
 *     <Input {...register("username")} />
 *   </FormField>
 */

import type { ReactNode } from "react";
import clsx from "clsx";

interface FormFieldProps {
  label?: ReactNode;
  htmlFor?: string;
  required?: boolean;
  error?: string | null;
  description?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function FormField({
  label,
  htmlFor,
  required,
  error,
  description,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={clsx("flex flex-col gap-1", className)}>
      {label ? (
        <label
          htmlFor={htmlFor}
          className="text-xs font-medium text-neutral-700"
        >
          {label}
          {required ? (
            <span aria-label="必填" className="ml-1 text-[color:var(--color-danger)]">
              *
            </span>
          ) : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p
          className="text-xs text-[color:var(--color-danger)]"
          role="alert"
        >
          {error}
        </p>
      ) : description ? (
        <p className="text-xs text-neutral-400">{description}</p>
      ) : null}
    </div>
  );
}
