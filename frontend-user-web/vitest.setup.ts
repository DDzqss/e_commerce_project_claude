import "@testing-library/jest-dom/vitest";

/**
 * jsdom 在某些版本下 window.localStorage / sessionStorage 未挂载，
 * 而我们的 auth-store / idempotency 依赖 persist / sessionStorage。
 * 提供一个内存实现，保证测试可运行。
 */
function makeMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key) => (store.has(key) ? store.get(key)! : null),
    key: (index) => Array.from(store.keys())[index] ?? null,
    removeItem: (key) => {
      store.delete(key);
    },
    setItem: (key, value) => {
      store.set(key, String(value));
    },
  };
}

if (typeof window !== "undefined" && !window.localStorage) {
  Object.defineProperty(window, "localStorage", {
    value: makeMemoryStorage(),
    configurable: true,
  });
}

if (typeof window !== "undefined" && !window.sessionStorage) {
  Object.defineProperty(window, "sessionStorage", {
    value: makeMemoryStorage(),
    configurable: true,
  });
}
