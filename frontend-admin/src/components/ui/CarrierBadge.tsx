"use client";

/**
 * 快递公司 Pill 徽章。
 *
 * 契约 §10.3 商家发货时填 carrier + tracking_no。管理端在订单详情
 * 物流卡片展示；未知代号回退灰色 + 原始文本。
 *
 * Phase 3 支持常见 8 家快递（后端未做枚举校验，前端仅装饰）。
 */

import clsx from "clsx";

interface CarrierMeta {
  code: string;
  label: string;
  tone: "orange" | "yellow" | "red" | "blue" | "green" | "purple" | "sky";
}

const CARRIERS: Record<string, CarrierMeta> = {
  SF: { code: "SF", label: "顺丰速运", tone: "red" },
  YTO: { code: "YTO", label: "圆通速递", tone: "orange" },
  STO: { code: "STO", label: "申通快递", tone: "yellow" },
  ZTO: { code: "ZTO", label: "中通快递", tone: "blue" },
  YD: { code: "YD", label: "韵达快递", tone: "sky" },
  JD: { code: "JD", label: "京东物流", tone: "red" },
  EMS: { code: "EMS", label: "EMS", tone: "green" },
  DBL: { code: "DBL", label: "德邦快递", tone: "purple" },
};

const TONE_CLASS: Record<CarrierMeta["tone"], string> = {
  orange: "bg-orange-50 text-orange-700 border-orange-200",
  yellow: "bg-yellow-50 text-yellow-700 border-yellow-200",
  red: "bg-red-50 text-red-700 border-red-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  green: "bg-green-50 text-green-700 border-green-200",
  purple: "bg-purple-50 text-purple-700 border-purple-200",
  sky: "bg-sky-50 text-sky-700 border-sky-200",
};

export function CarrierBadge({
  carrier,
  className,
}: {
  carrier: string | null | undefined;
  className?: string;
}) {
  if (!carrier) return null;
  const upper = carrier.trim().toUpperCase();
  const meta = CARRIERS[upper];
  const label = meta?.label ?? carrier;
  const tone = meta?.tone;

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        tone
          ? TONE_CLASS[tone]
          : "bg-neutral-50 text-neutral-700 border-neutral-200",
        className,
      )}
      title={`${upper}`}
    >
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 rounded-full bg-current opacity-60"
      />
      {label}
    </span>
  );
}
