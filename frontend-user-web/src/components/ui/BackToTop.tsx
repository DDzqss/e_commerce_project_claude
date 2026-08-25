"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

/** 页面滚动超过该距离（px）后显示按钮，默认 400。 */
const DEFAULT_THRESHOLD = 400;

export interface BackToTopProps {
  /** 显示阈值（px），滚动距离超过该值时显示按钮。 */
  threshold?: number;
  className?: string;
}

/**
 * 「回到顶部」悬浮按钮。
 *
 * - 页面滚动超过阈值后，在右下角浮现一个圆形按钮
 * - 点击后平滑滚动回页面顶部
 * - 使用 passive 滚动监听，避免影响页面滚动性能
 *
 * 挂在根布局中，全站可用，适合商品列表、订单列表等长页面。
 */
export function BackToTop({
  threshold = DEFAULT_THRESHOLD,
  className,
}: BackToTopProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > threshold);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  if (!visible) return null;

  return (
    <button
      type="button"
      aria-label="回到顶部"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={cn(
        "fixed bottom-6 right-6 z-50 flex h-10 w-10 items-center justify-center",
        "rounded-full border border-neutral-200 bg-white text-neutral-600 shadow-md",
        "transition hover:bg-neutral-100 focus-visible:outline-2",
        "focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-primary)]",
        className,
      )}
    >
      <svg
        className="h-5 w-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 19V5" />
        <path d="M5 12l7-7 7 7" />
      </svg>
    </button>
  );
}
