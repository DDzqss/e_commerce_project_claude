/**
 * 售后展示层辅助函数。
 *
 * - 剩余审核时间格式化 + 颜色分级（<12h 红 / <24h 橙 / 其他绿）
 * - 时间差人性化文案
 */

export interface DeadlineInfo {
  /** 距离 deadline 的毫秒差；负数表示已超时 */
  diffMs: number;
  /** 分级：< 12h → 'danger'；< 24h → 'warning'；否则 'normal' */
  level: "danger" | "warning" | "normal" | "overdue";
  /** 人性化文案，如 "剩余 3 小时"、"已超时 1 小时"、"1 天 2 小时" */
  text: string;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * 根据 ISO deadline 生成剩余时间信息。
 *
 * 分级规则（AGENTS.md §11 + task 要求）：
 *   - 已过 deadline → overdue（红字加重）
 *   - < 12h        → danger（红字）
 *   - < 24h        → warning（橙字）
 *   - 其他         → normal（绿字）
 *
 * @param iso ISO 8601 deadline；null / 未来太远时返回 diffMs 极大值
 * @param now 用于测试注入
 */
export function computeDeadlineInfo(
  iso: string | null | undefined,
  now: Date = new Date(),
): DeadlineInfo | null {
  if (!iso) return null;
  const deadline = new Date(iso);
  if (Number.isNaN(deadline.getTime())) return null;
  const diffMs = deadline.getTime() - now.getTime();

  if (diffMs <= 0) {
    return {
      diffMs,
      level: "overdue",
      text: `已超时 ${humanizeMs(-diffMs)}`,
    };
  }
  const level: DeadlineInfo["level"] =
    diffMs < 12 * HOUR_MS
      ? "danger"
      : diffMs < 24 * HOUR_MS
        ? "warning"
        : "normal";
  return {
    diffMs,
    level,
    text: `剩余 ${humanizeMs(diffMs)}`,
  };
}

/**
 * ms → "X 天 Y 小时" / "Y 小时 Z 分" / "Z 分钟"。
 * 用于所有 deadline 展示，避免各处独立实现造成不一致。
 */
export function humanizeMs(ms: number): string {
  const abs = Math.max(0, Math.floor(ms));
  const days = Math.floor(abs / DAY_MS);
  const hours = Math.floor((abs % DAY_MS) / HOUR_MS);
  const minutes = Math.floor((abs % HOUR_MS) / (60 * 1000));
  if (days > 0) {
    return hours > 0 ? `${days} 天 ${hours} 小时` : `${days} 天`;
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours} 小时 ${minutes} 分` : `${hours} 小时`;
  }
  return `${Math.max(1, minutes)} 分钟`;
}

/** 剩余时间对应的 tailwind 文本色 class。 */
export function deadlineTextClass(level: DeadlineInfo["level"] | undefined): string {
  switch (level) {
    case "overdue":
      return "text-red-700 font-semibold";
    case "danger":
      return "text-red-600";
    case "warning":
      return "text-amber-600";
    case "normal":
      return "text-emerald-600";
    default:
      return "text-neutral-500";
  }
}
