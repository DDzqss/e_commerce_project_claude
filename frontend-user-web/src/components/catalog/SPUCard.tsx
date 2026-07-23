import Link from "next/link";
import { cn } from "@/lib/cn";
import { ImageWithFallback } from "@/components/ui/ImageWithFallback";
import { Price } from "@/components/ui/Price";
import type { SPUListItem } from "@/types/catalog";

interface SPUCardProps {
  spu: SPUListItem;
  /** 简洁模式：不展示销量与副标题（用于狭窄推荐位） */
  compact?: boolean;
  className?: string;
}

/**
 * 商品卡片：主图 + 标题 + 副标题 + 价格 + 销量。
 * 整卡可点击跳转 /products/{id}。
 */
export function SPUCard({ spu, compact, className }: SPUCardProps) {
  return (
    <Link
      href={`/products/${spu.id}`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
        className,
      )}
    >
      <div className="aspect-square w-full overflow-hidden bg-neutral-100">
        <ImageWithFallback
          objectKey={spu.main_image}
          alt={spu.title}
          className="h-full w-full transition-transform duration-300 group-hover:scale-[1.03]"
          loading="lazy"
        />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3
          className="line-clamp-2 text-sm text-neutral-800 group-hover:text-[color:var(--color-primary)]"
          title={spu.title}
        >
          {spu.title}
        </h3>
        {!compact && spu.subtitle && (
          <p className="line-clamp-1 text-xs text-neutral-500">
            {spu.subtitle}
          </p>
        )}
        <div className="mt-1 flex items-baseline justify-between">
          <Price
            cents={spu.min_price_cents}
            maxCents={spu.max_price_cents}
            size="sm"
          />
          {!compact && (
            <span className="text-xs text-neutral-400">
              已售 {spu.sales_count.toLocaleString("zh-CN")}
            </span>
          )}
        </div>
        {spu.brand && (
          <span className="mt-1 inline-flex w-fit rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">
            {spu.brand.name}
          </span>
        )}
      </div>
    </Link>
  );
}
