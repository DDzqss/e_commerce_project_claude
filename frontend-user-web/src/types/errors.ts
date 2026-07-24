/**
 * Phase 1 契约错误码枚举。
 *
 * 与 docs/API/phase-1-contracts.md §2 一一对应。
 * 后端返回 `code` 字段为 number，本文件提供数字 → 语义名 + 默认中文提示的映射，
 * 供 UI 层用来把错误码翻译成对用户友好的文案。
 *
 * 使用示例：
 *   catch (e) {
 *     if (e instanceof ApiError) {
 *       const tip = ERROR_MESSAGES[e.code] ?? e.message;
 *       toast.error(tip);
 *     }
 *   }
 */

export enum ErrorCode {
  Ok = 0,

  // 1xxx 认证 & 会话
  Unauthorized = 1001,
  TokenExpired = 1002,
  BadCredential = 1003,
  AccountDisabled = 1004,
  RefreshInvalid = 1005,
  VerifyCodeInvalid = 1010,
  Forbidden = 1020,

  // 2xxx 用户资料
  UserNotFound = 2001,
  PhoneAlreadyRegistered = 2002,
  EmailAlreadyRegistered = 2003,
  OldPasswordWrong = 2010,

  // 3xxx 商家 & 入驻
  MerchantApplicationPending = 3001,
  AlreadyMerchant = 3002,
  ApplicationNotFound = 3003,
  ApplicationStatusIllegal = 3004,
  MerchantAccountFrozen = 3010,

  // 4xxx Admin
  AdminNotFound = 4001,
  AdminNoPermission = 4020,

  // 5xxx 通用
  ValidationFailed = 5001,
  ResourceNotFound = 5002,
  RateLimited = 5003,

  // 11xxx Phase 3 地址
  AddressNotFound = 11001,
  AddressForbidden = 11002,

  // 12xxx Phase 3 购物车
  CartItemNotFound = 12001,
  CartSkuInvalid = 12002,
  CartQuantityExceedStock = 12003,
  CartQuantityExceedLimit = 12004,

  // 13xxx Phase 3 订单
  OrderNotFound = 13001,
  OrderForbidden = 13002,
  OrderStatusIllegal = 13003,
  OrderStockShort = 13004,
  OrderCartEmpty = 13005,
  OrderNothingSelected = 13006,
  OrderAddressInvalid = 13007,
  OrderPaymentDeadlinePassed = 13008,
  OrderIdempotencyConflict = 13009,
  OrderTrackingNoInvalid = 13010,
  OrderCancelledCannotOperate = 13011,

  // 14xxx Phase 3 支付
  PaymentSessionNotFound = 14001,
  PaymentSessionFinalized = 14002,
  PaymentChannelUnsupported = 14003,
  PaymentMockFailed = 14004,

  // 15xxx Phase 4 售后申请
  AftersalesNotFound = 15001,
  AftersalesForbidden = 15002,
  AftersalesStatusIllegal = 15003,
  OrderTypeNotAllowedForAftersales = 15004,
  OrderHasActiveAftersales = 15005,
  RefundAmountExceed = 15006,
  AftersalesTypeMismatch = 15007,
  AftersalesNoItemSelected = 15008,
  AftersalesArbitratingCannotCancel = 15009,

  // 16xxx Phase 4 凭证
  EvidenceOverLimit = 16001,
  EvidenceNotBelong = 16002,

  // 17xxx Phase 4 物流回填
  AftersalesTrackingInvalid = 17001,
  AftersalesReturnNotAgreed = 17002,
  AftersalesTrackingAlreadyFilled = 17003,

  // 18xxx Phase 4 仲裁
  AftersalesNotEscalated = 18001,
  AftersalesArbitrationDone = 18002,
  AftersalesForceRefundInvalid = 18003,

  // 9xxx 服务端
  InternalError = 9000,
}

/**
 * 默认中文提示。UI 组件在没有更贴合业务上下文的提示时，可回退到此文案。
 * 具体页面（如登录）可能要用更精细的措辞，那就在页面里自行判断 code。
 */
export const ERROR_MESSAGES: Record<number, string> = {
  [ErrorCode.Unauthorized]: "请先登录",
  [ErrorCode.TokenExpired]: "登录状态已过期，请重新登录",
  [ErrorCode.BadCredential]: "账号或密码错误",
  [ErrorCode.AccountDisabled]: "账号已被禁用，请联系客服",
  [ErrorCode.RefreshInvalid]: "登录已失效，请重新登录",
  [ErrorCode.VerifyCodeInvalid]: "验证码错误或已过期",
  [ErrorCode.Forbidden]: "权限不足",

  [ErrorCode.UserNotFound]: "用户不存在",
  [ErrorCode.PhoneAlreadyRegistered]: "该手机号已注册",
  [ErrorCode.EmailAlreadyRegistered]: "该邮箱已注册",
  [ErrorCode.OldPasswordWrong]: "原密码错误",

  [ErrorCode.MerchantApplicationPending]: "你已有一条待审核的入驻申请",
  [ErrorCode.AlreadyMerchant]: "你已经是商家，无需重复申请",
  [ErrorCode.ApplicationNotFound]: "申请不存在",
  [ErrorCode.ApplicationStatusIllegal]: "当前申请状态不允许该操作",
  [ErrorCode.MerchantAccountFrozen]: "商家账号已被冻结",

  [ErrorCode.AdminNotFound]: "管理员不存在",
  [ErrorCode.AdminNoPermission]: "管理员权限不足",

  [ErrorCode.ValidationFailed]: "参数校验失败",
  [ErrorCode.ResourceNotFound]: "资源不存在",
  [ErrorCode.RateLimited]: "请求过于频繁，请稍后再试",

  // 11xxx 地址
  [ErrorCode.AddressNotFound]: "地址不存在",
  [ErrorCode.AddressForbidden]: "无权访问该地址",

  // 12xxx 购物车
  [ErrorCode.CartItemNotFound]: "购物车项不存在",
  [ErrorCode.CartSkuInvalid]: "该商品已失效，无法加入购物车",
  [ErrorCode.CartQuantityExceedStock]: "数量超过库存",
  [ErrorCode.CartQuantityExceedLimit]: "单次购买数量最多 999 件",

  // 13xxx 订单
  [ErrorCode.OrderNotFound]: "订单不存在",
  [ErrorCode.OrderForbidden]: "无权查看该订单",
  [ErrorCode.OrderStatusIllegal]: "当前订单状态不允许该操作",
  [ErrorCode.OrderStockShort]: "库存不足，下单失败",
  [ErrorCode.OrderCartEmpty]: "购物车为空，请先添加商品",
  [ErrorCode.OrderNothingSelected]: "没有可结算的商品",
  [ErrorCode.OrderAddressInvalid]: "收货地址无效",
  [ErrorCode.OrderPaymentDeadlinePassed]: "订单已超过支付时限，请重新下单",
  [ErrorCode.OrderIdempotencyConflict]: "订单已提交，请勿重复操作",
  [ErrorCode.OrderTrackingNoInvalid]: "快递单号格式无效",
  [ErrorCode.OrderCancelledCannotOperate]: "订单已取消，无法继续操作",

  // 14xxx 支付
  [ErrorCode.PaymentSessionNotFound]: "支付订单不存在",
  [ErrorCode.PaymentSessionFinalized]: "此支付已完成或已失败，不可重试",
  [ErrorCode.PaymentChannelUnsupported]: "该支付方式暂不支持",
  [ErrorCode.PaymentMockFailed]: "模拟支付失败",

  // 15xxx 售后申请
  [ErrorCode.AftersalesNotFound]: "售后单不存在",
  [ErrorCode.AftersalesForbidden]: "无权访问该售后单",
  [ErrorCode.AftersalesStatusIllegal]: "当前售后状态不允许该操作",
  [ErrorCode.OrderTypeNotAllowedForAftersales]:
    "当前订单状态不支持发起此类型售后",
  [ErrorCode.OrderHasActiveAftersales]: "该订单已有正在处理中的售后单",
  [ErrorCode.RefundAmountExceed]: "退款金额超过订单可退金额",
  [ErrorCode.AftersalesTypeMismatch]: "售后类型与订单状态不匹配",
  [ErrorCode.AftersalesNoItemSelected]: "请至少选择一件商品",
  [ErrorCode.AftersalesArbitratingCannotCancel]:
    "售后已进入平台仲裁，不可撤销",

  // 16xxx 凭证
  [ErrorCode.EvidenceOverLimit]: "凭证数量已达上限 8 张",
  [ErrorCode.EvidenceNotBelong]: "凭证不属于此售后单",

  // 17xxx 物流回填
  [ErrorCode.AftersalesTrackingInvalid]: "快递单号格式无效",
  [ErrorCode.AftersalesReturnNotAgreed]: "售后单尚未同意退货，暂不能回填快递",
  [ErrorCode.AftersalesTrackingAlreadyFilled]: "已回填过快递单号，不可重复回填",

  // 18xxx 仲裁
  [ErrorCode.AftersalesNotEscalated]: "尚未升级至平台，不能仲裁",
  [ErrorCode.AftersalesArbitrationDone]: "仲裁已完成",
  [ErrorCode.AftersalesForceRefundInvalid]: "强制退款金额非法",

  [ErrorCode.InternalError]: "服务器开小差了，请稍后重试",
};

/**
 * 便捷函数：从错误码获取默认提示，未知 code 回退到 fallback。
 */
export function messageForCode(code: number, fallback = "请求失败"): string {
  return ERROR_MESSAGES[code] ?? fallback;
}
