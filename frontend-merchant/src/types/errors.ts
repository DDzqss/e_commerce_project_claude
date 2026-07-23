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
