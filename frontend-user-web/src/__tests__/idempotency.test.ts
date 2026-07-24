import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAllIdempotencyKeys,
  clearIdempotencyKey,
  createIdempotencyKey,
  getOrCreateIdempotencyKey,
} from "@/lib/idempotency";

describe("idempotency", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("createIdempotencyKey 生成非空且长度>=8 的 key", () => {
    const k = createIdempotencyKey();
    expect(typeof k).toBe("string");
    expect(k.length).toBeGreaterThanOrEqual(8);
    // 两次不应相同
    expect(createIdempotencyKey()).not.toBe(k);
  });

  it("getOrCreateIdempotencyKey 同 scope 复用同一 key", () => {
    const a = getOrCreateIdempotencyKey("checkout");
    const b = getOrCreateIdempotencyKey("checkout");
    expect(a).toBe(b);
  });

  it("不同 scope 生成不同 key", () => {
    const a = getOrCreateIdempotencyKey("checkout");
    const b = getOrCreateIdempotencyKey("pay:X001");
    expect(a).not.toBe(b);
  });

  it("clearIdempotencyKey 后再取会新生成 key", () => {
    const a = getOrCreateIdempotencyKey("checkout");
    clearIdempotencyKey("checkout");
    const b = getOrCreateIdempotencyKey("checkout");
    expect(a).not.toBe(b);
  });

  it("clearAllIdempotencyKeys 清空所有 key", () => {
    getOrCreateIdempotencyKey("checkout");
    getOrCreateIdempotencyKey("pay:X002");
    clearAllIdempotencyKeys();
    // 内部 sessionStorage 应被清光（前缀）
    let count = 0;
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const k = window.sessionStorage.key(i);
      if (k?.startsWith("idempotency-key:")) count++;
    }
    expect(count).toBe(0);
  });

  it("crypto.randomUUID 不可用时降级 fallback 仍能生成 key", () => {
    // 临时把 crypto.randomUUID 拿掉
    const orig = globalThis.crypto?.randomUUID;
    if (globalThis.crypto) {
      // @ts-expect-error 模拟不支持
      globalThis.crypto.randomUUID = undefined;
    }
    try {
      const k = createIdempotencyKey();
      expect(k.length).toBeGreaterThanOrEqual(8);
    } finally {
      if (globalThis.crypto && orig) {
        globalThis.crypto.randomUUID = orig;
      }
    }
  });
});
