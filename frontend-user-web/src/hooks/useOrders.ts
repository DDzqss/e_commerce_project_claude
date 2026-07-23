"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getOrder, getShipment, listOrders } from "@/lib/order-api";
import { useAuth } from "./useAuth";
import type {
  OrderDetail,
  OrderListItem,
  OrderListQuery,
  ShipmentInfo,
} from "@/types/order";
import type { PaginatedData } from "@/types";

const ORDERS_KEY_ROOT = ["user", "orders"] as const;

/** GET /user/orders 分页列表。 */
export function useOrders(query: OrderListQuery) {
  const { isLoggedIn, hasHydrated } = useAuth();
  return useQuery<PaginatedData<OrderListItem>>({
    queryKey: [...ORDERS_KEY_ROOT, "list", query],
    queryFn: () => listOrders(query),
    enabled: hasHydrated && isLoggedIn,
    staleTime: 10_000,
  });
}

/** GET /user/orders/{id}。 */
export function useOrder(idOrNo: string | number | null | undefined) {
  const { isLoggedIn, hasHydrated } = useAuth();
  const enabled =
    hasHydrated && isLoggedIn && idOrNo !== null && idOrNo !== undefined && idOrNo !== "";
  return useQuery<OrderDetail>({
    queryKey: [...ORDERS_KEY_ROOT, "detail", idOrNo],
    queryFn: () => getOrder(idOrNo as string | number),
    enabled,
    staleTime: 5_000,
  });
}

/** GET /user/orders/{id}/shipment。 */
export function useShipment(idOrNo: string | number | null | undefined) {
  const { isLoggedIn, hasHydrated } = useAuth();
  const enabled =
    hasHydrated && isLoggedIn && idOrNo !== null && idOrNo !== undefined && idOrNo !== "";
  return useQuery<ShipmentInfo>({
    queryKey: [...ORDERS_KEY_ROOT, "shipment", idOrNo],
    queryFn: () => getShipment(idOrNo as string | number),
    enabled,
    staleTime: 30_000,
  });
}

/** 便捷 invalidate。变更操作后调用。 */
export function useInvalidateOrders() {
  const client = useQueryClient();
  return {
    list: () => client.invalidateQueries({ queryKey: [...ORDERS_KEY_ROOT, "list"] }),
    detail: (idOrNo: string | number) =>
      client.invalidateQueries({
        queryKey: [...ORDERS_KEY_ROOT, "detail", idOrNo],
      }),
    all: () => client.invalidateQueries({ queryKey: ORDERS_KEY_ROOT }),
  };
}
