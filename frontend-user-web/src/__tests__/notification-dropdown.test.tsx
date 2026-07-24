/**
 * Phase 5 NotificationDropdown 单元测试。
 *
 * - 未登录：不渲染任何铃铛
 * - 已登录 + unread=0：铃铛显示但无徽章
 * - 已登录 + unread=3：徽章显示 "3"
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

import { NotificationDropdown } from "@/components/notifications/NotificationDropdown";
import { useAuthStore } from "@/lib/auth-store";
import * as notifApi from "@/lib/notification-api";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));

function wrap(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

// 直接 stub 未读数
const getUnreadCountSpy = vi.spyOn(notifApi, "getUnreadCount");
const listNotificationsSpy = vi.spyOn(notifApi, "listNotifications");

describe("NotificationDropdown", () => {
  beforeEach(() => {
    // 默认已登录 hydrate
    useAuthStore.setState({
      accessToken: "at",
      refreshToken: "rt",
      user: {
        id: 1,
        phone: null,
        email: null,
        nickname: "u",
        avatar_url: null,
      },
      hasHydrated: true,
    });
    listNotificationsSpy.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      size: 10,
    });
  });

  afterEach(() => {
    getUnreadCountSpy.mockReset();
    listNotificationsSpy.mockReset();
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      user: null,
      hasHydrated: true,
    });
  });

  it("未登录时不渲染铃铛", () => {
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      user: null,
      hasHydrated: true,
    });
    render(wrap(<NotificationDropdown />));
    expect(screen.queryByTestId("notification-bell")).toBeNull();
  });

  it("已登录 + unread=0 → 铃铛显示但无徽章", async () => {
    getUnreadCountSpy.mockResolvedValue({ count: 0 });
    render(wrap(<NotificationDropdown />));
    expect(await screen.findByTestId("notification-bell")).toBeInTheDocument();
    // 等一次 flush；徽章不应出现
    await waitFor(() => {
      expect(screen.queryByTestId("notification-badge")).toBeNull();
    });
  });

  it("已登录 + unread=3 → 徽章显示 3", async () => {
    getUnreadCountSpy.mockResolvedValue({ count: 3 });
    render(wrap(<NotificationDropdown />));
    const badge = await screen.findByTestId("notification-badge");
    expect(badge.textContent).toBe("3");
  });

  it("已登录 + unread=150 → 徽章显示 99+", async () => {
    getUnreadCountSpy.mockResolvedValue({ count: 150 });
    render(wrap(<NotificationDropdown />));
    const badge = await screen.findByTestId("notification-badge");
    expect(badge.textContent).toBe("99+");
  });
});
