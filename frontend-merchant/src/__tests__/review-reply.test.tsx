/**
 * ReviewCard / ReplyEditor 交互测试。
 *
 * 覆盖：
 *   - 未回复评价 → 展示输入框
 *   - 内容 < 5 字 → 报错，不调 API
 *   - happy path 新建回复 → 调 createReply(reviewId, { content })
 *   - 已有回复 → 展示回复内容 + 编辑/删除按钮；编辑保存调 updateReply
 *   - SHOP_SUPPORT 只读 → 无输入框
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

// window.confirm auto-true for delete flow
beforeEach(() => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

import { ReviewCard } from "@/components/reviews/ReviewCard";
import type { MerchantReviewOut } from "@/types/review";

function renderWithProviders(node: ReactNode) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={qc}>{node}</QueryClientProvider>);
}

const baseReview: MerchantReviewOut = {
  id: 501,
  order_id: 9001,
  order_no: "202607230000009001",
  order_item_id: 12001,
  user_id: 42,
  user_display_name: "买家小张",
  spu_id: 1,
  sku_id: 100,
  shop_id: 1,
  spu_title: "夏日 T 恤 · 舒适棉质",
  sku_specs: { color: "白", size: "L" },
  sku_image: null,
  rating: 4,
  content: "整体不错，穿着舒适。",
  images: [],
  is_anonymous: false,
  visible: true,
  hidden_reason: null,
  edit_count: 0,
  edit_deadline_at: "2026-08-06T00:00:00Z",
  created_at: "2026-07-22T10:00:00Z",
  updated_at: "2026-07-22T10:00:00Z",
  reply: null,
};

describe("ReviewCard - 未回复 + 可写角色", () => {
  it("展示评价内容与商品信息", () => {
    const onCreateReply = vi.fn().mockResolvedValue(undefined);
    const onUpdateReply = vi.fn();
    const onDeleteReply = vi.fn();
    renderWithProviders(
      <ReviewCard
        review={baseReview}
        onCreateReply={onCreateReply}
        onUpdateReply={onUpdateReply}
        onDeleteReply={onDeleteReply}
        canReply
      />,
    );
    expect(screen.getByText("买家小张")).toBeInTheDocument();
    expect(screen.getByText("整体不错，穿着舒适。")).toBeInTheDocument();
    expect(screen.getByText(/夏日 T 恤/)).toBeInTheDocument();
    // 展开的回复输入框
    expect(screen.getByPlaceholderText(/用简明专业的语言回应用户/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "发布回复" })).toBeInTheDocument();
  });

  it("内容不足 5 字 → 阻止提交，onCreateReply 不被调用", async () => {
    const onCreateReply = vi.fn().mockResolvedValue(undefined);
    const onUpdateReply = vi.fn();
    const onDeleteReply = vi.fn();
    renderWithProviders(
      <ReviewCard
        review={baseReview}
        onCreateReply={onCreateReply}
        onUpdateReply={onUpdateReply}
        onDeleteReply={onDeleteReply}
        canReply
      />,
    );
    const textarea = screen.getByPlaceholderText(
      /用简明专业的语言回应用户/,
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "谢啦" } });
    fireEvent.click(screen.getByRole("button", { name: "发布回复" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/不少于 5 字/);
    });
    expect(onCreateReply).not.toHaveBeenCalled();
  });

  it("happy path：合法内容 → onCreateReply(reviewId, content)", async () => {
    const onCreateReply = vi.fn().mockResolvedValue(undefined);
    const onUpdateReply = vi.fn();
    const onDeleteReply = vi.fn();
    renderWithProviders(
      <ReviewCard
        review={baseReview}
        onCreateReply={onCreateReply}
        onUpdateReply={onUpdateReply}
        onDeleteReply={onDeleteReply}
        canReply
      />,
    );
    const textarea = screen.getByPlaceholderText(
      /用简明专业的语言回应用户/,
    );
    fireEvent.change(textarea, {
      target: { value: "感谢您的支持，欢迎再次光临！" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发布回复" }));

    await waitFor(() => {
      expect(onCreateReply).toHaveBeenCalledWith(
        501,
        "感谢您的支持，欢迎再次光临！",
      );
    });
  });
});

describe("ReviewCard - 已回复 + 编辑/删除", () => {
  const withReply: MerchantReviewOut = {
    ...baseReview,
    reply: {
      id: 71,
      review_id: 501,
      merchant_account_id: 9,
      shop_id: 1,
      content: "感谢惠顾，欢迎复购！",
      created_at: "2026-07-22T11:00:00Z",
      updated_at: "2026-07-22T11:00:00Z",
    },
  };

  it("视图态：显示回复内容 + 编辑/删除按钮", () => {
    renderWithProviders(
      <ReviewCard
        review={withReply}
        onCreateReply={vi.fn()}
        onUpdateReply={vi.fn()}
        onDeleteReply={vi.fn()}
        canReply
      />,
    );
    expect(screen.getByText("感谢惠顾，欢迎复购！")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "编辑" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "删除" })).toBeInTheDocument();
  });

  it("编辑 → 保存 → onUpdateReply(id, content)", async () => {
    const onUpdateReply = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <ReviewCard
        review={withReply}
        onCreateReply={vi.fn()}
        onUpdateReply={onUpdateReply}
        onDeleteReply={vi.fn()}
        canReply
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "编辑" }));
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(textarea, {
      target: { value: "已答复，欢迎下次光临。" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => {
      expect(onUpdateReply).toHaveBeenCalledWith(
        501,
        "已答复，欢迎下次光临。",
      );
    });
  });

  it("删除 → onDeleteReply(id)", async () => {
    const onDeleteReply = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <ReviewCard
        review={withReply}
        onCreateReply={vi.fn()}
        onUpdateReply={vi.fn()}
        onDeleteReply={onDeleteReply}
        canReply
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "删除" }));
    await waitFor(() => {
      expect(onDeleteReply).toHaveBeenCalledWith(501);
    });
  });
});

describe("ReviewCard - SHOP_SUPPORT 只读", () => {
  it("canReply=false 时未回复评价不展示输入框", () => {
    renderWithProviders(
      <ReviewCard
        review={baseReview}
        onCreateReply={vi.fn()}
        onUpdateReply={vi.fn()}
        onDeleteReply={vi.fn()}
        canReply={false}
      />,
    );
    expect(
      screen.queryByPlaceholderText(/用简明专业的语言回应用户/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "发布回复" }),
    ).not.toBeInTheDocument();
  });
});
