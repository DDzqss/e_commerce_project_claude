"use client";

import Link from "next/link";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SPUCard } from "@/components/catalog/SPUCard";
import { ImageWithFallback } from "@/components/ui/ImageWithFallback";
import { Skeleton } from "@/components/ui/Skeleton";
import { useCategories } from "@/hooks/useCategories";
import { useRecommendations } from "@/hooks/useRecommendations";

/**
 * 用户 Web 首页。
 *
 * - 顶部 SiteHeader（含搜索、类目导航）
 * - 主内容：
 *     1. 类目 grid（横向 6 列，展示一级类目）
 *     2. 精选推荐（后端最新审核通过的 10 个 SPU）
 * - 底部预留卡片：说明后续 Phase 会开放的能力
 *
 * 所有数据源均为公开接口，未登录也能浏览。
 */
export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-8">
        <HeroCategories />
        <FeaturedRecommendations />
        <ComingSoon />
        <footer className="mt-8 text-center text-xs text-neutral-400">
          本站点为学习项目，非京东官方，与京东集团无任何关联。
        </footer>
      </main>
    </>
  );
}

function HeroCategories() {
  const { data, isLoading } = useCategories();
  return (
    <section aria-labelledby="home-categories">
      <div className="mb-3 flex items-baseline justify-between">
        <h2
          id="home-categories"
          className="text-lg font-semibold text-neutral-900"
        >
          全部品类
        </h2>
      </div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {isLoading &&
          Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-2 rounded-lg border border-neutral-200 bg-white p-4"
            >
              <Skeleton className="h-12 w-12" circle />
              <Skeleton className="h-3 w-14" />
            </div>
          ))}
        {!isLoading &&
          (data ?? [])
            .filter((c) => c.is_visible)
            .slice(0, 12)
            .map((cat) => (
              <Link
                key={cat.id}
                href={`/category/${cat.id}`}
                className="flex flex-col items-center gap-2 rounded-lg border border-neutral-200 bg-white p-4 text-center transition hover:-translate-y-0.5 hover:border-[color:var(--color-primary-200)] hover:shadow-sm"
              >
                <div className="h-12 w-12 overflow-hidden rounded-full bg-neutral-100">
                  <ImageWithFallback
                    objectKey={cat.icon_url}
                    alt={cat.name}
                    className="h-full w-full"
                  />
                </div>
                <span className="text-sm text-neutral-800">{cat.name}</span>
              </Link>
            ))}
      </div>
    </section>
  );
}

function FeaturedRecommendations() {
  const { data, isLoading, isError, refetch } = useRecommendations(10);

  return (
    <section aria-labelledby="home-recommendations">
      <div className="mb-3 flex items-baseline justify-between">
        <h2
          id="home-recommendations"
          className="text-lg font-semibold text-neutral-900"
        >
          精选推荐
        </h2>
        <span className="text-xs text-neutral-400">最新上架</span>
      </div>

      {isError && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-neutral-300 bg-white py-8 text-sm text-neutral-500">
          推荐加载失败
          <button
            type="button"
            className="rounded border border-neutral-300 px-3 py-1 text-xs hover:border-[color:var(--color-primary)]"
            onClick={() => refetch()}
          >
            重试
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {isLoading &&
          Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white"
            >
              <Skeleton className="aspect-square w-full rounded-none" />
              <div className="flex flex-col gap-2 p-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-5 w-16" />
              </div>
            </div>
          ))}
        {!isLoading &&
          (data ?? []).map((spu) => <SPUCard key={spu.id} spu={spu} compact />)}
      </div>

      {!isLoading && (data ?? []).length === 0 && !isError && (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white py-10 text-center text-sm text-neutral-500">
          暂无推荐商品
        </div>
      )}
    </section>
  );
}

function ComingSoon() {
  const items = [
    { title: "购物车", desc: "多店铺合并结算，Phase 3 上线" },
    { title: "订单中心", desc: "全链路状态与售后追溯" },
    { title: "商品评价", desc: "购后晒单与真实反馈" },
  ];
  return (
    <section aria-labelledby="home-coming-soon">
      <h2
        id="home-coming-soon"
        className="mb-3 text-lg font-semibold text-neutral-900"
      >
        更多能力开发中
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {items.map((it) => (
          <div
            key={it.title}
            className="rounded-lg border border-dashed border-neutral-300 bg-white p-5"
          >
            <h3 className="text-base font-medium text-neutral-900">
              {it.title}
            </h3>
            <p className="mt-1 text-sm text-neutral-500">{it.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
