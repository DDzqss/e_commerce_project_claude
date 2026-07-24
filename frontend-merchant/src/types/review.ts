/**
 * Phase 5 · 评价域类型定义（商家侧视角）。
 *
 * 严格对齐 docs/API/phase-5-contracts.md §3.1 / §3.2 / §4 / §5。
 * 命名保持后端 snake_case；避免手工映射错位。
 *
 * 商家端只需要「读取本店评价 + 就地回复（创建 / 修改 / 删除）」——
 * 因此不定义评价创建 / 编辑 / 删除 / 举报相关 payload（那些属于 user 端）。
 */

// ---------- 评价（Review） --------------------------------------------------

/**
 * 单条评价对象（商家端查看）。
 * 字段来自 review 表 + 后端聚合的商品 / 用户展示信息。
 */
export interface MerchantReviewOut {
  id: number;
  order_id: number;
  order_no: string;
  order_item_id: number;
  user_id: number;
  /** 展示昵称；匿名评价后端已脱敏为「匿***名」。 */
  user_display_name: string;
  spu_id: number;
  sku_id: number;
  shop_id: number;
  /** 商品标题快照，避免联查 SPU。 */
  spu_title: string;
  /** SKU 规格摘要（如「颜色：红/尺寸：M」）。 */
  sku_specs: Record<string, string> | null;
  /** SKU 图片 object_key（可能为空）。 */
  sku_image: string | null;
  rating: number;
  content: string;
  /** MinIO object_key 数组，最多 6 张。 */
  images: string[];
  is_anonymous: boolean;
  /** 是否已被平台隐藏（商家可见但会打灰）。 */
  visible: boolean;
  hidden_reason: string | null;
  edit_count: number;
  edit_deadline_at: string;
  created_at: string;
  updated_at: string;
  /** 内联的商家回复（若已回复）。 */
  reply: MerchantReviewReplyOut | null;
}

/** 商家回复对象（评价内联）。 */
export interface MerchantReviewReplyOut {
  id: number;
  review_id: number;
  merchant_account_id: number;
  shop_id: number;
  content: string;
  created_at: string;
  updated_at: string;
}

// ---------- 评价列表查询 ----------------------------------------------------

/**
 * `GET /api/v1/merchant/reviews` 查询参数。
 * - rating 精确单值筛选（1-5）
 * - has_reply=false 只看未回复；true 只看已回复；unset 全部
 * - keyword 匹配评价内容 / 商品标题（后端实现自定）
 */
export interface MerchantReviewListQuery {
  rating?: number;
  has_reply?: boolean;
  keyword?: string;
  page?: number;
  size?: number;
}

// ---------- 评价回复 payload -------------------------------------------------

/** `POST /api/v1/merchant/reviews/{id}/reply` */
export interface CreateReplyPayload {
  /** 5-500 字。 */
  content: string;
}

/** `PATCH /api/v1/merchant/reviews/{id}/reply` */
export interface UpdateReplyPayload {
  content: string;
}

// ---------- 评价统计（商家看板） --------------------------------------------

/**
 * 评价看板 stats。
 *
 * Phase 5 契约未显式定义 merchant 端 stats 端点，
 * 但 §4.4 / §5.3 支持按 rating / has_reply 筛选；前端可以：
 *   - 直接调 `GET /merchant/reviews?has_reply=false&size=1` 获取 total（未回复数）
 *   - 直接调 `GET /merchant/reviews?rating=<n>&size=1` 获取 total（各星级数）
 *   - shop.rating_avg / rating_count 从 `GET /merchant/me`.shop 拿
 *
 * 为避免 N+1 请求，前端封装了 `useMerchantReviewStats` hook
 * 通过一次拉取 100 条最新评价在本地聚合基础指标（够 dashboard 用）。
 */
export interface MerchantReviewStats {
  total_count: number;
  unreplied_count: number;
  avg_rating: number;
  /** 差评（≤ 3 星）数量。 */
  low_rating_count: number;
  /** 各星级分布：`{5: 40, 4: 20, ...}` */
  rating_distribution: Record<number, number>;
}
