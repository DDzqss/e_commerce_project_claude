"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getPaymentSession } from "@/lib/payment-api";
import { useAuth } from "./useAuth";
import type { PaymentSession } from "@/types/order";

const PAY_KEY_ROOT = ["user", "payment-session"] as const;

/** GET /user/payment-sessions/{session_id}；用于 hydrate 支付页。 */
export function usePaymentSession(sessionId: number | null | undefined) {
  const { isLoggedIn, hasHydrated } = useAuth();
  const enabled =
    hasHydrated && isLoggedIn && typeof sessionId === "number" && sessionId > 0;
  return useQuery<PaymentSession>({
    queryKey: [...PAY_KEY_ROOT, sessionId],
    queryFn: () => getPaymentSession(sessionId as number),
    enabled,
    staleTime: 5_000,
  });
}

export function useInvalidatePaymentSession(sessionId?: number) {
  const client = useQueryClient();
  return () =>
    client.invalidateQueries({
      queryKey: sessionId ? [...PAY_KEY_ROOT, sessionId] : PAY_KEY_ROOT,
    });
}
