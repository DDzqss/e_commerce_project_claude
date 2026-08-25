import { beforeEach, describe, expect, it } from "vitest";
import { useCartBadge } from "@/lib/cart-store";

describe("useCartBadge（购物车角标轻状态）", () => {
  beforeEach(() => {
    useCartBadge.getState().reset();
  });

  it("初始角标为 0，无失效商品", () => {
    const s = useCartBadge.getState();
    expect(s.itemCount).toBe(0);
    expect(s.hasInvalid).toBe(false);
  });

  it("sync 同步后端返回的数量与失效标记", () => {
    useCartBadge.getState().sync({ itemCount: 5, hasInvalid: true });
    const s = useCartBadge.getState();
    expect(s.itemCount).toBe(5);
    expect(s.hasInvalid).toBe(true);
  });

  it("bump 正数累加、负数扣减，且扣减不会低于 0", () => {
    useCartBadge.getState().sync({ itemCount: 3, hasInvalid: false });

    useCartBadge.getState().bump(2);
    expect(useCartBadge.getState().itemCount).toBe(5);

    useCartBadge.getState().bump(-10);
    expect(useCartBadge.getState().itemCount).toBe(0);
  });

  it("reset 清空角标与失效标记", () => {
    useCartBadge.getState().sync({ itemCount: 8, hasInvalid: true });
    useCartBadge.getState().reset();

    const s = useCartBadge.getState();
    expect(s.itemCount).toBe(0);
    expect(s.hasInvalid).toBe(false);
  });
});
