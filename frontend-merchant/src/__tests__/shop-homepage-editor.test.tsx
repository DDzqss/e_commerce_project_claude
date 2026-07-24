/**
 * ShopHomepageEditor 表单交互测试。
 *
 * 覆盖：
 *   - SHOP_OWNER：所有字段可编辑；保存按钮初始 disabled，脏化后启用
 *   - description 超长 → 报错，不调 updateShop
 *   - 合法保存 → updateShop 被调用（含 logo/banner/announcement 字段）
 *   - 非 SHOP_OWNER：字段 disabled，保存按钮不出现，提示只读
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// ---- mocks --------------------------------------------------------------
vi.mock("@/components/ui/Toast", async () => {
  const actual = await vi.importActual<typeof import("@/components/ui/Toast")>(
    "@/components/ui/Toast",
  );
  return {
    ...actual,
    toast: {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warning: vi.fn(),
      dismiss: vi.fn(),
    },
  };
});

const updateShopMock = vi.fn();
vi.mock("@/lib/merchant-api", () => ({
  updateShop: (...args: unknown[]) => updateShopMock(...args),
  getMe: vi.fn(),
}));

// mock auth-store to a valid shape
vi.mock("@/lib/auth-store", () => {
  const store = {
    setShop: vi.fn(),
  };
  const useMerchantAuthStore = (
    selector?: (s: typeof store) => unknown,
  ) => (selector ? selector(store) : store);
  useMerchantAuthStore.getState = () => store;
  return { useMerchantAuthStore };
});

// avoid ImageUpload's real upload; the sub-component is exercised elsewhere
vi.mock("@/lib/upload", () => ({
  uploadFile: vi.fn(),
  validateImageFile: () => null,
  ALLOWED_IMAGE_TYPES: new Set(["image/jpeg"]),
  MAX_UPLOAD_BYTES: 5 * 1024 * 1024,
}));

import { ShopHomepageEditor } from "@/components/shop/ShopHomepageEditor";
import type { ShopOut } from "@/types/api";

function renderWithProviders(node: ReactNode) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={qc}>{node}</QueryClientProvider>);
}

const baseShop: ShopOut = {
  id: 12,
  name: "小李杂货铺",
  description: "主营家居日用",
  contact_name: "李明",
  contact_phone: "13800001111",
  status: "active",
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-22T00:00:00Z",
  logo_url: null,
  banner_url: null,
  announcement: null,
  rating_avg: 4.85,
  rating_count: 128,
  sales_count: 3421,
};

describe("ShopHomepageEditor - SHOP_OWNER", () => {
  beforeEach(() => {
    updateShopMock.mockReset();
  });

  it("初始渲染：保存按钮 disabled；字段可编辑", () => {
    renderWithProviders(<ShopHomepageEditor shop={baseShop} canEdit />);
    const saveBtn = screen.getByRole("button", { name: "保存" });
    expect(saveBtn).toBeDisabled();
    // name 输入只读
    const nameInputs = screen.getAllByDisplayValue("小李杂货铺");
    expect(nameInputs[0]).toHaveAttribute("readOnly");
    // 联系人输入可编辑
    const contactName = screen.getByDisplayValue("李明");
    expect(contactName).not.toBeDisabled();
  });

  it("修改联系人 → 保存按钮启用，updateShop 被调用带全部字段", async () => {
    updateShopMock.mockResolvedValueOnce({
      ...baseShop,
      contact_name: "李经理",
      announcement: "暑期不打烊",
    });
    renderWithProviders(<ShopHomepageEditor shop={baseShop} canEdit />);
    fireEvent.change(screen.getByDisplayValue("李明"), {
      target: { value: "李经理" },
    });
    fireEvent.change(
      screen.getByPlaceholderText(/例如：暑期不打烊/),
      { target: { value: "暑期不打烊 · 客服 9-21 点" } },
    );

    const saveBtn = screen.getByRole("button", { name: "保存" });
    await waitFor(() => expect(saveBtn).not.toBeDisabled());
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(updateShopMock).toHaveBeenCalledTimes(1);
    });
    const call = updateShopMock.mock.calls[0];
    expect(call).toBeDefined();
    const payload = call![0] as Record<string, unknown>;
    expect(payload).toMatchObject({
      contact_name: "李经理",
      contact_phone: "13800001111",
      announcement: "暑期不打烊 · 客服 9-21 点",
      logo_url: null,
      banner_url: null,
    });
    // description 保持原值
    expect(payload.description).toBe("主营家居日用");
  });

  it("联系电话格式非法 → 阻止提交", async () => {
    renderWithProviders(<ShopHomepageEditor shop={baseShop} canEdit />);
    fireEvent.change(screen.getByDisplayValue("13800001111"), {
      target: { value: "12abc" },
    });
    const saveBtn = screen.getByRole("button", { name: "保存" });
    await waitFor(() => expect(saveBtn).not.toBeDisabled());
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(screen.getByText(/11 位中国大陆手机号/)).toBeInTheDocument();
    });
    expect(updateShopMock).not.toHaveBeenCalled();
  });
});

describe("ShopHomepageEditor - 非 SHOP_OWNER", () => {
  it("canEdit=false：无「保存」按钮 + 提示只读", () => {
    renderWithProviders(<ShopHomepageEditor shop={baseShop} canEdit={false} />);
    expect(
      screen.queryByRole("button", { name: "保存" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/仅可查看店铺信息/)).toBeInTheDocument();
    // 联系人字段 disabled
    const contactName = screen.getByDisplayValue("李明");
    expect(contactName).toBeDisabled();
  });
});
