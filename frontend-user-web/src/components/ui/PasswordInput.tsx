"use client";

import { useState, forwardRef, type Ref } from "react";
import { Input, type InputProps } from "./Input";

/**
 * 密码输入框：包装 Input，附带"显示/隐藏"切换按钮。
 * 支持 aria-label 便于屏幕阅读器识别切换动作。
 */
export const PasswordInput = forwardRef<HTMLInputElement, InputProps>(
  function PasswordInput(props, ref: Ref<HTMLInputElement>) {
    const [visible, setVisible] = useState(false);
    return (
      <Input
        ref={ref}
        type={visible ? "text" : "password"}
        autoComplete={props.autoComplete ?? "current-password"}
        {...props}
        rightAddon={
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="text-xs text-neutral-500 transition hover:text-[color:var(--color-primary)]"
            aria-label={visible ? "隐藏密码" : "显示密码"}
            aria-pressed={visible}
          >
            {visible ? "隐藏" : "显示"}
          </button>
        }
      />
    );
  },
);
