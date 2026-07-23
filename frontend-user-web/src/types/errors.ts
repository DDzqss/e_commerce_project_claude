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

  [ErrorCode.InternalError]: "服务器开小差了，请稍后重试",
};

/**
 * 便捷函数：从错误码获取默认提示，未知 code 回退到 fallback。
 */
export function messageForCode(code: number, fallback = "请求失败"): string {
  return ERROR_MESSAGES[code] ?? fallback;
}
