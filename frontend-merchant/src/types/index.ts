/**
 * 商家端公共类型定义。
 * 端侧仅描述与商家后台直接相关的类型；跨端共享类型未来可迁移至 packages/*。
 */

/** 后端统一响应包裹结构（与 backend Pydantic 响应约定保持一致）。 */
export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
  /** 追踪 ID，便于日志追溯 */
  traceId?: string;
}

/**
 * 商家端角色枚举（对应 docs/DEVELOPMENT_PLAN.md 第 5 节）。
 *
 * - OWNER   店铺管理员：店铺所有权限
 * - OPERATOR 店铺运营：商品/订单管理
 * - SUPPORT  店铺客服：仅订单查询/售后处理
 */
export enum MerchantRole {
  OWNER = "OWNER",
  OPERATOR = "OPERATOR",
  SUPPORT = "SUPPORT",
}

/** 常用分页元信息。 */
export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
}

/** 带分页的响应数据。 */
export interface Paged<T> {
  items: T[];
  pagination: Pagination;
}
