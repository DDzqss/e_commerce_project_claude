import { StatCard } from "@/components/dashboard/StatCard";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-neutral-900">店铺看板</h2>
        <p className="mt-1 text-sm text-neutral-500">
          今日核心经营数据一览（当前为占位数据）
        </p>
      </div>

      {/* 4 张统计卡片 */}
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

      {/* 图表占位（后续接入 recharts） */}
      <section className="rounded-lg border border-neutral-200 bg-white p-6">
        <h3 className="text-base font-medium text-neutral-900">
          近 7 日销售趋势
        </h3>
        <div className="mt-4 flex h-64 items-center justify-center rounded border border-dashed border-neutral-300 text-sm text-neutral-400">
          图表占位（后续使用 recharts 接入销售趋势数据）
        </div>
      </section>
    </div>
  );
}
