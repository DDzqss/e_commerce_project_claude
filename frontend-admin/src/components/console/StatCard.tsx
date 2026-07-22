import type { ReactNode } from "react";

export type StatCardTone = "default" | "info" | "warning" | "danger" | "success";

interface StatCardProps {
  label: string;
  value: number | string;
  hint?: ReactNode;
  tone?: StatCardTone;
}

/**
 * 数据统计卡片。
 *
 * 管理端惯例：
 * - 标签 12px 灰色置顶
 * - 数值大字号加粗
 * - hint 小字灰色置底，用于说明口径
 * - 左侧色条根据 tone 变化，用于快速扫读风险等级
 */
export function StatCard({ label, value, hint, tone = "default" }: StatCardProps) {
  const barColor: Record<StatCardTone, string> = {
    default: "bg-[color:var(--color-primary-300)]",
    info: "bg-[color:var(--color-info)]",
    warning: "bg-[color:var(--color-warning)]",
    danger: "bg-[color:var(--color-danger)]",
    success: "bg-[color:var(--color-success)]",
  };

  return (
    <article className="relative overflow-hidden rounded-md border border-[color:var(--color-border)] bg-white p-4 shadow-[0_1px_0_rgba(15,23,42,0.02)]">
      <span
        aria-hidden
        className={`absolute left-0 top-0 h-full w-1 ${barColor[tone]}`}
      />
      <div className="pl-2">
        <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          {label}
        </div>
        <div className="mt-2 text-2xl font-semibold tabular-nums text-neutral-900">
          {value}
        </div>
        {hint ? (
          <div className="mt-2 text-xs leading-relaxed text-neutral-400">
            {hint}
          </div>
        ) : null}
      </div>
    </article>
  );
}
