/**
 * 购物车"轻状态" Store。
 *
 * 定位：**头部红点缓存 + 快速本地读取**，非权威数据。
 * - 主源：后端 GET /user/cart（通过 React Query）
 * - 页面拉到数据后 sync 头部条目数到本 store，SiteHeader 订阅红点即可
 * - 用户"加入购物车"后可先乐观 ++，随后 invalidate 让 React Query 兜底
 *
 * 之所以不做完整购物车镜像：避免"两份真源"漂移。React Query 已经解决了缓存/失效问题，
 * 这里只做一个极简的"角标 badge count"存储，让 SiteHeader 无需订阅整个 cart 数据。
 */

import { create } from "zustand";

interface CartBadgeState {
  /** 全部购物车 items 的数量（不管 selected），用作头部红点。 */
  itemCount: number;
  hasInvalid: boolean;
  /** 从后端返回同步。 */
  sync: (payload: { itemCount: number; hasInvalid: boolean }) => void;
  /** 本地乐观 +N；返回值为 sync 之后的值。 */
  bump: (delta: number) => void;
  /** 清零（登出时）。 */
  reset: () => void;
}

export const useCartBadge = create<CartBadgeState>((set) => ({
  itemCount: 0,
  hasInvalid: false,
  sync: ({ itemCount, hasInvalid }) => set({ itemCount, hasInvalid }),
  bump: (delta) =>
    set((s) => ({ itemCount: Math.max(0, s.itemCount + delta) })),
  reset: () => set({ itemCount: 0, hasInvalid: false }),
}));
