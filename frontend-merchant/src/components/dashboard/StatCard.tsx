import type { ReactNode } from "react";

export type StatCardTone = "primary" | "warning" | "danger" | "info" | "success";

const TONE_STYLES: Record<StatCardTone, { badge: string; value: string }> = {
  primary: {
    badge: "bg-blue-50 text-[var(--color-primary)]",
    value: "text-[var(--color-primary)]",
  },
  warning: {
    badge: "bg-amber-50 text-amber-700",
    value: "text-amber-700",
  },
  danger: {
    badge: "bg-red-50 text-red-700",
    value: "text-red-700",
  },
  info: {
    badge: "bg-sky-50 text-sky-700",
    value: "text-sky-700",
  },
  success: {
    badge: "bg-emerald-50 text-emerald-700",
    value: "text-emerald-700",
  },
};

export interface StatCardProps {
  label: string;
  value: number | string;
  hint?: ReactNode;
  tone?: StatCardTone;
}

export function StatCard({
  label,
  value,
  hint,
  tone = "primary",
}: StatCardProps) {
  const styles = TONE_STYLES[tone];
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-neutral-600">{label}</span>
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${styles.badge}`}
        >
          {tone.toUpperCase()}
        </span>
      </div>
      <div className={`mt-3 text-3xl font-semibold ${styles.value}`}>
        {value}
      </div>
      {hint ? (
        <div className="mt-2 text-xs text-neutral-500">{hint}</div>
      ) : null}
    </div>
  );
}
