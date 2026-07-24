/**
 * Phase 1 错误码常量与文案映射。
 *
 * 定义来自 docs/API/phase-1-contracts.md §2。仅收录商家端可能命中的错误码；
 * 其他域（如 admin 4xxx）不在此处维护。
 */

export const ErrorCode = {
  OK: 0,
  /** 未登录 */
  UNAUTHENTICATED: 1001,
  /** access token 过期，前端需静默 refresh */
  TOKEN_EXPIRED: 1002,
  /** 账号或密码错误 */
  BAD_CREDENTIALS: 1003,
  /** 账号被禁用 */
  ACCOUNT_DISABLED: 1004,
  /** refresh token 无效 */
  REFRESH_INVALID: 1005,
  /** 权限不足 */
  PERMISSION_DENIED: 1020,
  /** 旧密码错误 */
  OLD_PASSWORD_WRONG: 2010,
  /** 商家账号被冻结 */
  MERCHANT_FROZEN: 3010,
  /** 参数校验失败 */
  VALIDATION_FAILED: 5001,
  /** 资源不存在 */
  NOT_FOUND: 5002,
  /** 请求过频 */
  TOO_MANY_REQUESTS: 5003,
  /** 服务端错误 */
  INTERNAL_ERROR: 9000,

  // ----- Phase 3 · 订单域（13xxx） -----
  /** 订单不存在 */
  ORDER_NOT_FOUND: 13001,
  /** 无权访问此订单（不属于当前店铺） */
  ORDER_ACCESS_DENIED: 13002,
  /** 订单状态不允许此操作（如已发货订单不能取消） */
  ORDER_STATUS_NOT_ALLOWED: 13003,
  /** 库存不足（用户端下单，商家端不常见） */
  ORDER_STOCK_SHORT: 13004,
  /** 购物车为空 */
  ORDER_CART_EMPTY: 13005,
  /** 未选中任何 SKU */
  ORDER_NO_SKU_SELECTED: 13006,
  /** 收货地址无效 */
  ORDER_ADDRESS_INVALID: 13007,
  /** 订单已过支付截止时间 */
  ORDER_PAYMENT_TIMEOUT: 13008,
  /** idempotency key 冲突 */
  ORDER_IDEMPOTENCY_CONFLICT: 13009,
  /** 快递单号格式无效（6-30 字符 alphanumeric） */
  ORDER_TRACKING_NO_INVALID: 13010,
  /** 已取消订单不可再操作 */
  ORDER_ALREADY_CANCELLED: 13011,

  // ----- Phase 4 · 售后域（15xxx / 16xxx / 17xxx / 18xxx） -----
  /** 售后单不存在 */
  AFTERSALES_NOT_FOUND: 15001,
  /** 无权访问此售后单 */
  AFTERSALES_ACCESS_DENIED: 15002,
  /** 售后状态不允许当前操作 */
  AFTERSALES_STATUS_NOT_ALLOWED: 15003,
  /** 订单不允许发起此类型售后 */
  AFTERSALES_ORDER_TYPE_MISMATCH: 15004,
  /** 订单已有 active 售后单 */
  AFTERSALES_ORDER_HAS_ACTIVE: 15005,
  /** 退款金额超过订单可退金额 */
  AFTERSALES_REFUND_AMOUNT_EXCEED: 15006,
  /** 售后类型与订单状态不匹配 */
  AFTERSALES_TYPE_ORDER_STATUS_MISMATCH: 15007,
  /** 未选择任何 order_item */
  AFTERSALES_NO_ITEM_SELECTED: 15008,
  /** 售后单已进入平台仲裁不可撤销 */
  AFTERSALES_ARBITRATING_LOCKED: 15009,
  /** 凭证数量超上限 */
  AFTERSALES_EVIDENCE_LIMIT_EXCEED: 16001,
  /** 凭证不属于此售后单 */
  AFTERSALES_EVIDENCE_MISMATCH: 16002,
  /** 快递单号无效 */
  AFTERSALES_TRACKING_NO_INVALID: 17001,
  /** 售后单尚未同意退货 */
  AFTERSALES_NOT_AGREED_RETURN: 17002,
  /** 售后单已回填过物流不可再回填 */
  AFTERSALES_TRACKING_ALREADY_FILLED: 17003,

  // ----- Phase 5 · 评价域（19xxx / 20xxx / 21xxx） -----
  /** 评价不存在 */
  REVIEW_NOT_FOUND: 19001,
  /** 无权访问该评价 */
  REVIEW_ACCESS_DENIED: 19002,
  /** 此订单不可评价（未收货或已评价） */
  REVIEW_ORDER_NOT_REVIEWABLE: 19003,
  /** 评价编辑窗口已过或已编辑过 */
  REVIEW_EDIT_LOCKED: 19004,
  /** 星级非法（应为 1-5） */
  REVIEW_RATING_INVALID: 19005,
  /** 评价内容长度非法 */
  REVIEW_CONTENT_INVALID: 19006,
  /** 评价图片数量超上限（6 张） */
  REVIEW_IMAGES_LIMIT: 19007,

  /** 评价回复不存在 */
  REVIEW_REPLY_NOT_FOUND: 20001,
  /** 已回复过（一条评价一条回复） */
  REVIEW_REPLY_DUPLICATE: 20002,
  /** 无权回复此评价 */
  REVIEW_REPLY_ACCESS_DENIED: 20003,

  /** 评价举报不存在 */
  REVIEW_REPORT_NOT_FOUND: 21001,
  /** 已举报过 */
  REVIEW_REPORT_DUPLICATE: 21002,
  /** 举报理由非法 */
  REVIEW_REPORT_REASON_INVALID: 21003,

  // ----- Phase 5 · 通知域（22xxx） -----
  /** 通知不存在 */
  NOTIFICATION_NOT_FOUND: 22001,
  /** 无权访问该通知 */
  NOTIFICATION_ACCESS_DENIED: 22002,
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

/** 面向商家端用户的中文错误提示（fallback：使用后端 message）。 */
export const ERROR_MESSAGES: Record<number, string> = {
  [ErrorCode.UNAUTHENTICATED]: "登录已失效，请重新登录",
  [ErrorCode.TOKEN_EXPIRED]: "登录已过期，正在刷新…",
  [ErrorCode.BAD_CREDENTIALS]: "登录名或密码错误",
  [ErrorCode.ACCOUNT_DISABLED]: "账号已被禁用，请联系平台管理员",
  [ErrorCode.REFRESH_INVALID]: "登录已失效，请重新登录",
  [ErrorCode.PERMISSION_DENIED]: "当前角色无此操作权限",
  [ErrorCode.OLD_PASSWORD_WRONG]: "原密码错误",
  [ErrorCode.MERCHANT_FROZEN]: "商家账号已被冻结，请联系平台客服",
  [ErrorCode.VALIDATION_FAILED]: "参数校验失败，请检查输入",
  [ErrorCode.NOT_FOUND]: "资源不存在",
  [ErrorCode.TOO_MANY_REQUESTS]: "操作过于频繁，请稍后再试",
  [ErrorCode.INTERNAL_ERROR]: "服务暂不可用，请稍后重试",

  // ----- Phase 3 · 订单域 -----
  [ErrorCode.ORDER_NOT_FOUND]: "订单不存在",
  [ErrorCode.ORDER_ACCESS_DENIED]: "无权访问此订单",
  [ErrorCode.ORDER_STATUS_NOT_ALLOWED]: "订单当前状态不允许此操作",
  [ErrorCode.ORDER_STOCK_SHORT]: "库存不足，无法完成操作",
  [ErrorCode.ORDER_CART_EMPTY]: "购物车为空",
  [ErrorCode.ORDER_NO_SKU_SELECTED]: "未选中任何商品",
  [ErrorCode.ORDER_ADDRESS_INVALID]: "收货地址无效",
  [ErrorCode.ORDER_PAYMENT_TIMEOUT]: "订单已过支付截止时间",
  [ErrorCode.ORDER_IDEMPOTENCY_CONFLICT]: "重复提交，请稍后重试",
  [ErrorCode.ORDER_TRACKING_NO_INVALID]:
    "快递单号格式无效，需 6-30 位字母/数字",
  [ErrorCode.ORDER_ALREADY_CANCELLED]: "订单已取消，不可再操作",

  // ----- Phase 4 · 售后域 -----
  [ErrorCode.AFTERSALES_NOT_FOUND]: "售后单不存在",
  [ErrorCode.AFTERSALES_ACCESS_DENIED]: "无权访问此售后单",
  [ErrorCode.AFTERSALES_STATUS_NOT_ALLOWED]: "当前售后状态不允许此操作",
  [ErrorCode.AFTERSALES_ORDER_TYPE_MISMATCH]: "订单不允许发起此类型售后",
  [ErrorCode.AFTERSALES_ORDER_HAS_ACTIVE]: "订单已有进行中的售后单",
  [ErrorCode.AFTERSALES_REFUND_AMOUNT_EXCEED]: "退款金额超过订单可退金额",
  [ErrorCode.AFTERSALES_TYPE_ORDER_STATUS_MISMATCH]:
    "售后类型与订单当前状态不匹配",
  [ErrorCode.AFTERSALES_NO_ITEM_SELECTED]: "未选择任何商品明细",
  [ErrorCode.AFTERSALES_ARBITRATING_LOCKED]:
    "售后已进入平台仲裁，无法修改",
  [ErrorCode.AFTERSALES_EVIDENCE_LIMIT_EXCEED]: "凭证图片数量超过 8 张上限",
  [ErrorCode.AFTERSALES_EVIDENCE_MISMATCH]: "凭证不属于此售后单",
  [ErrorCode.AFTERSALES_TRACKING_NO_INVALID]:
    "快递单号格式无效，需 6-30 位字母/数字",
  [ErrorCode.AFTERSALES_NOT_AGREED_RETURN]: "售后尚未同意退货，不能回填物流",
  [ErrorCode.AFTERSALES_TRACKING_ALREADY_FILLED]:
    "售后已回填过物流，不能再次回填",

  // ----- Phase 5 · 评价 / 回复 / 举报 -----
  [ErrorCode.REVIEW_NOT_FOUND]: "评价不存在",
  [ErrorCode.REVIEW_ACCESS_DENIED]: "无权访问该评价",
  [ErrorCode.REVIEW_ORDER_NOT_REVIEWABLE]: "该订单当前不可评价",
  [ErrorCode.REVIEW_EDIT_LOCKED]: "评价编辑窗口已过",
  [ErrorCode.REVIEW_RATING_INVALID]: "评价星级必须为 1-5",
  [ErrorCode.REVIEW_CONTENT_INVALID]: "评价内容长度不合法",
  [ErrorCode.REVIEW_IMAGES_LIMIT]: "评价图片最多 6 张",
  [ErrorCode.REVIEW_REPLY_NOT_FOUND]: "评价回复不存在",
  [ErrorCode.REVIEW_REPLY_DUPLICATE]: "该评价已回复过，不能重复回复",
  [ErrorCode.REVIEW_REPLY_ACCESS_DENIED]: "无权回复此评价",
  [ErrorCode.REVIEW_REPORT_NOT_FOUND]: "评价举报不存在",
  [ErrorCode.REVIEW_REPORT_DUPLICATE]: "已举报过该评价",
  [ErrorCode.REVIEW_REPORT_REASON_INVALID]: "举报理由不合法",

  // ----- Phase 5 · 通知 -----
  [ErrorCode.NOTIFICATION_NOT_FOUND]: "通知不存在",
  [ErrorCode.NOTIFICATION_ACCESS_DENIED]: "无权访问该通知",
};

/**
 * 统一的 API 错误对象。API 客户端在遇到 `code != 0` 或 HTTP 非 2xx 时抛出此错误。
 */
export class ApiError extends Error {
  readonly code: number;
  readonly httpStatus?: number;
  readonly data: unknown;

  constructor(code: number, message: string, httpStatus?: number, data: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.data = data;
  }

  /** 获取面向用户的可读文案。优先使用码表映射，否则回退后端 message。 */
  toUserMessage(): string {
    return ERROR_MESSAGES[this.code] ?? this.message ?? "未知错误";
  }
}
