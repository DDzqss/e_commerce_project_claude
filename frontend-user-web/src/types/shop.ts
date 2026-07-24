/**
 * Phase 5 · 店铺主页类型。
 *
 * 严格对齐 docs/API/phase-5-contracts.md §3.7 / §9.1。
 */

export interface ShopHomepage {
  id: number;
  name: string;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  announcement: string | null;
  opened_at: string | null;
  rating_avg: number;
  rating_count: number;
  sales_count: number;
  contact_name: string | null;
  /** 已脱敏 */
  contact_phone: string | null;
  status: string;
}
