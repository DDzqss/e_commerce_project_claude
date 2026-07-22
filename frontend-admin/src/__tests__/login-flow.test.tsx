/**
 * 登录页流程集成测试。
 *
 * 覆盖：
 * - 表单必填校验（不调用 API）
 * - 提交后：mock loginAdmin + getAdminMe → 期望 auth-store 被填充
 * - 提交失败（1003）：错误提示展示
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LoginPage from "@/app/(auth)/login/page";
import { ToastProvider } from "@/components/ui/Toast";
import { useAuthStore } from "@/lib/auth-store";
import { AdminRole } from "@/lib/rbac";
import { ApiError } from "@/lib/api";

// Mock next/navigation
const replaceMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));

// Mock 网络层
const loginAdminMock = vi.fn();
const getAdminMeMock = vi.fn();

vi.mock("@/lib/auth-api", () => ({
  loginAdmin: (...args: unknown[]) => loginAdminMock(...args),
  logoutAdmin: vi.fn(),
}));

vi.mock("@/lib/admin-api", () => ({
  getAdminMe: () => getAdminMeMock(),
}));

function renderPage() {
  return render(
    <ToastProvider>
      <LoginPage />
    </ToastProvider>,
  );
}

beforeEach(() => {
  useAuthStore.getState().clearSession();
  loginAdminMock.mockReset();
  getAdminMeMock.mockReset();
  replaceMock.mockReset();
});

describe("AdminLoginPage", () => {
  it("空提交显示前端校验错误", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "登录" }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "请填写用户名与密码",
      );
    });
    expect(loginAdminMock).not.toHaveBeenCalled();
  });

  it("登录成功：写入 auth-store 并触发跳转", async () => {
    loginAdminMock.mockResolvedValue({
      admin: {
        id: 1,
        username: "super",
        display_name: "超管",
        role: AdminRole.SUPER_ADMIN,
        status: "active",
        last_login_at: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      access_token: "acc",
      refresh_token: "ref",
      expires_in: 900,
    });
    getAdminMeMock.mockResolvedValue({
      admin: {
        id: 1,
        username: "super",
        display_name: "超管",
        role: AdminRole.SUPER_ADMIN,
        status: "active",
        last_login_at: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      permissions: [
        "admin:self:read",
        "admin:merchant_application:read",
        "admin:merchant_application:review",
      ],
    });

    renderPage();
    fireEvent.change(screen.getByPlaceholderText("请输入管理员用户名"), {
      target: { value: "super" },
    });
    fireEvent.change(screen.getByPlaceholderText("请输入密码"), {
      target: { value: "Test1234" },
    });
    fireEvent.click(screen.getByRole("button", { name: "登录" }));

    await waitFor(() => {
      const state = useAuthStore.getState();
      expect(state.accessToken).toBe("acc");
      expect(state.refreshToken).toBe("ref");
      expect(state.admin?.username).toBe("super");
      expect(state.permissions).toContain(
        "admin:merchant_application:review",
      );
    });
    expect(replaceMock).toHaveBeenCalledWith("/console");
  });

  it("登录失败（1003）展示友好错误", async () => {
    loginAdminMock.mockRejectedValue(
      new ApiError(1003, "invalid credentials"),
    );

    renderPage();
    fireEvent.change(screen.getByPlaceholderText("请输入管理员用户名"), {
      target: { value: "super" },
    });
    fireEvent.change(screen.getByPlaceholderText("请输入密码"), {
      target: { value: "wrong-pwd" },
    });
    fireEvent.click(screen.getByRole("button", { name: "登录" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "账号或密码错误",
      );
    });
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});
