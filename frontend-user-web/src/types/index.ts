/**
 * 后端统一响应结构。
 *
 * 与 docs/DEVELOPMENT_PLAN.md 第 10 节 API 设计规范保持一致：
 *   { code: 0, message: "ok", data: {...} }
 *
 * - code === 0 表示业务成功
 * - code !== 0 表示业务失败，message 为可展示的错误信息
 * - 前端不应直接解构 data，请通过 @/lib/api 中的 unwrap/apiGet/apiPost 使用
 */
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}

/**
 * 分页请求参数（对应后端 ?page=1&size=20）。
 */
export interface PaginationQuery {
  page?: number;
  size?: number;
}

/**
 * 分页响应负载。
 */
export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

/**
 * ID 类型别名，方便日后统一切换（number vs string / snowflake）。
 */
export type ID = string;

/**
 * 通用时间戳字段（ISO 8601 字符串）。
 */
export interface Timestamps {
  createdAt: string;
  updatedAt: string;
}

/**
 * 领域强类型 & 错误码：重新导出，方便 `import { UserOut } from "@/types"`。
 */
export * from "./api";
export * from "./errors";
export * from "./catalog";
export * from "./order";
export * from "./aftersales";
export * from "./review";
export * from "./notification";
export * from "./region";
export * from "./shop";
