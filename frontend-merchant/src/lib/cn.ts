/**
 * 简化的 className 合并工具（内联实现，避免额外运行时依赖）。
 *
 * 语义近似 clsx：
 *   - string / number → 直接拼接
 *   - false / null / undefined → 忽略
 *   - 数组 → 递归展开
 *   - 对象 → key 在 value 为 truthy 时保留
 *
 * 若后续接入 tailwind-merge 可在此处替换。
 */

export type ClassValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | ClassValue[]
  | { [key: string]: unknown };

function walk(value: ClassValue, out: string[]): void {
  if (!value && value !== 0) return;
  if (typeof value === "string" || typeof value === "number") {
    out.push(String(value));
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) walk(v, out);
    return;
  }
  if (typeof value === "object") {
    for (const key of Object.keys(value)) {
      if ((value as Record<string, unknown>)[key]) out.push(key);
    }
  }
}

export function cn(...values: ClassValue[]): string {
  const out: string[] = [];
  for (const v of values) walk(v, out);
  return out.join(" ");
}
