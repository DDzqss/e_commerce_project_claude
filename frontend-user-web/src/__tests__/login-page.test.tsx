import {
  describe,
  it,
  expect,
  beforeEach,
  vi,
  afterEach,
} from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LoginPage from "@/app/(auth)/login/page";
import { useAuthStore } from "@/lib/auth-store";
import * as authApi from "@/lib/auth-api";
import { ApiError } from "@/lib/api";
import { ErrorCode } from "@/types/errors";

// next/navigation mock
const replaceMock = vi.fn();
const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
    push: pushMock,
  }),
  useSearchParams: () => ({
    get: () => null,
  }),
  usePathname: () => "/login",
}));

describe("LoginPage 集成测试", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    pushMock.mockReset();
    useAuthStore.getState().logout();
    // 手动标记 hydrate 完成，避免 useEffect 分支干扰
    useAuthStore.getState()._setHydrated(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("展示所有必要字段与按钮", () => {
    render(<LoginPage />);
    expect(screen.getByLabelText(/手机号|邮箱/)).toBeInTheDocument();
    expect(screen.getByLabelText("密码")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "登录" }),
    ).toBeInTheDocument();
    expect(screen.getByText("忘记密码？")).toBeInTheDocument();
    expect(screen.getByText("立即注册")).toBeInTheDocument();
  });

  it("表单校验：空字段阻止提交", async () => {
    const spy = vi.spyOn(authApi, "loginUser");
    render(<LoginPage />);
    fireEvent.click(screen.getByRole("button", { name: "登录" }));
    await waitFor(() => {
      expect(screen.getByText("请输入手机号或邮箱")).toBeInTheDocument();
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it("1003 错误码映射为『账号或密码错误』", async () => {
    vi.spyOn(authApi, "loginUser").mockRejectedValueOnce(
      new ApiError(ErrorCode.BadCredential, "invalid credential"),
    );

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/手机号|邮箱/), {
      target: { value: "13800001234" },
    });
    fireEvent.change(screen.getByLabelText("密码"), {
      target: { value: "Test1234" },
    });
    fireEvent.click(screen.getByRole("button", { name: "登录" }));

    await waitFor(() => {
      expect(screen.getByText("账号或密码错误")).toBeInTheDocument();
    });
  });

  it("1004 错误码映射为『账号已被禁用』", async () => {
    vi.spyOn(authApi, "loginUser").mockRejectedValueOnce(
      new ApiError(ErrorCode.AccountDisabled, "disabled"),
    );

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/手机号|邮箱/), {
      target: { value: "you@example.com" },
    });
    fireEvent.change(screen.getByLabelText("密码"), {
      target: { value: "Test1234" },
    });
    fireEvent.click(screen.getByRole("button", { name: "登录" }));

    await waitFor(() => {
      expect(
        screen.getByText("账号已被禁用，请联系客服"),
      ).toBeInTheDocument();
    });
  });

  it("登录成功写 store 并跳首页", async () => {
    vi.spyOn(authApi, "loginUser").mockResolvedValueOnce({
      access_token: "AT",
      refresh_token: "RT",
      expires_in: 900,
      user: {
        id: 1,
        phone: "13800001234",
        email: null,
        nickname: "test",
        avatar_url: null,
      },
    });

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/手机号|邮箱/), {
      target: { value: "13800001234" },
    });
    fireEvent.change(screen.getByLabelText("密码"), {
      target: { value: "Test1234" },
    });
    fireEvent.click(screen.getByRole("button", { name: "登录" }));

    await waitFor(() => {
      expect(useAuthStore.getState().accessToken).toBe("AT");
    });
    expect(replaceMock).toHaveBeenCalledWith("/");
  });
});
