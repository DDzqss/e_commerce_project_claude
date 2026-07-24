"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";

import {
  addAftersalesEvidence,
  appealAftersales,
  cancelAftersales,
  confirmExchange,
  createAftersales,
  getAftersales,
  listAftersales,
  nudgeAftersales,
  submitTracking,
} from "@/lib/aftersales-api";
import { useAuth } from "./useAuth";
import type { PaginatedData } from "@/types";
import type {
  AftersalesAddEvidencePayload,
  AftersalesAppealPayload,
  AftersalesCancelPayload,
  AftersalesCreatePayload,
  AftersalesDetail,
  AftersalesListItem,
  AftersalesListQuery,
  AftersalesSubmitTrackingPayload,
} from "@/types/aftersales";

const AFTERSALES_KEY_ROOT = ["user", "aftersales"] as const;

/** GET /user/aftersales 分页列表。 */
export function useAftersalesList(query: AftersalesListQuery) {
  const { isLoggedIn, hasHydrated } = useAuth();
  return useQuery<PaginatedData<AftersalesListItem>>({
    queryKey: [...AFTERSALES_KEY_ROOT, "list", query],
    queryFn: () => listAftersales(query),
    enabled: hasHydrated && isLoggedIn,
    staleTime: 10_000,
  });
}

/** GET /user/aftersales/{id} 详情。 */
export function useAftersalesDetail(idOrNo: string | number | null | undefined) {
  const { isLoggedIn, hasHydrated } = useAuth();
  const enabled =
    hasHydrated &&
    isLoggedIn &&
    idOrNo !== null &&
    idOrNo !== undefined &&
    idOrNo !== "";
  return useQuery<AftersalesDetail>({
    queryKey: [...AFTERSALES_KEY_ROOT, "detail", idOrNo],
    queryFn: () => getAftersales(idOrNo as string | number),
    enabled,
    staleTime: 5_000,
  });
}

/** 便捷 invalidate。 */
export function useInvalidateAftersales() {
  const client = useQueryClient();
  return {
    list: () =>
      client.invalidateQueries({ queryKey: [...AFTERSALES_KEY_ROOT, "list"] }),
    detail: (idOrNo: string | number) =>
      client.invalidateQueries({
        queryKey: [...AFTERSALES_KEY_ROOT, "detail", idOrNo],
      }),
    all: () =>
      client.invalidateQueries({ queryKey: AFTERSALES_KEY_ROOT }),
  };
}

/** ---------- mutations ---------- */

/**
 * 通用工厂：把 mutationFn + 副作用（onSuccess 触发 invalidate）打包。
 * 通过 spread options 允许调用方覆盖 onSuccess。react-query v5 的 onSuccess
 * 签名是 (data, variables, onMutateResult, context)，我们用 rest args 转发以
 * 避免和版本变更绑死。
 */
interface CreateVars {
  orderIdOrNo: string | number;
  payload: AftersalesCreatePayload;
  idempotencyKey: string;
}

export function useCreateAftersales(
  options?: UseMutationOptions<AftersalesDetail, unknown, CreateVars>,
) {
  const invalidate = useInvalidateAftersales();
  return useMutation<AftersalesDetail, unknown, CreateVars>({
    mutationFn: (v) =>
      createAftersales(v.orderIdOrNo, v.payload, v.idempotencyKey),
    ...options,
    onSuccess: (...args) => {
      void invalidate.list();
      return options?.onSuccess?.(...args);
    },
  });
}

interface IdWithPayload<P> {
  idOrNo: string | number;
  payload?: P;
}

export function useCancelAftersales(
  options?: UseMutationOptions<
    AftersalesDetail,
    unknown,
    IdWithPayload<AftersalesCancelPayload>
  >,
) {
  const invalidate = useInvalidateAftersales();
  return useMutation<
    AftersalesDetail,
    unknown,
    IdWithPayload<AftersalesCancelPayload>
  >({
    mutationFn: (v) => cancelAftersales(v.idOrNo, v.payload),
    ...options,
    onSuccess: (...args) => {
      void invalidate.detail(args[1].idOrNo);
      void invalidate.list();
      return options?.onSuccess?.(...args);
    },
  });
}

export function useSubmitTracking(
  options?: UseMutationOptions<
    AftersalesDetail,
    unknown,
    { idOrNo: string | number; payload: AftersalesSubmitTrackingPayload }
  >,
) {
  const invalidate = useInvalidateAftersales();
  return useMutation<
    AftersalesDetail,
    unknown,
    { idOrNo: string | number; payload: AftersalesSubmitTrackingPayload }
  >({
    mutationFn: (v) => submitTracking(v.idOrNo, v.payload),
    ...options,
    onSuccess: (...args) => {
      void invalidate.detail(args[1].idOrNo);
      void invalidate.list();
      return options?.onSuccess?.(...args);
    },
  });
}

export function useConfirmExchange(
  options?: UseMutationOptions<
    AftersalesDetail,
    unknown,
    { idOrNo: string | number }
  >,
) {
  const invalidate = useInvalidateAftersales();
  return useMutation<
    AftersalesDetail,
    unknown,
    { idOrNo: string | number }
  >({
    mutationFn: (v) => confirmExchange(v.idOrNo),
    ...options,
    onSuccess: (...args) => {
      void invalidate.detail(args[1].idOrNo);
      void invalidate.list();
      return options?.onSuccess?.(...args);
    },
  });
}

export function useNudgeAftersales(
  options?: UseMutationOptions<
    AftersalesDetail,
    unknown,
    { idOrNo: string | number }
  >,
) {
  const invalidate = useInvalidateAftersales();
  return useMutation<
    AftersalesDetail,
    unknown,
    { idOrNo: string | number }
  >({
    mutationFn: (v) => nudgeAftersales(v.idOrNo),
    ...options,
    onSuccess: (...args) => {
      void invalidate.detail(args[1].idOrNo);
      return options?.onSuccess?.(...args);
    },
  });
}

export function useAppealAftersales(
  options?: UseMutationOptions<
    AftersalesDetail,
    unknown,
    { idOrNo: string | number; payload: AftersalesAppealPayload }
  >,
) {
  const invalidate = useInvalidateAftersales();
  return useMutation<
    AftersalesDetail,
    unknown,
    { idOrNo: string | number; payload: AftersalesAppealPayload }
  >({
    mutationFn: (v) => appealAftersales(v.idOrNo, v.payload),
    ...options,
    onSuccess: (...args) => {
      void invalidate.detail(args[1].idOrNo);
      void invalidate.list();
      return options?.onSuccess?.(...args);
    },
  });
}

export function useAddEvidence(
  options?: UseMutationOptions<
    AftersalesDetail,
    unknown,
    { idOrNo: string | number; payload: AftersalesAddEvidencePayload }
  >,
) {
  const invalidate = useInvalidateAftersales();
  return useMutation<
    AftersalesDetail,
    unknown,
    { idOrNo: string | number; payload: AftersalesAddEvidencePayload }
  >({
    mutationFn: (v) => addAftersalesEvidence(v.idOrNo, v.payload),
    ...options,
    onSuccess: (...args) => {
      void invalidate.detail(args[1].idOrNo);
      return options?.onSuccess?.(...args);
    },
  });
}
