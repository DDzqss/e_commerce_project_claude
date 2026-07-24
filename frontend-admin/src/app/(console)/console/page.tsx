"use client";

/**
 * 管理员工作台首页 (`/console`)。
 *
 * Phase 3 变化：新增订单大盘的 4 张卡片：
 *   1. 今日订单量
 *   2. 今日 GMV
 *   3. 待付款订单数
 *   4. 待发货订单数
 * 保留 Phase 1/2 的 4 张卡片：
 *   5. 待审核商家
 *   6. 待审核商品
 *   7. 已上架商品
 *   8. 类目总数
 *
 * 总计 8 张卡片，两行 4 列布局（≥xl）。
 * 权限缺失的卡片显示 "—"。
 */

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { StatCard } from "@/components/console/StatCard";
import { listMerchantApplications } from "@/lib/merchant-application-api";
import { listAllSPUs } from "@/lib/product-api";
import { listAllCategories } from "@/lib/category-api";
import { countTreeNodes } from "@/components/ui/CategoryTreeEditor";
import { useOrderOverview } from "@/hooks/useOrders";
import { useAftersalesStats } from "@/hooks/useAftersales";
import { usePermission } from "@/hooks/useAuth";

export default function ConsoleHomePage() {
  const canReadApplications = usePermission("admin:merchant_application:read");
  const canReadSPUs = usePermission("admin:spu:read_all");
  const canManageCategory = usePermission("admin:category:manage");
  const canReadOrders = usePermission("admin:order:read_all");
  const canReadAftersales = usePermission("admin:aftersales:read_all");

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

  const orderOverview = useOrderOverview({ enabled: canReadOrders });
  const aftersalesStats = useAftersalesStats({ enabled: canReadAftersales });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">工作台</h1>
          <p className="mt-1 text-sm text-neutral-500">
            平台运行概览。订单数据每 30 秒自动刷新。
          </p>
        </div>
        <span className="rounded border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-500">
          Phase 4
        </span>
      </header>

      {/* Phase 3 · 订单大盘 */}
      <section aria-label="订单大盘">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-neutral-500">
          订单大盘（今日 & 实时）
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {/* 今日订单量 */}
          {canReadOrders ? (
            <Link
              href="/console/orders"
              className="rounded-md transition hover:shadow"
              aria-label="查看今日订单"
            >
              <StatCard
                label="今日订单量"
                value={
                  orderOverview.isLoading
                    ? "…"
                    : orderOverview.isError
                      ? "—"
                      : String(orderOverview.data?.orders_today_count ?? 0)
                }
                hint={
                  orderOverview.isError
                    ? "拉取失败，请稍后刷新"
                    : "今日新建订单数（不含超时取消）"
                }
                tone="info"
              />
            </Link>
          ) : (
            <StatCard
              label="今日订单量"
              value="—"
              hint="您当前无查看权限"
              tone="info"
            />
          )}

          {/* 今日 GMV */}
          {canReadOrders ? (
            <Link
              href="/console/orders?status=paid"
              className="rounded-md transition hover:shadow"
              aria-label="查看今日 GMV"
            >
              <StatCard
                label="今日 GMV"
                value={
                  orderOverview.isLoading
                    ? "…"
                    : orderOverview.isError
                      ? "—"
                      : `¥${(
                          (orderOverview.data?.orders_today_gmv_cents ?? 0) /
                          100
                        ).toLocaleString("zh-CN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}`
                }
                hint="今日已下单总金额（含未支付）"
                tone="success"
              />
            </Link>
          ) : (
            <StatCard
              label="今日 GMV"
              value="—"
              hint="您当前无查看权限"
              tone="success"
            />
          )}

          {/* 待付款订单 */}
          {canReadOrders ? (
            <Link
              href="/console/orders?status=pending_payment"
              className="rounded-md transition hover:shadow"
              aria-label="查看待付款订单"
            >
              <StatCard
                label="待付款订单"
                value={
                  orderOverview.isLoading
                    ? "…"
                    : orderOverview.isError
                      ? "—"
                      : String(orderOverview.data?.pending_payment_count ?? 0)
                }
                hint="30 分钟内未支付的活跃订单"
                tone="warning"
              />
            </Link>
          ) : (
            <StatCard
              label="待付款订单"
              value="—"
              hint="您当前无查看权限"
              tone="warning"
            />
          )}

          {/* 待发货订单 */}
          {canReadOrders ? (
            <Link
              href="/console/orders?status=paid"
              className="rounded-md transition hover:shadow"
              aria-label="查看待发货订单"
            >
              <StatCard
                label="待发货订单"
                value={
                  orderOverview.isLoading
                    ? "…"
                    : orderOverview.isError
                      ? "—"
                      : String(orderOverview.data?.pending_ship_count ?? 0)
                }
                hint="用户已支付、等待商家发货"
                tone="danger"
              />
            </Link>
          ) : (
            <StatCard
              label="待发货订单"
              value="—"
              hint="您当前无查看权限"
              tone="danger"
            />
          )}
        </div>
      </section>

      {/* Phase 1/2 · 商家 & 商品 */}
      <section aria-label="商家与商品">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-neutral-500">
          商家与商品
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {/* 待审核商家 */}
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

          {/* 待审核商品 */}
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

          {/* 已上架商品 */}
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

          {/* 类目总数 */}
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
        </div>
      </section>

      {/* Phase 4 · 售后仲裁 */}
      <section aria-label="售后仲裁">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-neutral-500">
          售后仲裁（实时）
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {/* 待仲裁（红色标注） */}
          {canReadAftersales ? (
            <Link
              href="/console/aftersales?status=admin_arbitrating"
              className="rounded-md transition hover:shadow"
              aria-label="查看待仲裁售后单"
            >
              <StatCard
                label="待仲裁"
                value={
                  aftersalesStats.isLoading
                    ? "…"
                    : aftersalesStats.isError
                      ? "—"
                      : String(
                          aftersalesStats.data?.escalated_pending_count ?? 0,
                        )
                }
                hint="已升级至平台且尚未认领（点击立即处理）"
                tone="danger"
              />
            </Link>
          ) : (
            <StatCard
              label="待仲裁"
              value="—"
              hint="您当前无查看权限"
              tone="danger"
            />
          )}

          {/* 处理中售后 */}
          {canReadAftersales ? (
            <Link
              href="/console/aftersales"
              className="rounded-md transition hover:shadow"
              aria-label="查看处理中售后"
            >
              <StatCard
                label="处理中售后"
                value={
                  aftersalesStats.isLoading
                    ? "…"
                    : aftersalesStats.isError
                      ? "—"
                      : String(aftersalesStats.data?.in_progress_count ?? 0)
                }
                hint="所有非最终态售后单（点击查看）"
                tone="info"
              />
            </Link>
          ) : (
            <StatCard
              label="处理中售后"
              value="—"
              hint="您当前无查看权限"
              tone="info"
            />
          )}

          {/* 待商家审核 */}
          {canReadAftersales ? (
            <Link
              href="/console/aftersales?status=pending_merchant_review"
              className="rounded-md transition hover:shadow"
              aria-label="查看待商家审核售后"
            >
              <StatCard
                label="待商家审核"
                value={
                  aftersalesStats.isLoading
                    ? "…"
                    : aftersalesStats.isError
                      ? "—"
                      : String(aftersalesStats.data?.pending_review_count ?? 0)
                }
                hint="等待商家 72h 内响应；超时自动升级"
                tone="warning"
              />
            </Link>
          ) : (
            <StatCard
              label="待商家审核"
              value="—"
              hint="您当前无查看权限"
              tone="warning"
            />
          )}

          {/* 今日已解决 + 平均解决时长 */}
          {canReadAftersales ? (
            <Link
              href="/console/aftersales"
              className="rounded-md transition hover:shadow"
              aria-label="查看今日已解决售后"
            >
              <StatCard
                label="今日已解决"
                value={
                  aftersalesStats.isLoading
                    ? "…"
                    : aftersalesStats.isError
                      ? "—"
                      : String(aftersalesStats.data?.resolved_today_count ?? 0)
                }
                hint={
                  aftersalesStats.isLoading || aftersalesStats.isError
                    ? "平均解决时长 —"
                    : `平均解决时长 ${(
                        aftersalesStats.data?.avg_resolution_hours ?? 0
                      ).toFixed(1)} h`
                }
                tone="success"
              />
            </Link>
          ) : (
            <StatCard
              label="今日已解决"
              value="—"
              hint="您当前无查看权限"
              tone="success"
            />
          )}
        </div>
      </section>
    </div>
  );
}
