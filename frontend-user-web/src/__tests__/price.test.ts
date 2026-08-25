import { describe, expect, it } from "vitest";
import { formatYuan } from "@/components/ui/Price";

describe("formatYuan（整数分 → 人民币元）", () => {
  it("整数分转元并带货币符号", () => {
    expect(formatYuan(9900)).toBe("¥99.00");
  });

  it("大金额带千分位分隔", () => {
    expect(formatYuan(799900)).toBe("¥7,999.00");
  });

  it("0 分显示 ¥0.00", () => {
    expect(formatYuan(0)).toBe("¥0.00");
  });

  it("withSymbol=false 时不带货币符号", () => {
    expect(formatYuan(1234, { withSymbol: false })).toBe("12.34");
  });

  it("自定义小数位（同时指定最小与最大）", () => {
    expect(
      formatYuan(1234, { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
    ).toBe("¥12");
  });

  it("负数金额也正确格式化", () => {
    expect(formatYuan(-500)).toBe("¥-5.00");
  });
});
