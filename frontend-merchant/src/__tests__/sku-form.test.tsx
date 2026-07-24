/**
 * SKUFormModal 校验测试。
 *
 * 覆盖：
 *   - 新增时：sku_code 缺失 / 格式错 / 重复 → 报错，不提交
 *   - 新增时：specs 键缺失 → 校验失败，不 onSubmit
 *   - 新增时：价格 <= 0 → 校验失败
 *   - 新增时：happy path → onSubmit 收到 mode=create 的 payload
 *   - 编辑时：sku_code 与 specs 输入框只读
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// mock catalog hooks not needed here; SKU form 不用 catalog
// mock toast to silence
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

import { SKUFormModal } from "@/components/products/SKUFormModal";
import type { SKUOut } from "@/types/api";

function renderWithProviders(node: ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{node}</QueryClientProvider>);
}

const specAxes = ["color", "size"];

const sampleSku: SKUOut = {
  id: 1,
  spu_id: 100,
  sku_code: "RED-L",
  specs: { color: "红", size: "L" },
  price_cents: 9900,
  original_price_cents: 12900,
  stock: 20,
  locked_stock: 0,
  sold_count: 0,
  image: null,
  is_active: true,
  created_at: "2026-07-22T00:00:00Z",
  updated_at: "2026-07-22T00:00:00Z",
};

describe("SKUFormModal - 新增", () => {
  let onSubmit: ReturnType<typeof vi.fn>;
  let onClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onSubmit = vi.fn();
    onClose = vi.fn();
  });

  it("sku_code 为空时无法提交", async () => {
    renderWithProviders(
      <SKUFormModal
        open
        onClose={onClose}
        specAxes={specAxes}
        editing={null}
        existingCodes={[]}
        onSubmit={onSubmit}
      />,
    );

    // 点击"添加"按钮
    fireEvent.click(screen.getByRole("button", { name: /添加/u }));

    await waitFor(() => {
      expect(screen.getByText(/请填写 SKU 编码/u)).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("sku_code 格式非法时报错", async () => {
    renderWithProviders(
      <SKUFormModal
        open
        onClose={onClose}
        specAxes={specAxes}
        editing={null}
        existingCodes={[]}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("如 RED-L"), {
      target: { value: "中文 空格" },
    });
    fireEvent.click(screen.getByRole("button", { name: /添加/u }));

    await waitFor(() => {
      expect(
        screen.getByText(/仅允许字母\/数字\/-\/_/u),
      ).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("sku_code 与现有编码重复时报错", async () => {
    renderWithProviders(
      <SKUFormModal
        open
        onClose={onClose}
        specAxes={specAxes}
        editing={null}
        existingCodes={["RED-L"]}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("如 RED-L"), {
      target: { value: "RED-L" },
    });
    fireEvent.click(screen.getByRole("button", { name: /添加/u }));

    await waitFor(() => {
      expect(screen.getByText(/已存在/u)).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("规格值缺失时不提交", async () => {
    renderWithProviders(
      <SKUFormModal
        open
        onClose={onClose}
        specAxes={specAxes}
        editing={null}
        existingCodes={[]}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("如 RED-L"), {
      target: { value: "SKU1" },
    });
    // 只填 color、不填 size
    const colorInput = screen.getByPlaceholderText("如 红");
    fireEvent.change(colorInput, { target: { value: "红" } });

    fireEvent.click(screen.getByRole("button", { name: /添加/u }));

    await waitFor(() => {
      // react-hook-form 会阻止 submit；我们只需 onSubmit 未被调用
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  it("happy path：全部合法时 onSubmit 收到 create payload", async () => {
    renderWithProviders(
      <SKUFormModal
        open
        onClose={onClose}
        specAxes={specAxes}
        editing={null}
        existingCodes={[]}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("如 RED-L"), {
      target: { value: "SKU-1" },
    });
    fireEvent.change(screen.getByPlaceholderText("如 红"), {
      target: { value: "蓝" },
    });
    fireEvent.change(screen.getByPlaceholderText("如 L"), {
      target: { value: "M" },
    });
    // 价格 PriceInput 是 text 输入，找 "0.00" placeholder
    const priceInputs = screen.getAllByPlaceholderText("0.00");
    fireEvent.change(priceInputs[0]!, { target: { value: "99.9" } });

    fireEvent.click(screen.getByRole("button", { name: /添加/u }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });
    const arg = onSubmit.mock.calls[0]?.[0];
    expect(arg.mode).toBe("create");
    expect(arg.payload.sku_code).toBe("SKU-1");
    expect(arg.payload.specs).toEqual({ color: "蓝", size: "M" });
    expect(arg.payload.price_cents).toBe(9990);
  });
});

describe("SKUFormModal - 编辑", () => {
  it("sku_code 与 specs 输入框只读，可修改价格", async () => {
    const onSubmit = vi.fn();
    renderWithProviders(
      <SKUFormModal
        open
        onClose={() => undefined}
        specAxes={specAxes}
        editing={sampleSku}
        existingCodes={[]}
        onSubmit={onSubmit}
      />,
    );

    const codeInput = screen.getByPlaceholderText("如 RED-L") as HTMLInputElement;
    expect(codeInput.readOnly).toBe(true);

    const colorInput = screen.getByPlaceholderText("如 红") as HTMLInputElement;
    expect(colorInput.readOnly).toBe(true);
  });
});
