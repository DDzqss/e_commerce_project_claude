/**
 * Phase 3 · 支付模拟 API。
 *
 * 契约：docs/API/phase-3-contracts.md §9
 *   POST /user/orders/{id}/pay                          (Idempotency-Key 必须)
 *   POST /user/payment-sessions/{session_id}/mock-succeed
 *   POST /user/payment-sessions/{session_id}/mock-fail
 *   GET  /user/payment-sessions/{session_id}
 *
 * 说明：Phase 3 支付**不真实扣款**；创建 session 后前端展示"模拟支付"页面，
 * 用户点"成功"/"失败"按钮驱动状态流转。
 */

import { apiGet, apiPost } from "./api";
import type {
  CreatePaymentSessionPayload,
  OrderDetail,
  PaymentSession,
} from "@/types/order";

/**
 * POST /user/orders/{id}/pay — 创建支付会话。
 * **必带** `Idempotency-Key`：避免用户网络重试时重复扣款。
 */
export function createPaymentSession(
  orderIdOrNo: number | string,
  payload: CreatePaymentSessionPayload,
  idempotencyKey: string,
): Promise<PaymentSession> {
  return apiPost<PaymentSession, CreatePaymentSessionPayload>(
    `user/orders/${orderIdOrNo}/pay`,
    payload,
    {
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
    },
  );
}

/** POST /user/payment-sessions/{session_id}/mock-succeed */
export function mockPaySucceed(sessionId: number): Promise<OrderDetail> {
  return apiPost<OrderDetail>(
    `user/payment-sessions/${sessionId}/mock-succeed`,
  );
}

/** POST /user/payment-sessions/{session_id}/mock-fail */
export function mockPayFail(sessionId: number): Promise<PaymentSession> {
  return apiPost<PaymentSession>(
    `user/payment-sessions/${sessionId}/mock-fail`,
  );
}

/** GET /user/payment-sessions/{session_id} */
export function getPaymentSession(sessionId: number): Promise<PaymentSession> {
  return apiGet<PaymentSession>(`user/payment-sessions/${sessionId}`);
}
