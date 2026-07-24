"use client";

/**
 * 商家 · 店铺主页管理（Phase 5 §9.3；Phase 1 基础增强）。
 *
 * 布局：
 *   1. 顶部：ShopHomepagePreview（模拟 user 端店铺主页展示）
 *   2. 底部：ShopHomepageEditor（表单，覆盖 logo/banner/announcement/description/联系人/电话）
 *
 * 权限：
 *   - SHOP_OWNER 可编辑；其他角色只读展示（表单 disabled）
 */

import { Skeleton } from "@/components/ui/Skeleton";
import { ShopHomepageEditor } from "@/components/shop/ShopHomepageEditor";
import { ShopHomepagePreview } from "@/components/shop/ShopHomepagePreview";
import { useAuth } from "@/hooks/useAuth";
import { useShopHomepage } from "@/hooks/useShopHomepage";

export default function ShopPage() {
  const { merchantAccount } = useAuth();
  const { shop, isLoading, isError, refetch } = useShopHomepage();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (isError || !shop) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        无法加载店铺信息。
        <button
          type="button"
          className="ml-2 underline"
          onClick={() => refetch()}
        >
          重试
        </button>
      </div>
    );
  }

  const canEdit = merchantAccount?.role === "SHOP_OWNER";

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold text-neutral-900">店铺主页</h2>
        <p className="mt-1 text-sm text-neutral-500">
          维护展示给消费者的店铺形象 · 上方为用户端预览，下方为可编辑表单
        </p>
      </header>

      {/* 预览 */}
      <ShopHomepagePreview shop={shop} />

      {/* 编辑 */}
      <ShopHomepageEditor shop={shop} canEdit={canEdit} />
    </div>
  );
}
