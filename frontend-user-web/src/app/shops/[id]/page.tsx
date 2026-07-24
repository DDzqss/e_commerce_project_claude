"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { SiteHeader } from "@/components/layout/SiteHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ImageWithFallback } from "@/components/ui/ImageWithFallback";
import { StarRating } from "@/components/ui/StarRating";
import { RatingSummary } from "@/components/ui/RatingSummary";
import { SPUCard } from "@/components/catalog/SPUCard";
import { Pagination } from "@/components/catalog/Pagination";
import { ReviewCard } from "@/components/reviews/ReviewCard";
import { useShopHomepage, useShopSpus } from "@/hooks/useShop";
import { useShopReviews } from "@/hooks/useReviews";
import { cn } from "@/lib/cn";

const PAGE_SIZE = 12;
const REVIEW_PAGE_SIZE = 10;

type Tab = "spus" | "reviews";

export default function ShopHomepagePage() {
  const params = useParams<{ id: string }>();
  const idNum = Number(params.id);
  const shopId = Number.isFinite(idNum) ? idNum : null;

  const [tab, setTab] = useState<Tab>("spus");
  const [spuPage, setSpuPage] = useState(1);
  const [reviewPage, setReviewPage] = useState(1);

  const { data: shop, isLoading, isError } = useShopHomepage(shopId);
  const spuQuery = useMemo(
    () => ({ page: spuPage, size: PAGE_SIZE, sort: "default" as const }),
    [spuPage],
  );
  const { data: spus } = useShopSpus(shopId, spuQuery);
  const reviewQuery = useMemo(
    () => ({ page: reviewPage, size: REVIEW_PAGE_SIZE }),
    [reviewPage],
  );
  const { data: reviews } = useShopReviews(shopId, reviewQuery);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-6 pb-16">
        {isLoading && (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        )}
        {isError && (
          <EmptyState
            title="店铺加载失败"
            description="店铺可能不存在或已关闭"
          />
        )}
        {shop && (
          <>
            {/* Banner */}
            <section className="relative overflow-hidden rounded-lg bg-neutral-100">
              <div className="aspect-[4/1] w-full bg-neutral-200">
                {shop.banner_url ? (
                  <ImageWithFallback
                    objectKey={shop.banner_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <div className="relative flex flex-col gap-3 bg-white p-5 sm:flex-row sm:items-center">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border-4 border-white bg-neutral-100 shadow -mt-12">
                  {shop.logo_url ? (
                    <ImageWithFallback
                      objectKey={shop.logo_url}
                      alt={shop.name}
                      className="h-full w-full"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xl font-semibold text-neutral-400">
                      {shop.name.slice(0, 1)}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-xl font-semibold text-neutral-900">
                    {shop.name}
                  </h1>
                  {shop.description && (
                    <p className="mt-0.5 line-clamp-2 text-sm text-neutral-600">
                      {shop.description}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-neutral-500">
                    <span className="flex items-center gap-1">
                      <StarRating
                        value={shop.rating_avg}
                        readOnly
                        size={14}
                        allowHalf
                      />
                      <span className="font-semibold text-[color:var(--color-primary)]">
                        {shop.rating_avg.toFixed(2)}
                      </span>
                      <span>（{shop.rating_count.toLocaleString("zh-CN")} 条评价）</span>
                    </span>
                    <span>
                      销量{" "}
                      <b className="text-neutral-800">
                        {shop.sales_count.toLocaleString("zh-CN")}
                      </b>
                    </span>
                    {shop.opened_at && (
                      <span>
                        开店于 {formatDate(shop.opened_at)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* 公告 */}
            {shop.announcement && (
              <section className="mt-4 rounded-lg border border-neutral-200 bg-[color:var(--color-primary-50)] p-4 text-sm text-neutral-800">
                <h2 className="mb-1 text-xs font-semibold text-[color:var(--color-primary-700)]">
                  店铺公告
                </h2>
                <p className="whitespace-pre-wrap">{shop.announcement}</p>
              </section>
            )}

            {/* Tabs */}
            <nav
              className="mt-6 flex items-center gap-1 border-b border-neutral-200"
              aria-label="店铺内容"
            >
              <TabButton
                active={tab === "spus"}
                onClick={() => setTab("spus")}
              >
                全部商品
                {spus?.total ? (
                  <span className="ml-1 text-neutral-500">({spus.total})</span>
                ) : null}
              </TabButton>
              <TabButton
                active={tab === "reviews"}
                onClick={() => setTab("reviews")}
              >
                店铺评价
                {reviews?.summary?.count
                  ? (
                    <span className="ml-1 text-neutral-500">
                      ({reviews.summary.count})
                    </span>
                  )
                  : null}
              </TabButton>
            </nav>

            {tab === "spus" && (
              <section className="mt-4">
                {!spus && (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {[0, 1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-64 w-full" />
                    ))}
                  </div>
                )}
                {spus && spus.items.length === 0 && (
                  <EmptyState title="店铺暂无商品" />
                )}
                {spus && spus.items.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {spus.items.map((spu) => (
                      <SPUCard key={spu.id} spu={spu} />
                    ))}
                  </div>
                )}
                {spus && spus.total > PAGE_SIZE && (
                  <div className="mt-6">
                    <Pagination
                      page={spus.page}
                      size={spus.size}
                      total={spus.total}
                      onChange={setSpuPage}
                    />
                  </div>
                )}
              </section>
            )}

            {tab === "reviews" && (
              <section className="mt-4 flex flex-col gap-4">
                {reviews?.summary && (
                  <RatingSummary summary={reviews.summary} />
                )}
                {!reviews && <Skeleton className="h-40 w-full" />}
                {reviews && reviews.items.length === 0 && (
                  <EmptyState title="店铺暂无评价" />
                )}
                {reviews && reviews.items.length > 0 && (
                  <ul className="flex flex-col gap-3">
                    {reviews.items.map((r) => (
                      <li key={r.id}>
                        <ReviewCard review={r} />
                      </li>
                    ))}
                  </ul>
                )}
                {reviews && reviews.total > REVIEW_PAGE_SIZE && (
                  <div className="mt-4">
                    <Pagination
                      page={reviews.page}
                      size={reviews.size}
                      total={reviews.total}
                      onChange={setReviewPage}
                    />
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </main>
    </>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 border-b-2 px-4 py-2 text-sm",
        active
          ? "border-[color:var(--color-primary)] text-[color:var(--color-primary)]"
          : "border-transparent text-neutral-600 hover:text-[color:var(--color-primary)]",
      )}
    >
      {children}
    </button>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("zh-CN");
  } catch {
    return iso;
  }
}
