/**
 * 登录流程集成测试。
 *
 * 覆盖：
 *  - 输入合法凭证 → 调用 loginMerchant → 写入 store → toast + 路由跳转
 *  - 后端返回 1003（凭证错误）→ 页面显示错误、store 未变
 *
 * 策略：mock `@/lib/auth-api`、`next/navigation`；使用 react-testing-library。
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { useMerchantAuthStore } from "@/lib/auth-store";
import { ApiError } from "@/types/errors";
import type { TokenPair } from "@/types/api";

// ---- mocks ----------------------------------------------------------------

const replaceMock = vi.fn();
const searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => searchParams,
  usePathname: () => "/login",
}));

const loginMerchantMock = vi.fn();
vi.mock("@/lib/auth-api", () => ({
  loginMerchant: (...args: unknown[]) => loginMerchantMock(...args),
  logoutMerchant: vi.fn().mockResolvedValue(undefined),
  changePassword: vi.fn().mockResolvedValue(undefined),
  refresh: vi.fn(),
}));

// 延后 import：确保上面的 mock 生效
import LoginPage from "@/app/(auth)/login/page";

// ---- helpers --------------------------------------------------------------

function renderWithProviders(node: ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{node}</QueryClientProvider>);
}

const goodTokenPair: TokenPair = {
  access_token: "access-1",
  refresh_token: "refresh-1",
  expires_in: 900,
  merchant_account: {
    id: 1,
    user_id: 100,
    login_name: "shop1_owner",
    shop_id: 200,
    role: "SHOP_OWNER",
    status: "active",
    last_login_at: null,
    created_at: "2026-07-22T00:00:00Z",
    updated_at: "2026-07-22T00:00:00Z",
  },
  shop: {
    id: 200,
    name: "示例店铺",
    description: null,
    contact_name: "李明",
    contact_phone: "13800001111",
    status: "active",
    created_at: "2026-07-22T00:00:00Z",
    updated_at: "2026-07-22T00:00:00Z",
  },
};

// ---- tests ----------------------------------------------------------------

describe("LoginPage", () => {
  beforeEach(() => {
    replaceMock.mockClear();
    loginMerchantMock.mockReset();
    useMerchantAuthStore.getState().clear();
    window.localStorage.clear();
  });

  it("登录成功后写入 store 并跳转 /dashboard", async () => {
    loginMerchantMock.mockResolvedValueOnce(goodTokenPair);

    renderWithProviders(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/^登录名/), {
      target: { value: "shop1_owner" },
    });
    fireEvent.change(screen.getByLabelText(/^密码/), {
      target: { value: "GoodPass1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^登录$|登录中/ }));

    await waitFor(() => {
      expect(loginMerchantMock).toHaveBeenCalledWith({
        login_name: "shop1_owner",
        password: "GoodPass1",
      });
    });

    await waitFor(() => {
      const state = useMerchantAuthStore.getState();
      expect(state.accessToken).toBe("access-1");
      expect(state.merchantAccount?.login_name).toBe("shop1_owner");
    });

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("凭证错误时显示错误提示，且不写入 store", async () => {
    loginMerchantMock.mockRejectedValueOnce(
      new ApiError(1003, "账号或密码错误", 401),
    );

    renderWithProviders(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/^登录名/), {
      target: { value: "shop1_owner" },
    });
    fireEvent.change(screen.getByLabelText(/^密码/), {
      target: { value: "WrongPass1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^登录$|登录中/ }));

    await waitFor(() => {
      expect(loginMerchantMock).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/登录名或密码错误/);
    });

    expect(useMerchantAuthStore.getState().accessToken).toBeNull();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("字段校验：密码 < 8 位时前端本地报错", async () => {
    renderWithProviders(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/^登录名/), {
      target: { value: "shop1_owner" },
    });
    fireEvent.change(screen.getByLabelText(/^密码/), {
      target: { value: "123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^登录$|登录中/ }));

    await waitFor(() => {
      expect(screen.getByText(/密码至少 8 位/)).toBeInTheDocument();
    });
    expect(loginMerchantMock).not.toHaveBeenCalled();
  });
});
