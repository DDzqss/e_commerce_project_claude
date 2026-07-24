/**
 * 商家端公共类型的聚合出口。
 * 具体的 API DTO 见 ./api，错误码见 ./errors，订单域见 ./order。
 */

export * from "./api";
export * from "./errors";
export * from "./order";
export * from "./aftersales";
export * from "./review";
export * from "./notification";

/** 后端统一响应包裹结构（与 backend Pydantic 响应约定保持一致）。 */
export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
  /** 追踪 ID，便于日志追溯（可选） */
  traceId?: string;
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
