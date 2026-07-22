import clsx, { type ClassValue } from "clsx";

/**
 * 简单包装：与 shadcn/ui 风格一致的 `cn`。
 * 目前不上 tailwind-merge，因为组件较少、冲突可控；
 * 后续如需可替换为 `twMerge(clsx(inputs))`。
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
