/**
 * ResolveModal 单元测试。
 *
 * 关键覆盖：
 * - outcome=side_with_merchant 时隐藏 actual_refund_cents 输入框
 * - outcome=side_with_user / partial_refund 时显示金额输入框
 * - conclusion < 20 字校验
 * - partial_refund 金额需严格小于用户申请值
 * - 未勾选二次确认时校验拦截
 * - 提交成功时 payload 结构正确
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { ResolveModal } from "@/components/aftersales/ResolveModal";
import type { ResolveArbitrationPayload } from "@/types/aftersales";

function setup(overrides?: Partial<Parameters<typeof ResolveModal>[0]>) {
  const onClose = vi.fn();
  const onSubmit = vi.fn();
  const props = {
    open: true,
    onClose,
    onSubmit,
    submitting: false,
    refundAmountCents: 39600, // ¥396.00
    aftersalesNo: "AS202607230000001234",
    ...overrides,
  };
  const utils = render(<ResolveModal {...props} />);
  return { onSubmit, onClose, ...utils };
}

describe("ResolveModal - outcome radio 联动金额输入", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("默认 outcome=side_with_user，金额输入可见并预填全额", () => {
    setup();
    // 金额输入应该可见，预填 396.00
    const amountInput = screen.getByLabelText(/退款金额（元）/i);
    expect(amountInput).toBeInTheDocument();
    expect((amountInput as HTMLInputElement).value).toBe("396.00");
  });

  it("切到 side_with_merchant 时金额输入被隐藏", () => {
    setup();
    // 点击"支持商家 · 驳回申请"
    const merchantRadio = screen.getByRole("radio", {
      name: /支持商家/i,
    });
    fireEvent.click(merchantRadio);
    // 金额输入框应该消失
    expect(
      screen.queryByLabelText(/退款金额（元）/i),
    ).not.toBeInTheDocument();
    // 出现提示文案
    expect(
      screen.getByText(/无退款；售后单将转为「系统已关闭」/),
    ).toBeInTheDocument();
  });

  it("切到 partial_refund 时金额输入仍可见但需严格小于用户申请值", async () => {
    const { onSubmit } = setup();
    // 切到部分退款
    fireEvent.click(screen.getByRole("radio", { name: /部分退款/i }));
    // aria-label 固定为 "退款金额（元）"，UI 标签会变但可访问名保持一致
    const amountInput = screen.getByLabelText(
      /退款金额（元）/i,
    ) as HTMLInputElement;
    expect(amountInput).toBeInTheDocument();
    // FormField 上方文案切换为"部分退款金额"
    expect(
      screen.getByText(/部分退款金额（元）/),
    ).toBeInTheDocument();

    // 填入等于用户申请值 → 应校验失败
    fireEvent.change(amountInput, { target: { value: "396.00" } });
    // 填结论 ≥ 20 字
    const textarea = screen.getByPlaceholderText(/经审阅证据/i);
    fireEvent.change(textarea, {
      target: {
        value: "经过审阅证据发现商家部分责任，仲裁给予部分退款。",
      },
    });
    // 勾选确认
    fireEvent.click(screen.getByRole("checkbox"));
    // 点确认裁决
    fireEvent.click(screen.getByRole("button", { name: /确认裁决/i }));

    // 应展示"金额需小于用户申请值"错误
    await waitFor(() => {
      expect(
        screen.getByText(
          /「部分退款」金额需小于用户申请值/,
        ),
      ).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("conclusion < 20 字时提交被拦截", async () => {
    const { onSubmit } = setup();
    const textarea = screen.getByPlaceholderText(/经审阅证据/i);
    fireEvent.change(textarea, { target: { value: "太短" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /确认裁决/i }));
    await waitFor(() => {
      expect(
        screen.getByText(/仲裁结论需 ≥ 20 字/),
      ).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("未勾选二次确认时提交被拦截", async () => {
    const { onSubmit } = setup();
    const textarea = screen.getByPlaceholderText(/经审阅证据/i);
    fireEvent.change(textarea, {
      target: {
        value: "证据链完整、责任划分清晰、支持用户全额退款处理。",
      },
    });
    // 不勾选 checkbox
    fireEvent.click(screen.getByRole("button", { name: /确认裁决/i }));
    await waitFor(() => {
      expect(screen.getByText(/请勾选二次确认/)).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("side_with_user 全流程提交成功时 payload 正确", async () => {
    const { onSubmit } = setup();
    const textarea = screen.getByPlaceholderText(/经审阅证据/i);
    fireEvent.change(textarea, {
      target: {
        value: "证据链完整、责任划分清晰、支持用户全额退款处理。",
      },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /确认裁决/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    const payload = onSubmit.mock.calls[0]?.[0] as ResolveArbitrationPayload;
    expect(payload.outcome).toBe("side_with_user");
    expect(payload.actual_refund_cents).toBe(39600);
    expect(payload.conclusion.length).toBeGreaterThanOrEqual(20);
  });

  it("side_with_merchant 提交时不带 actual_refund_cents 字段", async () => {
    const { onSubmit } = setup();
    fireEvent.click(screen.getByRole("radio", { name: /支持商家/i }));
    const textarea = screen.getByPlaceholderText(/经审阅证据/i);
    fireEvent.change(textarea, {
      target: {
        value: "证据显示商家处理无误，用户诉求缺乏证据支持，予以驳回。",
      },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /确认裁决/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    const payload = onSubmit.mock.calls[0]?.[0] as ResolveArbitrationPayload;
    expect(payload.outcome).toBe("side_with_merchant");
    expect(payload.actual_refund_cents).toBeUndefined();
  });
});
