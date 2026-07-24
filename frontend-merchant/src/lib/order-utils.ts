/**
 * 订单相关的展示层辅助函数。
 *
 * - 电话号码脱敏（合规要求；订单详情/列表都会用到）
 * - 快递单号校验
 * - 分 → 元 字符串（订单金额展示）
 */

/**
 * 电话号码脱敏：前 3 后 4，中间星号。
 *
 *   13800001111 → 138****1111
 *
 * 对非 11 位手机号 / 固话 尽量安全展示（保留首尾少量字符）。
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "-";
  const s = String(phone).trim();
  if (!s) return "-";
  // 11 位手机号常见格式
  if (/^\d{11}$/.test(s)) {
    return `${s.slice(0, 3)}****${s.slice(7)}`;
  }
  // 其他格式：长度 >=7 时保留首 3 末 4，居中用 *
  if (s.length >= 7) {
    return `${s.slice(0, 3)}${"*".repeat(Math.max(2, s.length - 7))}${s.slice(-4)}`;
  }
  // 太短 → 全部脱敏
  return "*".repeat(s.length);
}

/**
 * 快递单号本地校验（§10.3 / 错误码 13010）：
 *   - 长度 6-30
 *   - 仅 [A-Za-z0-9]
 */
const TRACKING_NO_RE = /^[A-Za-z0-9]{6,30}$/;

export function isValidTrackingNo(v: string | null | undefined): boolean {
  if (!v) return false;
  return TRACKING_NO_RE.test(v.trim());
}

/** 分 → "¥12.34" 字符串。 */
export function formatCentsCny(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || Number.isNaN(cents)) return "¥0.00";
  return `¥${(cents / 100).toFixed(2)}`;
}

/** 常用 ISO 时间 → "YYYY-MM-DD HH:mm"（本地时区）。 */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
