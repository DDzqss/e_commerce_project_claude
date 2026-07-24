"use client";

/**
 * ShopHomepagePreview —— 模拟用户端店铺主页顶部展示。
 *
 * 作用：让商家在编辑前后直观看到 Banner / Logo / 名称 / 公告的呈现效果。
 * 视觉贴近 user-web 未来的店铺主页设计（横幅图 + 悬挂 logo + 名称/评分）。
 */

import { imageUrl } from "@/lib/image";
import { cn } from "@/lib/cn";
import type { ShopOut } from "@/types/api";

export interface ShopHomepagePreviewProps {
  shop: ShopOut;
  className?: string;
}

export function ShopHomepagePreview({ shop, className }: ShopHomepagePreviewProps) {
  const rating = typeof shop.rating_avg === "number" ? shop.rating_avg : 5.0;
  const ratingCount = shop.rating_count ?? 0;
  const salesCount = shop.sales_count ?? 0;

  return (
    <section
      aria-label="店铺主页预览"
      className={cn(
        "overflow-hidden rounded-lg border border-neutral-200 bg-white",
        className,
      )}
    >
      <div className="border-b border-neutral-100 bg-neutral-50 px-4 py-2 text-xs text-neutral-500">
        用户端店铺主页预览
      </div>
      {/* Banner */}
      <div className="relative">
        {shop.banner_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl(shop.banner_url)}
            alt="店铺 Banner"
            className="h-40 w-full object-cover"
          />
        ) : (
          <div className="flex h-40 w-full items-center justify-center bg-gradient-to-r from-blue-100 via-blue-50 to-white text-sm text-neutral-400">
            尚未上传 Banner
          </div>
        )}

        {/* Logo 悬挂 */}
        <div className="absolute -bottom-8 left-6">
          <div className="h-16 w-16 overflow-hidden rounded-lg border-4 border-white bg-white shadow-sm">
            {shop.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl(shop.logo_url)}
                alt="店铺 Logo"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-neutral-100 text-xs text-neutral-400">
                LOGO
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 px-6 pb-4 pt-10 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-lg font-semibold text-neutral-900">
              {shop.name}
            </h4>
            {shop.status === "active" ? (
              <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
                运营中
              </span>
            ) : (
              <span className="rounded bg-red-50 px-2 py-0.5 text-[11px] text-red-700">
                已冻结
              </span>
            )}
          </div>
          {shop.description ? (
            <p className="mt-1 max-w-xl text-sm text-neutral-600 line-clamp-2">
              {shop.description}
            </p>
          ) : (
            <p className="mt-1 text-sm text-neutral-400">尚未填写店铺简介</p>
          )}
        </div>
        <div className="flex shrink-0 gap-6 text-center text-xs text-neutral-500">
          <div>
            <div className="text-base font-semibold text-amber-500">
              {rating.toFixed(1)}
            </div>
            <div>综合评分</div>
          </div>
          <div>
            <div className="text-base font-semibold text-neutral-900">
              {ratingCount}
            </div>
            <div>累计评价</div>
          </div>
          <div>
            <div className="text-base font-semibold text-neutral-900">
              {salesCount}
            </div>
            <div>累计销量</div>
          </div>
        </div>
      </div>

      {shop.announcement ? (
        <div className="border-t border-neutral-100 bg-amber-50/50 px-6 py-3 text-sm text-neutral-700">
          <div className="mb-1 text-xs font-medium text-amber-700">店铺公告</div>
          <p className="whitespace-pre-line">{shop.announcement}</p>
        </div>
      ) : null}
    </section>
  );
}
