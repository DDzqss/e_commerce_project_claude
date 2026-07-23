import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SKUSelector } from "@/components/catalog/SKUSelector";
import type { SKUOut } from "@/types/catalog";

/**
 * 数据集：spec_axes = ["color","size"]
 *   红-L / 红-M （XL 不存在）
 *   蓝-L / 蓝-XL
 * 期望：
 *   - 未选任何项：所有按钮可点
 *   - 选 "红" → size 面板 XL 应禁用（红没有 XL）
 *   - 选 "蓝" → size 面板 M 应禁用（蓝没有 M）
 *   - 选 "红" + "L" → 触发 onChange，回调命中对应 SKU
 *   - 再点一次 "红" 取消选中 → 回调 null
 */

function skusFixture(overrides: Partial<SKUOut>[] = []): SKUOut[] {
  const base = (
    id: number,
    color: string,
    size: string,
    extra?: Partial<SKUOut>,
  ): SKUOut => ({
    id,
    sku_code: `${color}-${size}`,
    specs: { color, size },
    price_cents: 10000,
    original_price_cents: null,
    stock: 10,
    image: null,
    is_active: true,
    ...extra,
  });
  const arr = [
    base(1, "红", "L"),
    base(2, "红", "M"),
    base(3, "蓝", "L"),
    base(4, "蓝", "XL"),
  ];
  // 应用 override（按 index 合并；否则允许调用方直接传对象）
  overrides.forEach((o, i) => {
    if (arr[i]) arr[i] = { ...arr[i]!, ...o };
  });
  return arr;
}

describe("SKUSelector", () => {
  it("按 spec_axes 渲染出对应组，选项数量正确", () => {
    render(
      <SKUSelector
        specAxes={["color", "size"]}
        skus={skusFixture()}
      />,
    );
    expect(screen.getByTestId("sku-option-color-红")).toBeInTheDocument();
    expect(screen.getByTestId("sku-option-color-蓝")).toBeInTheDocument();
    expect(screen.getByTestId("sku-option-size-L")).toBeInTheDocument();
    expect(screen.getByTestId("sku-option-size-M")).toBeInTheDocument();
    expect(screen.getByTestId("sku-option-size-XL")).toBeInTheDocument();
  });

  it("选中 '红' 后 size=XL 被禁用（联动禁用）", async () => {
    const user = userEvent.setup();
    render(
      <SKUSelector
        specAxes={["color", "size"]}
        skus={skusFixture()}
      />,
    );

    // 初始态：XL 可点
    const xl = screen.getByTestId("sku-option-size-XL");
    expect(xl).not.toBeDisabled();

    await user.click(screen.getByTestId("sku-option-color-红"));

    expect(screen.getByTestId("sku-option-size-XL")).toBeDisabled();
    expect(screen.getByTestId("sku-option-size-L")).not.toBeDisabled();
    expect(screen.getByTestId("sku-option-size-M")).not.toBeDisabled();
  });

  it("选中 '蓝' 后 size=M 被禁用", async () => {
    const user = userEvent.setup();
    render(
      <SKUSelector
        specAxes={["color", "size"]}
        skus={skusFixture()}
      />,
    );

    await user.click(screen.getByTestId("sku-option-color-蓝"));

    expect(screen.getByTestId("sku-option-size-M")).toBeDisabled();
    expect(screen.getByTestId("sku-option-size-XL")).not.toBeDisabled();
    expect(screen.getByTestId("sku-option-size-L")).not.toBeDisabled();
  });

  it("选完两个轴 → onChange 抛出命中的 SKU", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SKUSelector
        specAxes={["color", "size"]}
        skus={skusFixture()}
        onChange={onChange}
      />,
    );

    // 未选完前应回调 null
    expect(onChange).toHaveBeenCalledWith(null);
    onChange.mockClear();

    await user.click(screen.getByTestId("sku-option-color-红"));
    await user.click(screen.getByTestId("sku-option-size-L"));

    // 最后一次回调应给出 红-L 那个 SKU
    const last = onChange.mock.calls.at(-1)?.[0] as SKUOut | null;
    expect(last).not.toBeNull();
    expect(last?.specs).toEqual({ color: "红", size: "L" });
  });

  it("再次点击同一选项 → 取消选中，onChange 回退 null", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SKUSelector
        specAxes={["color", "size"]}
        skus={skusFixture()}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByTestId("sku-option-color-红"));
    await user.click(screen.getByTestId("sku-option-size-L"));
    onChange.mockClear();
    await user.click(screen.getByTestId("sku-option-size-L"));

    const last = onChange.mock.calls.at(-1)?.[0] as SKUOut | null;
    expect(last).toBeNull();
  });

  it("SKU is_active=false 或 stock=0 不参与联动计算", async () => {
    const user = userEvent.setup();
    // 把 蓝-XL 设为 stock=0；同时把 红-M 设为 is_active=false
    const skus = skusFixture([
      {}, // 红-L 保持
      { is_active: false }, // 红-M 禁用
      {}, // 蓝-L 保持
      { stock: 0 }, // 蓝-XL 无库存
    ]);

    render(<SKUSelector specAxes={["color", "size"]} skus={skus} />);

    // 选 "红" → 只有 L 可点（M 禁用）
    await user.click(screen.getByTestId("sku-option-color-红"));
    expect(screen.getByTestId("sku-option-size-M")).toBeDisabled();
    expect(screen.getByTestId("sku-option-size-L")).not.toBeDisabled();

    // 选 "蓝" → 只有 L 可点（XL 无库存）
    await user.click(screen.getByTestId("sku-option-color-红")); // 取消 红
    await user.click(screen.getByTestId("sku-option-color-蓝"));
    expect(screen.getByTestId("sku-option-size-XL")).toBeDisabled();
    expect(screen.getByTestId("sku-option-size-L")).not.toBeDisabled();
  });
});
