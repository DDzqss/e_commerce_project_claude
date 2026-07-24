/**
 * Phase 5 · 评价域强类型。
 *
 * 严格对齐 docs/API/phase-5-contracts.md §3.1 - §5：
 * - 评价 Review：rating 1-5, content 5-2000, images ≤ 6, 匿名开关
 * - 编辑窗口：15 天 + 1 次
 * - 举报 reason 6+1 分类
 */
import type { ShopBrief } from "./catalog";

/** 商品评价（列表/详情通用）。 */
export interface ReviewReplyOut {
  id: number;
  review_id: number;
  merchant_account_id: number;
  content: string;
  created_at: string;
  updated_at: string;
}

/** 商品与订单快照（评价卡片展示需要）。 */
export interface ReviewSpuBrief {
  id: number;
  title: string;
  main_image: string | null;
}

export interface ReviewSkuBrief {
  id: number;
  specs: Record<string, string>;
  image: string | null;
}

export interface ReviewUserBrief {
  id: number;
  /** 匿名评价：后端应直接返回"匿***名"占位或原昵称。前端也做兼容遮罩。 */
  nickname: string;
  avatar_url: string | null;
}

export interface ReviewOut {
  id: number;
  order_id: number;
  order_item_id: number;
  user_id: number;
  spu_id: number;
  sku_id: number;
  shop_id: number;
  rating: number; // 1..5
  content: string;
  images: string[]; // object_key 数组
  is_anonymous: boolean;
  visible: boolean;
  edit_count: number;
  edit_deadline_at: string;
  created_at: string;
  updated_at: string;

  /** 关联展示字段（后端可选带回，前端友好回退） */
  user?: ReviewUserBrief | null;
  spu?: ReviewSpuBrief | null;
  sku?: ReviewSkuBrief | null;
  shop?: ShopBrief | null;
  reply?: ReviewReplyOut | null;
  /** 是否已被当前登录用户举报（可选） */
  reported_by_me?: boolean;
}

/** 评价分布（1..5 → 数量）。 */
export interface RatingDistribution {
  "1"?: number;
  "2"?: number;
  "3"?: number;
  "4"?: number;
  "5"?: number;
  [k: string]: number | undefined;
}

/** 评价汇总（商品/店铺公开列表附带）。 */
export interface RatingSummary {
  avg: number;
  count: number;
  distribution: RatingDistribution;
}

/** ---------- 举报 ---------- */

export type ReviewReportCategory =
  | "ad_spam"
  | "inappropriate"
  | "fake_review"
  | "offensive"
  | "irrelevant"
  | "other";

export const REVIEW_REPORT_CATEGORY_LIST: ReviewReportCategory[] = [
  "ad_spam",
  "inappropriate",
  "fake_review",
  "offensive",
  "irrelevant",
  "other",
];

export const REVIEW_REPORT_CATEGORY_LABEL: Record<ReviewReportCategory, string> = {
  ad_spam: "广告 / 垃圾信息",
  inappropriate: "内容不当",
  fake_review: "虚假评价",
  offensive: "辱骂 / 攻击性言论",
  irrelevant: "与商品无关",
  other: "其他",
};

export interface ReviewReportPayload {
  reason_category: ReviewReportCategory;
  reason_note?: string;
}

/** ---------- 请求 payload ---------- */

/** 单条评价（发起时 items 数组元素）。 */
export interface CreateReviewItemPayload {
  order_item_id: number;
  rating: number;
  content: string;
  images?: string[];
  is_anonymous?: boolean;
}

/** POST /user/orders/{order_id}/reviews 请求体（批量）。 */
export interface CreateReviewsPayload {
  reviews: CreateReviewItemPayload[];
}

/** POST /user/orders/{order_id}/reviews 响应体。 */
export interface CreateReviewsOut {
  reviews: ReviewOut[];
}

/** PATCH /user/reviews/{id} 请求体。 */
export interface EditReviewPayload {
  rating?: number;
  content?: string;
  images?: string[];
  is_anonymous?: boolean;
}

/** ---------- 列表 query ---------- */

export interface MyReviewsQuery {
  page?: number;
  size?: number;
}

export interface SpuReviewsQuery {
  /** 1..5 单值筛选；空则全部 */
  rating?: number;
  /** 只看有图 */
  with_images?: boolean;
  page?: number;
  size?: number;
}

export interface ShopReviewsQuery {
  page?: number;
  size?: number;
}

/** 公开评价列表附带汇总。 */
export interface PublicReviewList {
  items: ReviewOut[];
  total: number;
  page: number;
  size: number;
  summary: RatingSummary;
}

/** 编辑窗口判断：`edit_count = 0` 且 `now < edit_deadline_at`。 */
export function canEditReview(review: ReviewOut, now: Date = new Date()): boolean {
  if (!review) return false;
  if (review.edit_count > 0) return false;
  if (!review.edit_deadline_at) return false;
  try {
    return now.getTime() < new Date(review.edit_deadline_at).getTime();
  } catch {
    return false;
  }
}

/** 匿名昵称脱敏。后端若已脱敏可直传，前端兜底避免泄漏。 */
export function maskAnonymousNickname(review: ReviewOut): string {
  if (review.is_anonymous) return "匿***名";
  return review.user?.nickname ?? "用户";
}
