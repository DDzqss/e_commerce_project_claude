"use client";

import { forwardRef, useEffect, useState, type ChangeEvent } from "react";

import { Input, type InputProps } from "./Input";

export interface PriceInputProps
  extends Omit<InputProps, "value" | "onChange" | "type"> {
  /** 受控值，单位：分 */
  valueCents: number | null | undefined;
  /** 变更回调，参数为新的分值（>=0），空 → null */
  onChangeCents: (cents: number | null) => void;
  /** 是否允许 0；默认 false（价格必须 >0） */
  allowZero?: boolean;
}

/**
 * 价格输入框。
 *
 * - 用户填"元"（最多两位小数）
 * - state / callback 传递"分"（int），避免浮点误差
 * - 失焦时格式化为两位小数
 *
 * 兼容后端 §3.4 的 `price_cents: INTEGER`。
 */
export const PriceInput = forwardRef<HTMLInputElement, PriceInputProps>(
  function PriceInput(
    { valueCents, onChangeCents, allowZero = false, invalid, ...rest },
    ref,
  ) {
    // 内部保留字符串状态，避免用户输入 "1." 时被立即格式化
    const [text, setText] = useState<string>(() =>
      centsToYuanString(valueCents),
    );

    // 外部 valueCents 变化时同步内部（前提：解析结果不同）
    useEffect(() => {
      const parsed = parseYuanText(text);
      if (parsed !== valueCents) {
        setText(centsToYuanString(valueCents));
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [valueCents]);

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      // 只允许数字与最多一个小数点；最多两位小数
      if (raw !== "" && !/^\d*\.?\d{0,2}$/u.test(raw)) return;
      setText(raw);
      const cents = parseYuanText(raw);
      if (cents === null && raw === "") {
        onChangeCents(null);
        return;
      }
      if (cents === null) return; // 输入进行中（如 "."）暂不上抛
      if (!allowZero && cents === 0) {
        onChangeCents(0);
        return;
      }
      onChangeCents(cents);
    };

    const handleBlur = () => {
      if (text === "") return;
      const cents = parseYuanText(text);
      if (cents === null) return;
      setText(centsToYuanString(cents));
    };

    return (
      <Input
        ref={ref}
        type="text"
        inputMode="decimal"
        placeholder="0.00"
        invalid={invalid}
        value={text}
        onChange={handleChange}
        onBlur={handleBlur}
        {...rest}
      />
    );
  },
);

/** 分 → "12.34" 字符串（null → 空串）。 */
export function centsToYuanString(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  if (!Number.isFinite(cents)) return "";
  return (cents / 100).toFixed(2);
}

/** 元字符串 → 分（无效 / 空 → null）。 */
export function parseYuanText(text: string): number | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (!/^\d+(\.\d{1,2})?$/u.test(trimmed)) return null;
  const yuan = Number.parseFloat(trimmed);
  if (Number.isNaN(yuan)) return null;
  return Math.round(yuan * 100);
}
