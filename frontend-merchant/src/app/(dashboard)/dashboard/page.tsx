"use client";

import Link from "next/link";

import { StatCard } from "@/components/dashboard/StatCard";
import { useAuth } from "@/hooks/useAuth";
import { useMerchantOrderStats } from "@/hooks/useMerchantOrders";
import { formatCentsCny } from "@/lib/order-utils";

const ROLE_LABEL: Record<string, string> = {
  SHOP_OWNER: "店主",
  SHOP_OPERATOR: "运营",
  SHOP_SUPPORT: "客服",
};

export default function DashboardPage() {
  const { merchantAccount, shop } = useAuth();
  const statsQuery = useMerchantOrderStats();

  const shopName = shop?.name ?? "—";
  const roleLabel = merchantAccount
    ? ROLE_LABEL[merchantAccount.role] ?? merchantAccount.role
    : "";

  const s = statsQuery.data;

  return (
    <div className="space-y-6">
      {/* 欢迎区 */}
      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="text-xl font-semibold text-neutral-900">
          {shopName}，欢迎回来
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          当前身份：{roleLabel || "商家账号"}。请遵守平台经营规范。
        </p>
      </section>

      {/* 4 张统计卡片 —— Phase 3 接入订单 stats/summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link href="/orders" className="block hover:opacity-90">
          <StatCard
            label="待发货订单"
            value={s?.paid_pending_ship_count ?? (statsQuery.isLoading ? "…" : "—")}
            hint="需在 48 小时内处理"
            tone="warning"
          />
        </Link>
        <StatCard
          label="今日成交额"
          value={s ? formatCentsCny(s.revenue_today_cents) : statsQuery.isLoading ? "…" : "—"}
          hint={s ? `今日完成 ${s.completed_today_count} 单` : "从今日 0 时起累计"}
          tone="primary"
        />
        <Link href="/orders?status=pending_payment" className="block hover:opacity-90">
          <StatCard
            label="待付款订单"
            value={s?.pending_payment_count ?? (statsQuery.isLoading ? "…" : "—")}
            hint="用户尚未完成支付"
            tone="info"
          />
        </Link>
        <StatCard
          label="待处理售后"
          value={0}
          hint="Phase 4 开放"
          tone="danger"
        />
      </div>

      {/* Phase 提示卡片 */}
      <section className="rounded-lg border border-blue-100 bg-blue-50/60 p-5">
        <h3 className="text-sm font-semibold text-[var(--color-primary)]">
          能力路线图
        </h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-700">
          <li>Phase 1：账号登录、退出、修改密码、店铺信息维护</li>
          <li>Phase 2：商品上架、编辑与库存管理</li>
          <li>Phase 3（当前）：订单接单、发货、缺货取消、备注</li>
          <li>Phase 4：售后 / 退款 / 换货</li>
        </ul>
      </section>

      {/* 图表占位（后续接入 recharts） */}
      <section className="rounded-lg border border-neutral-200 bg-white p-6">
        <h3 className="text-base font-medium text-neutral-900">
          近 7 日销售趋势
        </h3>
        <div className="mt-4 flex h-64 items-center justify-center rounded border border-dashed border-neutral-300 text-sm text-neutral-400">
          图表占位（后续 Phase 接入销售数据）
        </div>
      </section>
    </div>
  );
}
