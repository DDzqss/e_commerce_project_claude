"use client";

/**
 * 管理员工作台首页 (`/console`)。
 *
 * Phase 2 变化：
 * - 4 张卡片改为：
 *   1. 待审核商家（沿用 Phase 1，调 GET /admin/merchant-applications?status=pending）
 *   2. 待审核商品（GET /admin/spus?status=pending_review）
 *   3. 已上架商品（GET /admin/spus?status=approved）
 *   4. 类目总数   （GET /admin/categories，计算树节点数）
 * - 待审核商品卡片可点击 → /console/products/review
 * - 权限缺失的卡片显示 "—"
 */

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { StatCard } from "@/components/console/StatCard";
import { listMerchantApplications } from "@/lib/merchant-application-api";
import { listAllSPUs } from "@/lib/product-api";
import { listAllCategories } from "@/lib/category-api";
import { countTreeNodes } from "@/components/ui/CategoryTreeEditor";
import { usePermission } from "@/hooks/useAuth";

export default function ConsoleHomePage() {
  const canReadApplications = usePermission("admin:merchant_application:read");
  const canReadSPUs = usePermission("admin:spu:read_all");
  const canManageCategory = usePermission("admin:category:manage");

  const pendingApplications = useQuery({
    queryKey: ["dashboard", "pending-applications-count"],
    queryFn: () =>
      listMerchantApplications({ status: "pending", page: 1, size: 1 }),
    enabled: canReadApplications,
    staleTime: 30_000,
  });

  const pendingSPUs = useQuery({
    queryKey: ["dashboard", "pending-spus-count"],
    queryFn: () =>
      listAllSPUs({ status: "pending_review", page: 1, size: 1 }),
    enabled: canReadSPUs,
    staleTime: 30_000,
  });

  const approvedSPUs = useQuery({
    queryKey: ["dashboard", "approved-spus-count"],
    queryFn: () => listAllSPUs({ status: "approved", page: 1, size: 1 }),
    enabled: canReadSPUs,
    staleTime: 60_000,
  });

  const categoryTree = useQuery({
    queryKey: ["dashboard", "category-tree"],
    queryFn: listAllCategories,
    enabled: canManageCategory,
    staleTime: 5 * 60_000,
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">工作台</h1>
          <p className="mt-1 text-sm text-neutral-500">
            平台运行概览。数据每 30 秒自动刷新。
          </p>
        </div>
        <span className="rounded border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-500">
          Phase 2
        </span>
      </header>

      <section
        aria-label="核心指标"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {/* 1. 待审核商家 */}
        {canReadApplications ? (
          <Link
            href="/console/merchants/applications?status=pending"
            className="rounded-md transition hover:shadow"
            aria-label="查看待审核商家申请"
          >
            <StatCard
              label="待审核商家"
              value={
                pendingApplications.isLoading
                  ? "…"
                  : pendingApplications.isError
                    ? "—"
                    : String(pendingApplications.data?.total ?? 0)
              }
              hint={
                pendingApplications.isError
                  ? "拉取失败，请稍后刷新"
                  : "商家入驻申请等待处理（点击查看）"
              }
              tone="warning"
            />
          </Link>
        ) : (
          <StatCard
            label="待审核商家"
            value="—"
            hint="您当前无查看权限"
            tone="warning"
          />
        )}

        {/* 2. 待审核商品 */}
        {canReadSPUs ? (
          <Link
            href="/console/products/review?status=pending_review"
            className="rounded-md transition hover:shadow"
            aria-label="查看待审核商品"
          >
            <StatCard
              label="待审核商品"
              value={
                pendingSPUs.isLoading
                  ? "…"
                  : pendingSPUs.isError
                    ? "—"
                    : String(pendingSPUs.data?.total ?? 0)
              }
              hint={
                pendingSPUs.isError
                  ? "拉取失败，请稍后刷新"
                  : "商家提交、待审核的商品数（点击查看）"
              }
              tone="info"
            />
          </Link>
        ) : (
          <StatCard
            label="待审核商品"
            value="—"
            hint="您当前无查看权限"
            tone="info"
          />
        )}

        {/* 3. 已上架商品 */}
        {canReadSPUs ? (
          <Link
            href="/console/products/review?status=approved"
            className="rounded-md transition hover:shadow"
            aria-label="查看已上架商品"
          >
            <StatCard
              label="已上架商品"
              value={
                approvedSPUs.isLoading
                  ? "…"
                  : approvedSPUs.isError
                    ? "—"
                    : String(approvedSPUs.data?.total ?? 0)
              }
              hint="平台在售商品总数"
              tone="success"
            />
          </Link>
        ) : (
          <StatCard
            label="已上架商品"
            value="—"
            hint="您当前无查看权限"
            tone="success"
          />
        )}

        {/* 4. 类目总数 */}
        {canManageCategory ? (
          <Link
            href="/console/catalog/categories"
            className="rounded-md transition hover:shadow"
            aria-label="查看类目管理"
          >
            <StatCard
              label="类目总数"
              value={
                categoryTree.isLoading
                  ? "…"
                  : categoryTree.isError
                    ? "—"
                    : String(countTreeNodes(categoryTree.data ?? []))
              }
              hint="含各级类目（点击管理）"
              tone="default"
            />
          </Link>
        ) : (
          <StatCard
            label="类目总数"
            value="—"
            hint="您当前无查看权限"
            tone="default"
          />
        )}
      </section>

      <section className="rounded-md border border-dashed border-[color:var(--color-border)] bg-white p-6 text-sm text-neutral-500">
        <div className="mb-1 text-neutral-700 font-medium">
          更多能力将在 Phase 3 / Phase 4 开放
        </div>
        <p>
          Phase 3 将上线订单大盘与干预操作，Phase 4 上线售后仲裁台，敬请关注开发规划文档。
        </p>
      </section>
    </div>
  );
}
