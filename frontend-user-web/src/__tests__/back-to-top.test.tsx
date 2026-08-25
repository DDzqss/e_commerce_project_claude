import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { BackToTop } from "@/components/ui/BackToTop";

function setScrollY(value: number) {
  Object.defineProperty(window, "scrollY", {
    value,
    writable: true,
    configurable: true,
  });
}

describe("BackToTop（回到顶部）", () => {
  beforeEach(() => {
    setScrollY(0);
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("未滚动时按钮不显示", () => {
    render(<BackToTop />);
    expect(
      screen.queryByRole("button", { name: "回到顶部" }),
    ).not.toBeInTheDocument();
  });

  it("滚动超过阈值后显示按钮", () => {
    render(<BackToTop threshold={400} />);
    setScrollY(500);
    fireEvent.scroll(window);
    expect(
      screen.getByRole("button", { name: "回到顶部" }),
    ).toBeInTheDocument();
  });

  it("点击按钮调用 scrollTo 平滑回到顶部", () => {
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    render(<BackToTop threshold={400} />);
    setScrollY(500);
    fireEvent.scroll(window);
    fireEvent.click(screen.getByRole("button", { name: "回到顶部" }));
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });
});
