"use client";

import { StatCard } from "@/components/dashboard/StatCard";
import { useAuth } from "@/hooks/useAuth";

const ROLE_LABEL: Record<string, string> = {
  SHOP_OWNER: "店主",
  SHOP_OPERATOR: "运营",
  SHOP_SUPPORT: "客服",
};

export default function DashboardPage() {
  const { merchantAccount, shop } = useAuth();

  const shopName = shop?.name ?? "—";
  const roleLabel = merchantAccount
    ? ROLE_LABEL[merchantAccount.role] ?? merchantAccount.role
    : "";

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

      {/* 4 张统计卡片 —— Phase 1 仅占位 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="待发货订单"
          value={0}
          hint="需在 48 小时内处理"
          tone="warning"
        />
        <StatCard
          label="今日销售额"
          value={0}
          hint="单位：元"
          tone="primary"
        />
        <StatCard
          label="待审核商品"
          value={0}
          hint="平台审核中"
          tone="info"
        />
        <StatCard
          label="待处理售后"
          value={0}
          hint="含退款/退货申请"
          tone="danger"
        />
      </div>

      {/* Phase 提示卡片 */}
      <section className="rounded-lg border border-blue-100 bg-blue-50/60 p-5">
        <h3 className="text-sm font-semibold text-[var(--color-primary)]">
          能力路线图
        </h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-700">
          <li>Phase 1（当前）：账号登录、退出、修改密码、店铺信息维护</li>
          <li>Phase 2：商品上架、编辑与库存管理</li>
          <li>Phase 3：订单接单、发货、售后处理</li>
        </ul>
        <p className="mt-2 text-xs text-neutral-500">
          商品与订单能力将在 Phase 2 / Phase 3 陆续开放，敬请期待。
        </p>
      </section>

      {/* 图表占位（后续接入 recharts） */}
      <section className="rounded-lg border border-neutral-200 bg-white p-6">
        <h3 className="text-base font-medium text-neutral-900">
          近 7 日销售趋势
        </h3>
        <div className="mt-4 flex h-64 items-center justify-center rounded border border-dashed border-neutral-300 text-sm text-neutral-400">
          图表占位（Phase 3 后接入销售数据）
        </div>
      </section>
    </div>
  );
}
