"use client";

/**
 * 密码输入框（可切换显隐）。
 * 用于登录 / 修改密码 / approve 展示明文密码等场景。
 */

import { forwardRef, useState, type InputHTMLAttributes } from "react";
import clsx from "clsx";
import { Input } from "./Input";

export interface PasswordInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  invalid?: boolean;
  /** 默认不显示明文；可通过外部 controlled 强制常显（如 approve 结果展示） */
  defaultVisible?: boolean;
  /** 是否禁用切换按钮（用于纯展示） */
  toggleDisabled?: boolean;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput(
    {
      invalid,
      defaultVisible = false,
      toggleDisabled = false,
      className,
      ...rest
    },
    ref,
  ) {
    const [visible, setVisible] = useState(defaultVisible);
    return (
      <div className={clsx("relative", className)}>
        <Input
          ref={ref}
          type={visible ? "text" : "password"}
          invalid={invalid}
          className="pr-16"
          {...rest}
        />
        {!toggleDisabled ? (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute inset-y-0 right-2 my-auto h-6 rounded px-2 text-xs text-neutral-500 hover:bg-neutral-100"
            aria-label={visible ? "隐藏密码" : "显示密码"}
          >
            {visible ? "隐藏" : "显示"}
          </button>
        ) : null}
      </div>
    );
  },
);
