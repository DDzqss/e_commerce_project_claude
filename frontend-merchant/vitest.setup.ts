import "@testing-library/jest-dom/vitest";

// jsdom 26+ 默认关闭 localStorage；这里提供一个纯内存实现，
// 供 zustand persist middleware 及业务代码使用。
if (typeof window !== "undefined" && !window.localStorage) {
  const storage = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, String(value));
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => storage.clear(),
      key: (index: number) => Array.from(storage.keys())[index] ?? null,
      get length() {
        return storage.size;
      },
    },
  });
}
