import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore } from "@/lib/auth-store";
import type { AuthResult } from "@/types/api";

const fixture: AuthResult = {
  access_token: "access-abc",
  refresh_token: "refresh-xyz",
  expires_in: 900,
  user: {
    id: 1001,
    phone: "13800001234",
    email: null,
    nickname: "老李",
    avatar_url: null,
  },
};

describe("useAuthStore", () => {
  beforeEach(() => {
    // 每个用例前重置到干净状态
    useAuthStore.getState().logout();
    if (typeof window !== "undefined") {
      window.localStorage.clear();
    }
  });

  it("初始状态为未登录", () => {
    const s = useAuthStore.getState();
    expect(s.accessToken).toBeNull();
    expect(s.refreshToken).toBeNull();
    expect(s.user).toBeNull();
  });

  it("login 后写入 token 与用户", () => {
    useAuthStore.getState().login(fixture);
    const s = useAuthStore.getState();
    expect(s.accessToken).toBe("access-abc");
    expect(s.refreshToken).toBe("refresh-xyz");
    expect(s.user?.nickname).toBe("老李");
  });

  it("setTokens 只更新 token，不动 user", () => {
    useAuthStore.getState().login(fixture);
    useAuthStore.getState().setTokens({
      accessToken: "new-a",
      refreshToken: "new-r",
    });
    const s = useAuthStore.getState();
    expect(s.accessToken).toBe("new-a");
    expect(s.refreshToken).toBe("new-r");
    expect(s.user?.id).toBe(1001);
  });

  it("updateUser 合并局部字段", () => {
    useAuthStore.getState().login(fixture);
    useAuthStore.getState().updateUser({ nickname: "新昵称" });
    expect(useAuthStore.getState().user?.nickname).toBe("新昵称");
    expect(useAuthStore.getState().user?.id).toBe(1001);
  });

  it("logout 清空所有会话字段", () => {
    useAuthStore.getState().login(fixture);
    useAuthStore.getState().logout();
    const s = useAuthStore.getState();
    expect(s.accessToken).toBeNull();
    expect(s.refreshToken).toBeNull();
    expect(s.user).toBeNull();
  });

  it("persist 到 localStorage", () => {
    useAuthStore.getState().login(fixture);
    const raw = window.localStorage.getItem("user-web-auth-v1");
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    // zustand persist 结构：{ state: { ... }, version }
    expect(parsed.state.accessToken).toBe("access-abc");
    expect(parsed.state.user.id).toBe(1001);
  });
});
