"use client";

/**
 * `/products/[id]/skus` 独立路由 —— 直接跳转到主编辑页并选中 SKU tab。
 *
 * 由于 SKU 管理在同一屏内以 tab 形式提供更好的联动体验，本路由仅作为
 * 深链兼容层：跳转到 /products/{id}?tab=skus。
 */

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ProductSKUsRoute() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/products/${params.id}?tab=skus`);
  }, [params.id, router]);

  return null;
}
