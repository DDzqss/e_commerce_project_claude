"use client";

/**
 * 管理员工作台首页 (`/console`)。
 *
 * Phase 1 变化：
 * - "待审核商家"卡片从 mock 0 改为真实调 GET /admin/merchant-applications?status=pending 取 total
 * - 该卡片可点击 → /console/merchants/applications?status=pending
 * - 其余三张卡片仍为 mock 0（Phase 2/3 接入商品/售后/订单后开放）
 * - 底部提示"更多能力将在 Phase 2/3 开放"
 */

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { StatCard } from "@/components/console/StatCard";
import { listMerchantApplications } from "@/lib/merchant-application-api";
import { usePermission } from "@/hooks/useAuth";

export default function ConsoleHomePage() {
  const canReadApplications = usePermission("admin:merchant_application:read");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard", "pending-applications-count"],
    queryFn: () =>
      listMerchantApplications({ status: "pending", page: 1, size: 1 }),
    enabled: canReadApplications,
    // dashboard 数据更实时
    staleTime: 30_000,
  });

  const pendingCount = data?.total ?? 0;

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
          Phase 1
        </span>
      </header>

      <section
        aria-label="核心指标"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {canReadApplications ? (
          <Link
            href="/console/merchants/applications?status=pending"
            className="rounded-md transition hover:shadow"
            aria-label="查看待审核商家申请"
          >
            <StatCard
              label="待审核商家"
              value={
                isLoading ? "…" : isError ? "—" : String(pendingCount)
              }
              hint={
                isError
                  ? "拉取失败，请稍后刷新"
                  : "商家入驻申请等待业务管理员处理（点击查看）"
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

        <StatCard
          label="待审核商品"
          value={0}
          hint="Phase 2 开放：商家提交、待审核的商品数"
          tone="info"
        />
        <StatCard
          label="待仲裁售后"
          value={0}
          hint="Phase 4 开放：升级到客服的售后单"
          tone="danger"
        />
        <StatCard
          label="今日订单量"
          value={0}
          hint="Phase 3 开放：自然日 0 点至今全平台订单数"
          tone="default"
        />
      </section>

      <section className="rounded-md border border-dashed border-[color:var(--color-border)] bg-white p-6 text-sm text-neutral-500">
        <div className="mb-1 text-neutral-700 font-medium">
          更多能力将在 Phase 2 / Phase 3 开放
        </div>
        <p>
          Phase 1 聚焦「身份认证 + 商家入驻审核」。商品审核、订单大盘、售后仲裁、
          用户/权限管理等模块将在后续 Phase 逐步上线，敬请关注开发规划文档。
        </p>
      </section>
    </div>
  );
}
