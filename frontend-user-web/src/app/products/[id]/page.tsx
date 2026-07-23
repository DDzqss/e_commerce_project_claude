"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SPUCard } from "@/components/catalog/SPUCard";
import { SKUSelector } from "@/components/catalog/SKUSelector";
import { BreadcrumbCategory } from "@/components/catalog/BreadcrumbCategory";
import { ImageWithFallback } from "@/components/ui/ImageWithFallback";
import { Price } from "@/components/ui/Price";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { useSPUDetail, useRelatedSPUs } from "@/hooks/useSPUDetail";
import type { SKUOut, SPUDetail } from "@/types/catalog";

/**
 * 商品详情页 /products/[id]
 *
 * 布局：
 *   面包屑（品类路径 + 当前商品）
 *   左：主图 + 缩略图 gallery
 *   右：标题/副标题/价格/销量 + SKUSelector + 数量 + 加入购物车/立即购买（Phase 3 才可用）
 *   下：商品描述（description 简单信任渲染）
 *   下：相关推荐
 */
export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const idNum = Number(params.id);

  const { data, isLoading, isError } = useSPUDetail(
    Number.isFinite(idNum) ? idNum : null,
  );
  const { data: related } = useRelatedSPUs(
    Number.isFinite(idNum) ? idNum : null,
    8,
  );

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-6">
        {isLoading && <DetailSkeleton />}
        {isError && (
          <div className="rounded-lg border border-dashed border-neutral-300 bg-white py-16 text-center text-sm text-neutral-500">
            商品加载失败，可能已下架或不存在
          </div>
        )}
        {data && <DetailBody data={data} />}

        {data && (
          <section className="mt-10">
            <h2 className="mb-3 text-lg font-semibold text-neutral-900">
              相关推荐
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {(related ?? []).map((spu) => (
                <SPUCard key={spu.id} spu={spu} compact />
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}

function DetailBody({ data }: { data: SPUDetail }) {
  const breadcrumb = useMemo(
    () => [
      ...(data.category?.path ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        href: `/category/${p.id}`,
      })),
      { name: data.title },
    ],
    [data],
  );

  const [selectedSku, setSelectedSku] = useState<SKUOut | null>(null);
  const [quantity, setQuantity] = useState(1);
  // 主图/缩略图切换：SKU 图 > 用户点击 > SPU 主图
  const [galleryIndex, setGalleryIndex] = useState(0);

  const gallery = useMemo(() => {
    const list = [data.main_image, ...(data.images ?? [])];
    return list.filter((v, i, arr) => v && arr.indexOf(v) === i);
  }, [data]);

  const shownImage = selectedSku?.image ?? gallery[galleryIndex] ?? data.main_image;

  const displayPriceCents = selectedSku?.price_cents ?? data.min_price_cents;
  const displayOriginalCents = selectedSku?.original_price_cents ?? null;
  const displayMaxCents =
    selectedSku == null && data.max_price_cents > data.min_price_cents
      ? data.max_price_cents
      : null;

  const stock = selectedSku?.stock ?? 0;
  const skuChosen = data.spec_axes.length === 0 || selectedSku !== null;

  return (
    <>
      <BreadcrumbCategory items={breadcrumb} className="mb-4" />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_1.1fr]">
        <div className="flex flex-col gap-3">
          <div className="aspect-square w-full overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
            <ImageWithFallback
              objectKey={shownImage}
              alt={data.title}
              className="h-full w-full"
            />
          </div>
          {gallery.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {gallery.map((img, i) => (
                <button
                  key={img + i}
                  type="button"
                  onClick={() => setGalleryIndex(i)}
                  className={cn(
                    "h-14 w-14 overflow-hidden rounded border",
                    !selectedSku?.image && galleryIndex === i
                      ? "border-[color:var(--color-primary)]"
                      : "border-neutral-200 hover:border-neutral-400",
                  )}
                  aria-label={`预览图 ${i + 1}`}
                >
                  <ImageWithFallback
                    objectKey={img}
                    alt=""
                    className="h-full w-full"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">
              {data.title}
            </h1>
            {data.subtitle && (
              <p className="mt-1 text-sm text-[color:var(--color-primary)]">
                {data.subtitle}
              </p>
            )}
          </div>

          <div className="flex items-center gap-6 text-xs text-neutral-500">
            <span>
              已售{" "}
              <b className="text-neutral-800">
                {data.sales_count.toLocaleString("zh-CN")}
              </b>
            </span>
            <span>
              浏览{" "}
              <b className="text-neutral-800">
                {data.view_count.toLocaleString("zh-CN")}
              </b>
            </span>
            {data.brand && (
              <span>
                品牌 <b className="text-neutral-800">{data.brand.name}</b>
              </span>
            )}
            <span>
              店铺 <b className="text-neutral-800">{data.shop.name}</b>
            </span>
          </div>

          <div className="rounded-lg bg-[color:var(--color-primary-50)] p-4">
            <Price
              cents={displayPriceCents}
              originalCents={displayOriginalCents}
              maxCents={displayMaxCents}
              size="lg"
            />
            {selectedSku && (
              <p className="mt-1 text-xs text-neutral-600">
                {stock > 0 ? `库存 ${stock} 件` : "已售罄"}
              </p>
            )}
          </div>

          {data.spec_axes.length > 0 && (
            <SKUSelector
              specAxes={data.spec_axes}
              skus={data.skus}
              onChange={setSelectedSku}
            />
          )}

          <div className="flex items-center gap-3">
            <span className="text-sm text-neutral-500">数量</span>
            <QuantityInput
              value={quantity}
              onChange={setQuantity}
              max={selectedSku ? stock : undefined}
            />
          </div>

          <div className="mt-2 flex flex-wrap gap-3">
            <button
              type="button"
              disabled
              title="购物车即将开放"
              className="inline-flex h-11 min-w-[10rem] items-center justify-center rounded-md border border-[color:var(--color-primary)] px-6 text-sm font-medium text-[color:var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              加入购物车
            </button>
            <button
              type="button"
              disabled
              title="购物车即将开放"
              className="inline-flex h-11 min-w-[10rem] items-center justify-center rounded-md bg-[color:var(--color-primary)] px-6 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              立即购买
            </button>
            <p className="w-full text-xs text-neutral-400">
              {skuChosen
                ? "购物车即将在 Phase 3 开放，敬请期待"
                : "请先选择商品规格"}
            </p>
          </div>
        </div>
      </div>

      {data.description && (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-semibold text-neutral-900">
            商品描述
          </h2>
          <article
            className="prose prose-sm max-w-none rounded-lg border border-neutral-200 bg-white p-6 text-sm text-neutral-800"
            // Phase 2 契约明确 description 不做 XSS 过滤，商家自负；此处按纯文本/简单富文本渲染
            dangerouslySetInnerHTML={{ __html: data.description }}
          />
        </section>
      )}
    </>
  );
}

function QuantityInput({
  value,
  onChange,
  max,
}: {
  value: number;
  onChange: (n: number) => void;
  max?: number;
}) {
  const clamp = (n: number) => {
    const min = 1;
    const upper = max ?? 999;
    return Math.min(upper, Math.max(min, Math.floor(n)));
  };
  return (
    <div className="inline-flex h-9 items-stretch overflow-hidden rounded border border-neutral-300">
      <button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        disabled={value <= 1}
        className="w-8 text-neutral-700 hover:bg-neutral-100 disabled:opacity-40"
        aria-label="减少数量"
      >
        -
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value.replace(/[^\d]/g, ""));
          if (!Number.isFinite(n) || n <= 0) return onChange(1);
          onChange(clamp(n));
        }}
        className="w-12 border-x border-neutral-300 bg-white text-center text-sm text-neutral-800 focus:outline-none"
        aria-label="数量"
      />
      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        disabled={max !== undefined && value >= max}
        className="w-8 text-neutral-700 hover:bg-neutral-100 disabled:opacity-40"
        aria-label="增加数量"
      >
        +
      </button>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      <Skeleton className="aspect-square w-full" />
      <div className="flex flex-col gap-4">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-10 w-1/3" />
      </div>
    </div>
  );
}
