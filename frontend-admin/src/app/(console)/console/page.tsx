import type { Metadata } from "next";
import { StatCard } from "@/components/console/StatCard";

export const metadata: Metadata = {
  title: "工作台",
};

/**
 * 管理员工作台首页占位。
 *
 * Phase 1 前均以 mock 0 数据展示；接入后端后从
 *   GET /api/v1/admin/dashboard/summary
 * 拉取真实指标。
 */
export default function ConsoleHomePage() {
  const stats = [
    {
      label: "待审核商家",
      value: 0,
      hint: "商家入驻申请等待业务管理员处理",
      tone: "warning" as const,
    },
    {
      label: "待审核商品",
      value: 0,
      hint: "商家新提交、待业务管理员审核的商品",
      tone: "info" as const,
    },
    {
      label: "待仲裁售后",
      value: 0,
      hint: "商家超时/买卖双方争议已升级到客服的售后单",
      tone: "danger" as const,
    },
    {
      label: "今日订单量",
      value: 0,
      hint: "自然日 0 点至今全平台已下单的订单数",
      tone: "default" as const,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">工作台</h1>
          <p className="mt-1 text-sm text-neutral-500">
            平台运行概览。数据每 5 分钟刷新一次（占位说明）。
          </p>
        </div>
        <span className="rounded border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-500">
          Phase 0 · 骨架
        </span>
      </header>

      <section
        aria-label="核心指标"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {stats.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            hint={stat.hint}
            tone={stat.tone}
          />
        ))}
      </section>

      <section className="rounded-md border border-neutral-200 bg-white p-6 text-sm text-neutral-500">
        更多模块（订单趋势、售后处理时效、TOP 违规店铺等）将在 Phase 3 / Phase 4
        接入后端数据后陆续上线。
      </section>
    </div>
  );
}
