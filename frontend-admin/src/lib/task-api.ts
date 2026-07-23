/**
 * Admin 后台调试用任务 API。
 *
 * 契约 §12 超时任务扫描：
 * - POST /admin/tasks/process-timeouts    手动触发超时扫描（调试用）
 *
 * 生产环境有 cron 每 1-5 分钟自动扫描，此端点主要供 Admin 端"立刻验证"
 * 或联调时手动触发。
 */

import { apiPost } from "@/lib/api";
import type { ProcessTimeoutsResult } from "@/types/order";

/**
 * POST /admin/tasks/process-timeouts
 * 权限：admin:order:intervene（比 read_all 严格，避免误操作）
 *
 * 后端会：
 * 1. 扫描 pending_payment 且 deadline 过期的订单 → cancelled（释放库存）
 * 2. 扫描 shipped 且 auto_complete_at 过期的订单 → completed
 * 3. 每类批处理（100 条一批），幂等
 *
 * 无请求体；后端会返回本次处理的两类订单数量。
 */
export function triggerProcessTimeouts(): Promise<ProcessTimeoutsResult> {
  return apiPost<ProcessTimeoutsResult, Record<string, never>>(
    "admin/tasks/process-timeouts",
    {},
  );
}
