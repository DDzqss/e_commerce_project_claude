"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SPUCard } from "@/components/catalog/SPUCard";
import {
  BreadcrumbCategory,
  type BreadcrumbItem,
} from "@/components/catalog/BreadcrumbCategory";
import { Pagination } from "@/components/catalog/Pagination";
import { PriceRangeFilter } from "@/components/catalog/PriceRangeFilter";
import { SortDropdown } from "@/components/catalog/SortDropdown";
import { Skeleton } from "@/components/ui/Skeleton";
import { useBrands } from "@/hooks/useBrands";
import { useSPUList } from "@/hooks/useSPUList";
import type { SPUSort } from "@/types/catalog";

/**
 * 搜索结果页 /search?keyword=xxx&brand_id=&sort=...
 *
 * 头部 SiteHeader 也有搜索栏，两处都提交到本页；本页把 keyword 从 URL 读入。
 * 品牌单选（同类目页一致，Phase 2 契约 §11.2 只支持单值）。
 *
 * 注意：Next 15 要求所有使用 useSearchParams 的 client 组件在 SSR/prerender 时
 * 有 Suspense 边界，否则会 bailout 到 CSR 并在 build 时报错。
 */
export default function SearchPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-6">
        <Suspense fallback={<SearchPageFallback />}>
          <SearchPageInner />
        </Suspense>
      </main>
    </>
  );
}

function SearchPageFallback() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <SkeletonSPUCard key={i} />
      ))}
    </div>
  );
}

function SearchPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const keyword = (searchParams.get("keyword") ?? "").trim();

  const [page, setPage] = useState(1);
  const [size] = useState(20);
  const [sort, setSort] = useState<SPUSort>("default");
  const [brandId, setBrandId] = useState<number | undefined>(undefined);
  const [priceRange, setPriceRange] = useState<{
    minCents?: number;
    maxCents?: number;
  }>({});

  // 关键字变了 → 复位分页和筛选
  useEffect(() => {
    setPage(1);
    setBrandId(undefined);
    setPriceRange({});
  }, [keyword]);

  const { data: brands } = useBrands();

  const listQuery = {
    keyword: keyword || undefined,
    brand_id: brandId,
    min_price_cents: priceRange.minCents,
    max_price_cents: priceRange.maxCents,
    sort,
    page,
    size,
  };

  const { data, isLoading, isError, refetch } = useSPUList(listQuery);

  const breadcrumb: BreadcrumbItem[] = [
    {
      name: keyword ? `搜索："${keyword}"` : "搜索",
    },
  ];

  return (
    <>
      <BreadcrumbCategory items={breadcrumb} className="mb-4" />

      {!keyword ? (
        <EmptyKeyword onSubmit={(kw) => router.push(`/search?keyword=${encodeURIComponent(kw)}`)} />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
            <aside className="flex flex-col gap-6">
              <FilterCard title="品牌">
                <ul className="flex flex-col gap-1 text-sm text-neutral-700">
                  <li>
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name="brand"
                        checked={brandId === undefined}
                        onChange={() => {
                          setBrandId(undefined);
                          setPage(1);
                        }}
                      />
                      <span>全部品牌</span>
                    </label>
                  </li>
                  {(brands?.items ?? []).map((b) => (
                    <li key={b.id}>
                      <label className="flex cursor-pointer items-center gap-2">
                        <input
                          type="radio"
                          name="brand"
                          checked={brandId === b.id}
                          onChange={() => {
                            setBrandId(b.id);
                            setPage(1);
                          }}
                        />
                        <span>{b.name}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </FilterCard>

              <FilterCard title="价格区间（元）">
                <PriceRangeFilter
                  valueYuan={{
                    min:
                      priceRange.minCents !== undefined
                        ? priceRange.minCents / 100
                        : undefined,
                    max:
                      priceRange.maxCents !== undefined
                        ? priceRange.maxCents / 100
                        : undefined,
                  }}
                  onChange={(v) => {
                    setPriceRange(v);
                    setPage(1);
                  }}
                />
              </FilterCard>
            </aside>

            <section>
              <div className="mb-4 flex items-center justify-between">
                <SortDropdown
                  value={sort}
                  onChange={(v) => {
                    setSort(v);
                    setPage(1);
                  }}
                />
                {data && (
                  <span className="text-xs text-neutral-500">
                    找到 {data.total} 件与 &quot;{keyword}&quot; 相关的商品
                  </span>
                )}
              </div>

              {isError && (
                <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-neutral-300 bg-white py-12 text-sm text-neutral-500">
                  搜索失败
                  <button
                    type="button"
                    onClick={() => refetch()}
                    className="rounded border border-neutral-300 px-3 py-1 text-xs hover:border-[color:var(--color-primary)]"
                  >
                    重试
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {isLoading &&
                  Array.from({ length: 8 }).map((_, i) => (
                    <SkeletonSPUCard key={i} />
                  ))}
                {!isLoading &&
                  (data?.items ?? []).map((spu) => (
                    <SPUCard key={spu.id} spu={spu} />
                  ))}
              </div>

              {!isLoading && !isError && (data?.items ?? []).length === 0 && (
                <div className="rounded-lg border border-dashed border-neutral-300 bg-white py-12 text-center text-sm text-neutral-500">
                  没有匹配 &quot;{keyword}&quot; 的商品，换个关键字试试？
                </div>
              )}

              {data && (
                <Pagination
                  className="mt-6"
                  page={data.page}
                  size={data.size}
                  total={data.total}
                  onChange={setPage}
                />
              )}
            </section>
        </div>
      )}
    </>
  );
}

function EmptyKeyword({ onSubmit }: { onSubmit: (kw: string) => void }) {
  const [kw, setKw] = useState("");
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-lg border border-neutral-200 bg-white p-8">
      <h1 className="text-lg font-medium text-neutral-800">搜索商品</h1>
      <p className="text-sm text-neutral-500">输入关键字，回车或点击&quot;搜索&quot;</p>
      <form
        className="flex w-full items-center overflow-hidden rounded-md border border-neutral-300 focus-within:border-[color:var(--color-primary)]"
        onSubmit={(e) => {
          e.preventDefault();
          const v = kw.trim();
          if (v) onSubmit(v);
        }}
      >
        <input
          value={kw}
          onChange={(e) => setKw(e.target.value)}
          className="h-9 min-w-0 flex-1 bg-transparent px-3 text-sm focus:outline-none"
          placeholder="搜索商品、品牌、类目"
          aria-label="搜索商品"
        />
        <button
          type="submit"
          className="h-9 shrink-0 bg-[color:var(--color-primary)] px-4 text-sm text-white hover:opacity-90"
        >
          搜索
        </button>
      </form>
    </div>
  );
}

function FilterCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-medium text-neutral-800">{title}</h3>
      {children}
    </div>
  );
}

function SkeletonSPUCard() {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="flex flex-col gap-2 p-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-5 w-16" />
      </div>
    </div>
  );
}
