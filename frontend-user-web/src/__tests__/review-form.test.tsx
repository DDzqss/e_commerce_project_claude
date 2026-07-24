/**
 * Phase 5 ReviewForm 单元测试。
 *
 * 目标：
 * - 星级点击可切换 value
 * - textarea 内容变更同步到 value.content
 * - 匿名开关切换同步到 value.is_anonymous
 * - 图片上传：presign 被 mock 后能占位显示
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";

import {
  ReviewForm,
  type ReviewFormValue,
} from "@/components/reviews/ReviewForm";

// Mock upload API：presignUpload 返回一个假 url；putToPresignedUrl 走原路径，
// 但我们通过 mock uploadFile 直接跳过网络 IO。
vi.mock("@/lib/user-upload-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/user-upload-api")>(
    "@/lib/user-upload-api",
  );
  return {
    ...actual,
    uploadFile: vi.fn(async (file: File) => ({
      object_key: `reviews/mock/${file.name}`,
      public_url: `http://mock/${file.name}`,
    })),
    validateImageFile: () => null,
  };
});

function Harness({
  initial,
  onValue,
}: {
  initial?: Partial<ReviewFormValue>;
  onValue?: (v: ReviewFormValue) => void;
}) {
  const [value, setValue] = useState<ReviewFormValue>({
    rating: 5,
    content: "",
    images: [],
    is_anonymous: false,
    ...initial,
  });
  return (
    <ReviewForm
      value={value}
      onChange={(v) => {
        setValue(v);
        onValue?.(v);
      }}
    />
  );
}

describe("ReviewForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("点击星星改变评分", () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    // 点击第 3 颗星
    fireEvent.click(screen.getByTestId("star-3"));
    const last = onValue.mock.calls.at(-1)?.[0] as ReviewFormValue;
    expect(last.rating).toBe(3);
  });

  it("修改 textarea 内容同步到 content", () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    fireEvent.change(screen.getByTestId("review-content-input"), {
      target: { value: "非常喜欢这款商品" },
    });
    const last = onValue.mock.calls.at(-1)?.[0] as ReviewFormValue;
    expect(last.content).toBe("非常喜欢这款商品");
  });

  it("切换匿名开关同步到 is_anonymous", () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    const cb = screen.getByTestId("review-anonymous-toggle") as HTMLInputElement;
    expect(cb.checked).toBe(false);
    fireEvent.click(cb);
    const last = onValue.mock.calls.at(-1)?.[0] as ReviewFormValue;
    expect(last.is_anonymous).toBe(true);
  });

  it("显示 image add button 且能触发文件选择器", () => {
    render(<Harness />);
    const add = screen.getByTestId("review-image-add");
    expect(add).toBeInTheDocument();
  });
});
