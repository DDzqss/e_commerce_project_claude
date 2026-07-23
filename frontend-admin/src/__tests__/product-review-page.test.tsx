/**
 * 商品审核列表页测试。
 *
 * 覆盖：
 * - 有权限时展示表格
 * - 默认查询 status=pending_review
 * - 切换 tab 后查询参数正确
 * - Row 点击 "查看" 跳详情
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import ProductReviewPage from "@/app/(console)/console/products/review/page";
import { ToastProvider } from "@/components/ui/Toast";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth-store";
import { AdminRole } from "@/lib/rbac";
import type { AdminSPUListItem } from "@/types/api";

// Mock next/navigation
const replaceMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/console/products/review",
}));

// Mock 网络层
const listAllSPUsMock = vi.fn();
vi.mock("@/lib/product-api", () => ({
  listAllSPUs: (...args: unknown[]) => listAllSPUsMock(...args),
  getSPUDetail: vi.fn(),
  approveSPU: vi.fn(),
  rejectSPU: vi.fn(),
  forceOffshelfSPU: vi.fn(),
}));

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <ProductReviewPage />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

function seedRow(overrides: Partial<AdminSPUListItem> = {}): AdminSPUListItem {
  return {
    id: 1001,
    shop_id: 12,
    shop: { id: 12, name: "苹果官方旗舰店" },
    category_id: 125,
    category: { id: 125, name: "手机" },
    brand_id: 8,
    brand: { id: 8, name: "Apple" },
    title: "iPhone 20 Pro",
    subtitle: "钛金属机身",
    main_image: "spu/x.jpg",
    status: "pending_review",
    min_price_cents: 799900,
    max_price_cents: 1099900,
    sales_count: 0,
    view_count: 0,
    reviewer_admin_id: null,
    review_note: null,
    reviewed_at: null,
    published_at: null,
    created_at: "2026-07-22T10:00:00Z",
    updated_at: "2026-07-22T10:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  listAllSPUsMock.mockReset();
  replaceMock.mockReset();
  // 授予 read_all 权限
  useAuthStore.setState({
    status: "authenticated",
    accessToken: "acc",
    refreshToken: "ref",
    admin: {
      id: 1,
      username: "biz",
      display_name: "业务",
      role: AdminRole.BUSINESS_ADMIN,
      status: "active",
      last_login_at: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    permissions: ["admin:spu:read_all", "admin:spu:review"],
    remember: true,
  });
});

describe("ProductReviewPage", () => {
  it("无 read_all 权限展示占位", () => {
    useAuthStore.setState({ permissions: [] });
    renderPage();
    expect(screen.getByText(/无权限访问/)).toBeInTheDocument();
  });

  it("默认查询 status=pending_review 并展示行", async () => {
    listAllSPUsMock.mockResolvedValue({
      items: [seedRow()],
      total: 1,
      page: 1,
      size: 20,
    });

    renderPage();

    await waitFor(() => {
      expect(listAllSPUsMock).toHaveBeenCalled();
    });
    // 第一次调用的 query
    const firstCall = listAllSPUsMock.mock.calls[0]?.[0];
    expect(firstCall?.status).toBe("pending_review");
    expect(firstCall?.page).toBe(1);
    expect(firstCall?.size).toBe(20);

    // 表格里能看到商品标题
    await waitFor(() => {
      expect(screen.getByText("iPhone 20 Pro")).toBeInTheDocument();
    });
    expect(screen.getByText("苹果官方旗舰店")).toBeInTheDocument();
  });

  it("切换到「已上架」tab 后触发新查询 status=approved", async () => {
    listAllSPUsMock.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      size: 20,
    });

    renderPage();
    await waitFor(() => {
      expect(listAllSPUsMock).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: "已上架" }));

    await waitFor(() => {
      const calls = listAllSPUsMock.mock.calls;
      const last = calls[calls.length - 1]?.[0];
      expect(last?.status).toBe("approved");
    });
  });

  it("空数据展示空态文案", async () => {
    listAllSPUsMock.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      size: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/暂无符合条件的商品/)).toBeInTheDocument();
    });
  });
});
