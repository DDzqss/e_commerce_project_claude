"use client";

/**
 * `/products/[id]/inventory` 独立路由 —— 跳转到主编辑页并选中库存 tab。
 * 说明同 `../skus/page.tsx`。
 */

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ProductInventoryRoute() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/products/${params.id}?tab=inventory`);
  }, [params.id, router]);

  return null;
}
