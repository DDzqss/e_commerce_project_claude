"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

/**
 * 应用级 QueryClientProvider（客户端组件）。
 *
 * - useState 保证浏览器端 QueryClient 仅创建一次；
 *   服务端每次渲染会新建，避免请求跨请求泄漏。
 * - 管理端 staleTime 略短（15s），因为审核 / 仲裁类数据实时性更敏感。
 * - retry 保守设为 1，破坏性操作 mutation 不重试。
 */
export function ReactQueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
