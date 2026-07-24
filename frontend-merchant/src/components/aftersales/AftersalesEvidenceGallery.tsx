"use client";

/**
 * 售后凭证画廊 —— 按 stage 分组展示图片。
 *
 * 只读展示；上传凭证在各 Modal 中就地完成。
 */

import { cn } from "@/lib/cn";
import { imageUrl } from "@/lib/image";
import { formatDateTime } from "@/lib/order-utils";
import {
  ACTOR_LABEL,
  EVIDENCE_STAGE_LABEL,
  type AftersalesEvidence,
  type AftersalesEvidenceStage,
} from "@/types/aftersales";

const STAGE_ORDER: AftersalesEvidenceStage[] = [
  "apply",
  "merchant_review",
  "user_return",
  "merchant_receive",
  "exchange_ship",
  "appeal",
  "arbitration",
];

export interface AftersalesEvidenceGalleryProps {
  evidences: AftersalesEvidence[];
  className?: string;
}

export function AftersalesEvidenceGallery({
  evidences,
  className,
}: AftersalesEvidenceGalleryProps) {
  const grouped = groupByStage(evidences);
  const stagesInOrder = STAGE_ORDER.filter((s) => grouped[s]?.length);

  if (stagesInOrder.length === 0) {
    return (
      <section
        className={cn(
          "rounded-lg border border-neutral-200 bg-white p-5",
          className,
        )}
      >
        <h3 className="mb-2 text-sm font-semibold text-neutral-900">凭证</h3>
        <p className="text-sm text-neutral-400">暂无凭证图片</p>
      </section>
    );
  }

  return (
    <section
      className={cn(
        "rounded-lg border border-neutral-200 bg-white p-5",
        className,
      )}
    >
      <h3 className="mb-3 text-sm font-semibold text-neutral-900">
        凭证 · {evidences.length} 张
      </h3>
      <div className="space-y-4">
        {stagesInOrder.map((stage) => {
          const list = grouped[stage] ?? [];
          return (
            <div key={stage}>
              <div className="mb-2 text-xs font-medium text-neutral-600">
                {EVIDENCE_STAGE_LABEL[stage]}
              </div>
              <div className="flex flex-wrap gap-2">
                {list.map((ev) => (
                  <a
                    key={ev.id}
                    href={imageUrl(ev.image_url)}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="group relative block h-24 w-24 overflow-hidden rounded-md border border-neutral-200 bg-neutral-50"
                    title={buildTitle(ev)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl(ev.image_url)}
                      alt={ev.note ?? EVIDENCE_STAGE_LABEL[stage]}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                    <span className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-1 py-0.5 text-[10px] text-white">
                      {ACTOR_LABEL[ev.uploader_type]}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function groupByStage(
  list: AftersalesEvidence[],
): Partial<Record<AftersalesEvidenceStage, AftersalesEvidence[]>> {
  const map: Partial<Record<AftersalesEvidenceStage, AftersalesEvidence[]>> = {};
  for (const it of list) {
    if (!map[it.stage]) map[it.stage] = [];
    map[it.stage]!.push(it);
  }
  return map;
}

function buildTitle(ev: AftersalesEvidence): string {
  const parts = [
    ACTOR_LABEL[ev.uploader_type],
    formatDateTime(ev.created_at),
  ];
  if (ev.note) parts.push(ev.note);
  return parts.join(" · ");
}
