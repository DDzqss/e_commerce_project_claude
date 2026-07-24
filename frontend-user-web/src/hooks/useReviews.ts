"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";

import {
  createReviews,
  deleteReview,
  editReview,
  listMyReviews,
  listShopReviews,
  listSpuReviews,
  reportReview,
} from "@/lib/review-api";
import { useAuth } from "./useAuth";
import type { PaginatedData } from "@/types";
import type {
  CreateReviewsOut,
  CreateReviewsPayload,
  EditReviewPayload,
  MyReviewsQuery,
  PublicReviewList,
  ReviewOut,
  ReviewReportPayload,
  ShopReviewsQuery,
  SpuReviewsQuery,
} from "@/types/review";

const REVIEWS_KEY_ROOT = ["reviews"] as const;

/** GET /user/reviews 我的评价（需登录）。 */
export function useMyReviews(query: MyReviewsQuery) {
  const { isLoggedIn, hasHydrated } = useAuth();
  return useQuery<PaginatedData<ReviewOut>>({
    queryKey: [...REVIEWS_KEY_ROOT, "mine", query],
    queryFn: () => listMyReviews(query),
    enabled: hasHydrated && isLoggedIn,
    staleTime: 10_000,
  });
}

/** GET /catalog/spus/{id}/reviews 公开。 */
export function useSpuReviews(
  spuId: number | string | null | undefined,
  query: SpuReviewsQuery,
) {
  const enabled = spuId !== null && spuId !== undefined && spuId !== "";
  return useQuery<PublicReviewList>({
    queryKey: [...REVIEWS_KEY_ROOT, "spu", spuId, query],
    queryFn: () => listSpuReviews(spuId as number | string, query),
    enabled,
    staleTime: 30_000,
  });
}

/** GET /catalog/shops/{id}/reviews 公开。 */
export function useShopReviews(
  shopId: number | string | null | undefined,
  query: ShopReviewsQuery,
) {
  const enabled = shopId !== null && shopId !== undefined && shopId !== "";
  return useQuery<PublicReviewList>({
    queryKey: [...REVIEWS_KEY_ROOT, "shop", shopId, query],
    queryFn: () => listShopReviews(shopId as number | string, query),
    enabled,
    staleTime: 30_000,
  });
}

export function useInvalidateReviews() {
  const client = useQueryClient();
  return {
    mine: () =>
      client.invalidateQueries({ queryKey: [...REVIEWS_KEY_ROOT, "mine"] }),
    spu: (spuId: number | string) =>
      client.invalidateQueries({
        queryKey: [...REVIEWS_KEY_ROOT, "spu", spuId],
      }),
    shop: (shopId: number | string) =>
      client.invalidateQueries({
        queryKey: [...REVIEWS_KEY_ROOT, "shop", shopId],
      }),
    all: () => client.invalidateQueries({ queryKey: REVIEWS_KEY_ROOT }),
  };
}

/** 批量发起评价 mutation。 */
export function useCreateReviews(
  options?: UseMutationOptions<
    CreateReviewsOut,
    unknown,
    {
      orderIdOrNo: number | string;
      payload: CreateReviewsPayload;
      idempotencyKey: string;
    }
  >,
) {
  const invalidate = useInvalidateReviews();
  return useMutation<
    CreateReviewsOut,
    unknown,
    {
      orderIdOrNo: number | string;
      payload: CreateReviewsPayload;
      idempotencyKey: string;
    }
  >({
    mutationFn: (v) => createReviews(v.orderIdOrNo, v.payload, v.idempotencyKey),
    ...options,
    onSuccess: (...args) => {
      void invalidate.mine();
      return options?.onSuccess?.(...args);
    },
  });
}

export function useEditReview(
  options?: UseMutationOptions<
    ReviewOut,
    unknown,
    { id: number | string; payload: EditReviewPayload }
  >,
) {
  const invalidate = useInvalidateReviews();
  return useMutation<
    ReviewOut,
    unknown,
    { id: number | string; payload: EditReviewPayload }
  >({
    mutationFn: (v) => editReview(v.id, v.payload),
    ...options,
    onSuccess: (...args) => {
      void invalidate.all();
      return options?.onSuccess?.(...args);
    },
  });
}

export function useDeleteReview(
  options?: UseMutationOptions<void, unknown, { id: number | string }>,
) {
  const invalidate = useInvalidateReviews();
  return useMutation<void, unknown, { id: number | string }>({
    mutationFn: (v) => deleteReview(v.id),
    ...options,
    onSuccess: (...args) => {
      void invalidate.all();
      return options?.onSuccess?.(...args);
    },
  });
}

export function useReportReview(
  options?: UseMutationOptions<
    void,
    unknown,
    { id: number | string; payload: ReviewReportPayload }
  >,
) {
  return useMutation<
    void,
    unknown,
    { id: number | string; payload: ReviewReportPayload }
  >({
    mutationFn: (v) => reportReview(v.id, v.payload),
    ...options,
  });
}
