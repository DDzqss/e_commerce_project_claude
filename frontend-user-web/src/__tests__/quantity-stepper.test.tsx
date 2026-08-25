import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QuantityStepper } from "@/components/ui/QuantityStepper";

describe("QuantityStepper（数量步进器）", () => {
  it("点击 + 触发 onChange 加一", () => {
    const onChange = vi.fn();
    render(<QuantityStepper value={5} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "增加数量" }));
    expect(onChange).toHaveBeenLastCalledWith(6);
  });

  it("点击 - 触发 onChange 减一", () => {
    const onChange = vi.fn();
    render(<QuantityStepper value={5} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "减少数量" }));
    expect(onChange).toHaveBeenLastCalledWith(4);
  });

  it("已在 min 时 - 按钮禁用", () => {
    render(<QuantityStepper value={1} min={1} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "减少数量" })).toBeDisabled();
  });

  it("已在 max 时 + 按钮禁用", () => {
    render(<QuantityStepper value={999} max={999} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: "增加数量" })).toBeDisabled();
  });

  it("输入越界值后 blur 回落到边界并同步显示", () => {
    const onChange = vi.fn();
    render(
      <QuantityStepper value={999} min={1} max={999} onChange={onChange} />,
    );
    const input = screen.getByRole("spinbutton") as HTMLInputElement;

    // 已在 max 时继续输入越界数字
    fireEvent.change(input, { target: { value: "9999" } });
    fireEvent.blur(input);

    expect(input.value).toBe("999");
    expect(onChange).not.toHaveBeenCalledWith(9999);
  });

  it("方向键上下增减数量", () => {
    const onChange = vi.fn();
    render(<QuantityStepper value={5} onChange={onChange} />);
    const input = screen.getByRole("spinbutton");

    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(onChange).toHaveBeenLastCalledWith(6);

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(onChange).toHaveBeenLastCalledWith(4);
  });

  it("暴露 spinbutton 无障碍语义", () => {
    render(<QuantityStepper value={5} min={1} max={999} onChange={() => {}} />);
    const input = screen.getByRole("spinbutton");

    expect(input).toHaveAttribute("aria-valuemin", "1");
    expect(input).toHaveAttribute("aria-valuemax", "999");
    expect(input).toHaveAttribute("aria-valuenow", "5");
  });
});
