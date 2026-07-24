"use client";

import type { ReactNode } from "react";
import type {
  Control,
  FieldPath,
  FieldValues,
  RegisterOptions,
} from "react-hook-form";
import { Controller } from "react-hook-form";

interface FormFieldProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  rules?: Omit<
    RegisterOptions<TFieldValues, FieldPath<TFieldValues>>,
    "valueAsNumber" | "valueAsDate" | "setValueAs" | "disabled"
  >;
  /**
   * 渲染函数。field/fieldState 由 react-hook-form 提供，
   * 我们把最小必要项透传给自定义控件，方便与 Input/PasswordInput 组合。
   */
  render: (args: {
    value: unknown;
    onChange: (v: unknown) => void;
    onBlur: () => void;
    name: string;
    ref: (instance: unknown) => void;
    error: string | null;
  }) => ReactNode;
}

/**
 * 极简 react-hook-form Controller wrapper。
 *
 * 用法：
 *   <FormField
 *     control={control}
 *     name="password"
 *     render={({ value, onChange, error }) => (
 *       <PasswordInput label="密码" value={value as string} onChange={onChange} error={error} />
 *     )}
 *   />
 *
 * 让页面无需重复 5 行 Controller 样板。
 */
export function FormField<TFieldValues extends FieldValues>({
  control,
  name,
  rules,
  render,
}: FormFieldProps<TFieldValues>) {
  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({ field, fieldState }) =>
        render({
          value: field.value,
          onChange: field.onChange,
          onBlur: field.onBlur,
          name: field.name,
          ref: field.ref,
          error: fieldState.error?.message ?? null,
        }) as React.ReactElement
      }
    />
  );
}
