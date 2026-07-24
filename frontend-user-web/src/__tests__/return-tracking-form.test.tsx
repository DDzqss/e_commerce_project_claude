import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import {
  ReturnTrackingForm,
  carrierLabel,
  validateTrackingNo,
} from "@/components/aftersales/ReturnTrackingForm";

describe("validateTrackingNo", () => {
  it("空返回错误", () => {
    expect(validateTrackingNo("")).toBeTruthy();
    expect(validateTrackingNo("   ")).toBeTruthy();
  });

  it("过短返回错误", () => {
    expect(validateTrackingNo("SF123")).toBeTruthy();
  });

  it("合法通过", () => {
    expect(validateTrackingNo("SF1234567890")).toBeNull();
    expect(validateTrackingNo("YT-1234567890")).toBeNull();
  });

  it("含非法字符报错", () => {
    expect(validateTrackingNo("中文单号12345")).toBeTruthy();
  });
});

describe("carrierLabel", () => {
  it("已知 code → 中文", () => {
    expect(carrierLabel("SF")).toBe("顺丰速运");
    expect(carrierLabel("JD")).toBe("京东物流");
  });
  it("空 → 短横线", () => {
    expect(carrierLabel(null)).toBe("-");
    expect(carrierLabel(undefined)).toBe("-");
  });
  it("未知 code → 原样", () => {
    expect(carrierLabel("UNKNOWN")).toBe("UNKNOWN");
  });
});

describe("ReturnTrackingForm", () => {
  it("未选快递提交 → 报错", () => {
    const onSubmit = vi.fn();
    render(<ReturnTrackingForm onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: /提交/ }));
    const alerts = screen.getAllByRole("alert");
    expect(
      alerts.some((el) => /请选择快递公司/.test(el.textContent ?? "")),
    ).toBe(true);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("单号格式无效 → 报错，不 submit", () => {
    const onSubmit = vi.fn();
    render(<ReturnTrackingForm onSubmit={onSubmit} />);
    fireEvent.change(screen.getByTestId("return-carrier"), {
      target: { value: "SF" },
    });
    fireEvent.change(screen.getByTestId("return-tracking-no"), {
      target: { value: "123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /提交/ }));
    expect(screen.getByText(/8-40 位/)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("合法输入 → 调用 onSubmit", () => {
    const onSubmit = vi.fn();
    render(<ReturnTrackingForm onSubmit={onSubmit} />);
    fireEvent.change(screen.getByTestId("return-carrier"), {
      target: { value: "SF" },
    });
    fireEvent.change(screen.getByTestId("return-tracking-no"), {
      target: { value: "SF1234567890" },
    });
    fireEvent.click(screen.getByRole("button", { name: /提交/ }));
    expect(onSubmit).toHaveBeenCalledWith("SF", "SF1234567890");
  });
});
