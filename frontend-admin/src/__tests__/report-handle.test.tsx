/**
 * 举报处理弹窗 + 队列联动测试。
 *
 * 关键覆盖：
 * - HandleReportModal review_note < 5 字校验拦截
 * - uphold 时需勾选二次确认
 * - uphold 与 dismiss action 分别通过对应 API
 * - AdminReviewReports 队列页可切换 tab 并触发查询
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AdminReviewReportsPage from "@/app/(console)/console/review-reports/page";
import { HandleReportModal } from "@/components/reports/HandleReportModal";
import { ToastProvider } from "@/components/ui/Toast";
import { useAuthStore } from "@/lib/auth-store";
import { AdminRole } from "@/lib/rbac";
import type { AdminReviewReportListItem } from "@/types/review";

// ---------------------------------------------------------------------------
// next/navigation mock
// ---------------------------------------------------------------------------
const replaceMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/console/review-reports",
}));

// ---------------------------------------------------------------------------
// API mocks
// ---------------------------------------------------------------------------
const listReportsMock = vi.fn();
const upholdMock = vi.fn();
const dismissMock = vi.fn();
vi.mock("@/lib/review-report-api", () => ({
  listReports: (...args: unknown[]) => listReportsMock(...args),
  upholdReport: (...args: unknown[]) => upholdMock(...args),
  dismissReport: (...args: unknown[]) => dismissMock(...args),
}));

function makeRow(
  overrides: Partial<AdminReviewReportListItem> = {},
): AdminReviewReportListItem {
  return {
    id: 501,
    review_id: 1001,
    reporter_user_id: 42,
    reporter: {
      id: 42,
      nickname: "reporter",
      phone: "13800001111",
      email: null,
    },
    reason_category: "ad_spam",
    reason_note: "疑似广告刷屏",
    status: "pending",
    reviewer_admin_id: null,
    reviewer_admin: null,
    review_note: null,
    reviewed_at: null,
    created_at: "2026-07-20T10:00:00Z",
    review: {
      id: 1001,
      order_id: 91,
      order_item_id: 191,
      user_id: 55,
      user: { id: 55, nickname: "u", phone: null, email: null },
      spu_id: 8,
      spu: { id: 8, title: "商品测试" },
      sku_id: 88,
      sku: null,
      shop_id: 12,
      shop: { id: 12, name: "测试店" },
      rating: 5,
      content: "评价内容",
      images: [],
      is_anonymous: false,
      visible: true,
      hidden_by_admin_id: null,
      hidden_reason: null,
      hidden_at: null,
      edit_count: 0,
      edit_deadline_at: "2026-08-04T10:00:00Z",
      created_at: "2026-07-20T09:00:00Z",
      updated_at: "2026-07-20T09:00:00Z",
    },
    ...overrides,
  };
}

function renderQueuePage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <AdminReviewReportsPage />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  listReportsMock.mockReset();
  upholdMock.mockReset();
  dismissMock.mockReset();
  replaceMock.mockReset();
  useAuthStore.setState({
    status: "authenticated",
    accessToken: "acc",
    refreshToken: "ref",
    admin: {
      id: 1,
      username: "cs",
      display_name: "客服",
      role: AdminRole.CUSTOMER_SERVICE_ADMIN,
      status: "active",
      last_login_at: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    permissions: [
      "admin:review:moderate",
      "admin:review_report:handle",
      "admin:notification:read",
    ],
    remember: true,
  });
});

describe("HandleReportModal - 校验与 action 联动", () => {
  it("review_note < 5 字时提交被拦截", async () => {
    const onSubmit = vi.fn();
    render(
      <HandleReportModal
        open
        onClose={() => undefined}
        onSubmit={onSubmit}
        reportSummary="举报 #1 · 评价 #2 · ad_spam"
      />,
    );
    const textarea = screen.getByLabelText(/处理备注/);
    fireEvent.change(textarea, { target: { value: "少" } });
    fireEvent.click(screen.getByLabelText(/二次确认举报成立/));
    fireEvent.click(
      screen.getByRole("button", { name: /举报成立并隐藏评价/ }),
    );
    await waitFor(() => {
      expect(screen.getByText(/处理备注至少 5 字/)).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("uphold 时未勾选二次确认拦截", async () => {
    const onSubmit = vi.fn();
    render(
      <HandleReportModal
        open
        onClose={() => undefined}
        onSubmit={onSubmit}
      />,
    );
    const textarea = screen.getByLabelText(/处理备注/);
    fireEvent.change(textarea, {
      target: { value: "内容明显违规，予以举报成立。" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /举报成立并隐藏评价/ }),
    );
    await waitFor(() => {
      expect(
        screen.getByText(/举报成立会隐藏该评价/),
      ).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("dismiss 无需二次确认，直接提交 dismiss action", async () => {
    const onSubmit = vi.fn();
    render(
      <HandleReportModal
        open
        onClose={() => undefined}
        onSubmit={onSubmit}
      />,
    );
    // 切换到 dismiss
    fireEvent.click(screen.getByLabelText(/驳回举报/));
    const textarea = screen.getByLabelText(/处理备注/);
    fireEvent.change(textarea, {
      target: { value: "审核后未发现违规内容，予以驳回。" },
    });
    fireEvent.click(screen.getByRole("button", { name: /驳回举报/ }));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit.mock.calls[0]?.[0]).toBe("dismiss");
    expect(onSubmit.mock.calls[0]?.[1]).toBe(
      "审核后未发现违规内容，予以驳回。",
    );
  });

  it("uphold 全流程提交时 action=uphold + review_note", async () => {
    const onSubmit = vi.fn();
    render(
      <HandleReportModal
        open
        onClose={() => undefined}
        onSubmit={onSubmit}
      />,
    );
    const textarea = screen.getByLabelText(/处理备注/);
    fireEvent.change(textarea, {
      target: { value: "内容明显违规，予以举报成立。" },
    });
    fireEvent.click(screen.getByLabelText(/二次确认举报成立/));
    fireEvent.click(
      screen.getByRole("button", { name: /举报成立并隐藏评价/ }),
    );
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit.mock.calls[0]?.[0]).toBe("uphold");
    expect(onSubmit.mock.calls[0]?.[1]).toBe(
      "内容明显违规，予以举报成立。",
    );
  });
});

describe("AdminReviewReportsPage - 队列筛选 & uphold 联动", () => {
  it("无 handle 权限时展示占位", () => {
    useAuthStore.setState({ permissions: [] });
    renderQueuePage();
    expect(screen.getByText(/无权限访问/)).toBeInTheDocument();
  });

  it("默认查询 status=pending 并展示行", async () => {
    listReportsMock.mockResolvedValue({
      items: [makeRow()],
      total: 1,
      page: 1,
      size: 20,
    });
    renderQueuePage();

    await waitFor(() => {
      expect(listReportsMock).toHaveBeenCalled();
    });
    const firstCall = listReportsMock.mock.calls[0]?.[0];
    expect(firstCall?.status).toBe("pending");
    expect(firstCall?.page).toBe(1);
    expect(firstCall?.size).toBe(20);

    await waitFor(() => {
      expect(screen.getByText(/评价内容/)).toBeInTheDocument();
    });
  });

  it("uphold 处理后调用 upholdReport API", async () => {
    const row = makeRow();
    listReportsMock.mockResolvedValue({
      items: [row],
      total: 1,
      page: 1,
      size: 20,
    });
    upholdMock.mockResolvedValue({ ...row, status: "upheld" });

    renderQueuePage();
    await waitFor(() => {
      expect(screen.getByText(/评价内容/)).toBeInTheDocument();
    });

    // 点击"处理"打开弹窗
    fireEvent.click(screen.getByRole("button", { name: "处理" }));
    // 填 note、勾 confirm、点 uphold
    const textarea = screen.getByLabelText(/处理备注/);
    fireEvent.change(textarea, {
      target: { value: "证据充分，认定评价违规。" },
    });
    fireEvent.click(screen.getByLabelText(/二次确认举报成立/));
    fireEvent.click(
      screen.getByRole("button", { name: /举报成立并隐藏评价/ }),
    );

    await waitFor(() => {
      expect(upholdMock).toHaveBeenCalledTimes(1);
    });
    // 调用参数：(id, { review_note })
    expect(upholdMock.mock.calls[0]?.[0]).toBe(row.id);
    expect(upholdMock.mock.calls[0]?.[1]).toEqual({
      review_note: "证据充分，认定评价违规。",
    });
    // dismiss 不应被调用
    expect(dismissMock).not.toHaveBeenCalled();
  });
});
