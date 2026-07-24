/**
 * Idempotency-Key 客户端工具。
 *
 * 契约 §14：`POST /user/orders` 与 `POST /user/orders/{id}/pay` 必须携带
 * `Idempotency-Key` 请求头，格式为客户端生成的 UUID / nanoid，8-120 字符。
 *
 * 前端策略：
 * - 用户进入 checkout 页时，为"下单动作"生成并落到 sessionStorage 的一个 key；
 *   同一个 checkout 会话（切页/断网重试）都用同一个 key，避免"点两次生两个订单"。
 * - 下单成功（或用户离开）后调用 `clearIdempotencyKey(scope)` 释放。
 * - 支付会话按 order_no 维度独立生成一个 key，一次支付内复用；避免混用。
 *
 * 之所以用 sessionStorage 而不是 localStorage：
 * - 单会话生命周期更贴合"一次下单/一次支付"的语义
 * - 关闭标签页自动清理，不会跨会话残留
 */

const STORAGE_PREFIX = "idempotency-key:";

/**
 * 尽可能用 `crypto.randomUUID()`；不支持时降级到基于时间戳 + 随机数的 fallback。
 * 契约允许 8-120 字符，任意可打印字符即可。
 */
export function createIdempotencyKey(): string {
  if (
    typeof globalThis !== "undefined" &&
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }
  // 极端 fallback：Node ≥ 20 & 主流浏览器都不会走到这里。
  const rand = Math.random().toString(36).slice(2, 12);
  return `${Date.now().toString(36)}-${rand}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

/** SSR-safe 的 sessionStorage 访问器。 */
function safeSession(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * 拿一个稳定的 idempotency key：若 sessionStorage 已有同 scope 记录直接复用，
 * 否则新建并落地。
 *
 * @param scope 语义作用域，例如 `checkout` 或 `pay:${orderNo}`
 */
export function getOrCreateIdempotencyKey(scope: string): string {
  const storage = safeSession();
  const storageKey = `${STORAGE_PREFIX}${scope}`;
  if (storage) {
    const cached = storage.getItem(storageKey);
    if (cached && cached.length >= 8) return cached;
    const fresh = createIdempotencyKey();
    storage.setItem(storageKey, fresh);
    return fresh;
  }
  // SSR / 无 storage 环境（例如测试）：直接生成一个不落地的
  return createIdempotencyKey();
}

/**
 * 释放某 scope 的 key。下单/支付成功后调用，避免下次继续复用。
 */
export function clearIdempotencyKey(scope: string): void {
  const storage = safeSession();
  if (!storage) return;
  storage.removeItem(`${STORAGE_PREFIX}${scope}`);
}

/**
 * 便捷：清除所有 idempotency 相关的 key（用户退出登录时可调）。
 */
export function clearAllIdempotencyKeys(): void {
  const storage = safeSession();
  if (!storage) return;
  const toRemove: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k && k.startsWith(STORAGE_PREFIX)) toRemove.push(k);
  }
  toRemove.forEach((k) => storage.removeItem(k));
}
