"use client";

import { useCurrentMerchant } from "@/hooks/useCurrentMerchant";

/**
 * 在 dashboard layout 中挂载：登录后自动请求 GET /merchant/me
 * 用最新数据覆盖 store 快照（避免 shop 信息滞后）。
 *
 * 该组件不渲染任何 DOM，只是触发 side effect。
 */
export function MerchantMeBoot() {
  useCurrentMerchant();
  return null;
}
