/**
 * Phase 5 商品评价 / 举报 相关类型（Admin 视角）。
 *
 * 与 docs/API/phase-5-contracts.md §3.1 / §3.2 / §3.3 / §5 严格对齐：
 * - §3.1 Review 数据模型（含 visible / hidden_* / edit_count / edit_deadline_at）
 * - §3.2 ReviewReply 数据模型
 * - §3.3 ReviewReport 数据模型
 * - §5.4 Admin 评价审核端点
 * - §5.5 Admin 举报队列端点
 *
 * 命名约定：字段全部 snake_case，与后端 JSON 一致。
 */

// ---------------------------------------------------------------------------
// 关联摘要
// ---------------------------------------------------------------------------

/**
 * 用户摘要（列表 join 展示）。
 * Admin 端有权看用户手机 / 邮箱明文（业务需要），不做脱敏。
 */
export interface ReviewUserBrief {
  id: number;
  nickname: string | null;
  phone: string | null;
  email: string | null;
}

/** 店铺摘要（列表 join 展示）。 */
export interface ReviewShopBrief {
  id: number;
  name: string;
}

/** SPU / SKU 摘要（列表 join 展示）。 */
export interface ReviewSpuBrief {
  id: number;
  title: string;
  main_image?: string | null;
}

export interface ReviewSkuBrief {
  id: number;
  specs?: Record<string, string> | null;
  image?: string | null;
}

/** 关联订单摘要（详情页跳转用）。 */
export interface ReviewOrderBrief {
  id: number;
  order_no: string;
  status?: string;
}

// ---------------------------------------------------------------------------
// 评价回复（Merchant reply）
// ---------------------------------------------------------------------------

/**
 * 商家对评价的回复。契约 §3.2。
 * 一条评价至多一条回复；Admin 视角只读展示。
 */
export interface ReviewReplyOut {
  id: number;
  review_id: number;
  merchant_account_id: number;
  shop_id: number;
  content: string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Review 列表 & 详情
// ---------------------------------------------------------------------------

/**
 * Admin 评价列表元素（契约 §5.4 GET /admin/reviews）。
 * 只挑列表 UI 需要的字段；完整字段见 Detail。
 */
export interface AdminReviewListItem {
  id: number;
  order_id: number;
  order_item_id: number;
  user_id: number;
  user?: ReviewUserBrief | null;
  spu_id: number;
  spu?: ReviewSpuBrief | null;
  sku_id: number;
  sku?: ReviewSkuBrief | null;
  shop_id: number;
  shop?: ReviewShopBrief | null;
  rating: number; // 1..5
  content: string;
  images: readonly string[]; // object_key 列表
  is_anonymous: boolean;
  visible: boolean;
  hidden_by_admin_id: number | null;
  hidden_reason: string | null;
  hidden_at: string | null;
  /** 编辑次数（Phase 5 上限 1） */
  edit_count: number;
  /** created_at + 15 day */
  edit_deadline_at: string;
  /** 有 merchant reply 时列表也可能返回（false 表示无） */
  has_reply?: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Admin 评价详情（契约 §5.4 GET /admin/reviews/{id}）。
 * 含 order 摘要 + reply（若有）。
 */
export interface AdminReviewDetail extends AdminReviewListItem {
  order?: ReviewOrderBrief | null;
  reply?: ReviewReplyOut | null;
}

// ---------------------------------------------------------------------------
// Review 操作 Payload
// ---------------------------------------------------------------------------

/**
 * POST /admin/reviews/{id}/hide 请求体（契约 §5.4）。
 *
 * 前端校验：
 * - hidden_reason ≥ 5 字（前端强校验）
 */
export interface HideReviewPayload {
  hidden_reason: string;
}

/**
 * POST /admin/reviews/{id}/restore 请求体（契约 §5.4）。
 * 恢复隐藏无需附带原因；后端会清空 hidden_* 字段。
 */
export type RestoreReviewPayload = Record<string, never>;

// ---------------------------------------------------------------------------
// Review Report 列表 & 详情
// ---------------------------------------------------------------------------

/**
 * 举报原因分类（契约 §3.3）。
 * - ad_spam       广告刷屏
 * - inappropriate 不当内容
 * - fake_review   虚假评价
 * - offensive     辱骂 / 攻击
 * - irrelevant    与商品无关
 * - other         其他
 */
export type ReviewReportReasonCategory =
  | "ad_spam"
  | "inappropriate"
  | "fake_review"
  | "offensive"
  | "irrelevant"
  | "other";

/**
 * 举报状态（契约 §3.3）。
 */
export type ReviewReportStatus = "pending" | "upheld" | "dismissed";

/** 处理者摘要（详情/列表 join 展示）。 */
export interface ReviewReportReviewerBrief {
  id: number;
  username: string;
  display_name?: string | null;
}

/**
 * 举报列表元素（契约 §5.5 GET /admin/review-reports）。
 *
 * 后端可选返回关联评价快照 `review`，便于列表内直接预览"举报了什么"。
 */
export interface AdminReviewReportListItem {
  id: number;
  review_id: number;
  reporter_user_id: number;
  reporter?: ReviewUserBrief | null;
  reason_category: ReviewReportReasonCategory;
  reason_note: string | null;
  status: ReviewReportStatus;
  reviewer_admin_id: number | null;
  reviewer_admin?: ReviewReportReviewerBrief | null;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  /** 联合评价快照（后端可选返回，前端做预览） */
  review?: AdminReviewListItem | null;
}

// ---------------------------------------------------------------------------
// Review Report 操作 Payload
// ---------------------------------------------------------------------------

/**
 * POST /admin/review-reports/{id}/uphold 请求体（契约 §5.5）。
 *
 * 举报成立；同事务隐藏对应评价（review.visible → false，
 * hidden_reason = review_note，hidden_by_admin_id = 当前 admin）。
 *
 * 前端校验：review_note ≥ 5 字。
 */
export interface UpholdReportPayload {
  review_note: string;
}

/**
 * POST /admin/review-reports/{id}/dismiss 请求体（契约 §5.5）。
 * 驳回举报；不改评价。前端校验：review_note ≥ 5 字。
 */
export interface DismissReportPayload {
  review_note: string;
}
