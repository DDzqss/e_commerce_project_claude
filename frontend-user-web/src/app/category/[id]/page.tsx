"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { useCategories } from "@/hooks/useCategories";
import { useSPUList } from "@/hooks/useSPUList";
import type { CategoryTree, SPUSort } from "@/types/catalog";

/**
 * 类目页 /category/[id]
 *
 * 布局：
 *   左侧：面包屑 + 侧栏筛选（品牌 checkbox / 价格区间 / 排序）
 *   右侧（主区）：商品列表 + 分页
 *
 * 筛选逻辑：
 *   - 排序默认 "default"
 *   - 品牌可多选，但契约 §11.2 只支持单 brand_id，本 Phase 单选（后续 Phase 8 再扩展）
 *   - URL 参数无关的本地状态即可；后续可再做 URL 同步
 */
export default function CategoryPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const categoryId = Number(params.id);

  const [page, setPage] = useState(1);
  const [size] = useState(20);
  const [sort, setSort] = useState<SPUSort>("default");
  const [brandId, setBrandId] = useState<number | undefined>(undefined);
  const [priceRange, setPriceRange] = useState<{
    minCents?: number;
    maxCents?: number;
  }>({});

  const { data: categoryTree } = useCategories();
  const { data: brands } = useBrands();

  const breadcrumb = useMemo<BreadcrumbItem[]>(
    () => buildCategoryBreadcrumb(categoryTree ?? [], categoryId),
    [categoryTree, categoryId],
  );

  const listQuery = {
    category_id: Number.isFinite(categoryId) ? categoryId : undefined,
    brand_id: brandId,
    min_price_cents: priceRange.minCents,
    max_price_cents: priceRange.maxCents,
    sort,
    page,
    size,
  };

  const { data, isLoading, isError, refetch } = useSPUList(listQuery);

  const resetFilters = () => {
    setBrandId(undefined);
    setPriceRange({});
    setSort("default");
    setPage(1);
    router.replace(`/category/${categoryId}`);
  };

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-6">
        <BreadcrumbCategory items={breadcrumb} className="mb-4" />

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

            <button
              type="button"
              onClick={resetFilters}
              className="text-xs text-neutral-500 hover:text-[color:var(--color-primary)]"
            >
              重置全部筛选
            </button>
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
                  共 {data.total} 件商品
                </span>
              )}
            </div>

            {isError && (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-neutral-300 bg-white py-12 text-sm text-neutral-500">
                商品加载失败
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
                没有匹配的商品，试试其它筛选条件？
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
      </main>
    </>
  );
}

/**
 * 在类目树中定位到目标 ID，构建从一级到当前节点的面包屑。
 */
function buildCategoryBreadcrumb(
  tree: CategoryTree[],
  targetId: number,
): BreadcrumbItem[] {
  const trail: BreadcrumbItem[] = [];
  function dfs(nodes: CategoryTree[]): boolean {
    for (const n of nodes) {
      trail.push({ id: n.id, name: n.name, href: `/category/${n.id}` });
      if (n.id === targetId) return true;
      if (n.children.length > 0 && dfs(n.children)) return true;
      trail.pop();
    }
    return false;
  }
  dfs(tree);
  return trail;
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
