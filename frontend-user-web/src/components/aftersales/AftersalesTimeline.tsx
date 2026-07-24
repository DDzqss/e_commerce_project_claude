"use client";

import { cn } from "@/lib/cn";
import {
  AFTERSALES_STATUS_LABEL,
  type AftersalesActorType,
  type AftersalesMessage,
  type AftersalesMessageKind,
  type AftersalesStatus,
  type AftersalesStatusHistoryItem,
} from "@/types/aftersales";

interface AftersalesTimelineProps {
  history: AftersalesStatusHistoryItem[];
  messages?: AftersalesMessage[];
  className?: string;
}

type TimelineEntry =
  | {
      kind: "status";
      id: string;
      created_at: string;
      actor_type: AftersalesActorType;
      from_status: string | null;
      to_status: string;
      note: string | null;
    }
  | {
      kind: "message";
      id: string;
      created_at: string;
      actor_type: AftersalesActorType;
      messageKind: AftersalesMessageKind;
      content: string;
    };

/**
 * 售后完整时间轴：合并 status_history + messages，按时间升序排列。
 * actor_type 用不同色徽章：user 蓝 / merchant 绿 / admin 红 / system 灰。
 */
export function AftersalesTimeline({
  history,
  messages = [],
  className,
}: AftersalesTimelineProps) {
  const combined: TimelineEntry[] = [
    ...history.map((h): TimelineEntry => ({
      kind: "status",
      id: `s-${h.id}`,
      created_at: h.created_at,
      actor_type: h.actor_type,
      from_status: h.from_status ? String(h.from_status) : null,
      to_status: String(h.to_status),
      note: h.note,
    })),
    ...messages.map((m): TimelineEntry => ({
      kind: "message",
      id: `m-${m.id}`,
      created_at: m.created_at,
      actor_type: m.sender_type,
      messageKind: m.kind,
      content: m.content,
    })),
  ].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  if (combined.length === 0) {
    return (
      <p className={cn("text-sm text-neutral-500", className)}>暂无进展</p>
    );
  }

  return (
    <ol className={cn("flex flex-col gap-3", className)}>
      {combined.map((e, idx) => {
        const isLast = idx === combined.length - 1;
        return (
          <li
            key={e.id}
            className="flex gap-3"
            data-testid={`timeline-item-${e.kind}-${e.id}`}
          >
            <div className="flex flex-col items-center pt-1.5">
              <span
                className={cn(
                  "h-2.5 w-2.5 rounded-full",
                  isLast
                    ? "bg-[color:var(--color-primary)]"
                    : "bg-neutral-300",
                )}
              />
              {!isLast && (
                <span className="mt-1 h-full w-px bg-neutral-200" />
              )}
            </div>
            <div className="flex-1 pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <ActorBadge actor={e.actor_type} />
                {e.kind === "status" ? (
                  <span className="text-sm text-neutral-800">
                    {statusChangeLabel(e.from_status, e.to_status)}
                  </span>
                ) : (
                  <span className="text-sm text-neutral-800">
                    {messageKindLabel(e.messageKind)}
                  </span>
                )}
              </div>
              {e.kind === "status" && e.note && (
                <p className="mt-1 text-xs text-neutral-600">{e.note}</p>
              )}
              {e.kind === "message" && (
                <p className="mt-1 text-xs text-neutral-600 whitespace-pre-wrap">
                  {e.content}
                </p>
              )}
              <p className="mt-1 text-xs text-neutral-400">
                {formatDateTime(e.created_at)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function ActorBadge({ actor }: { actor: AftersalesActorType }) {
  const map: Record<AftersalesActorType, { label: string; cls: string }> = {
    user: { label: "买家", cls: "bg-blue-50 text-blue-700 border-blue-200" },
    merchant: {
      label: "商家",
      cls: "bg-green-50 text-green-700 border-green-200",
    },
    admin: {
      label: "客服",
      cls: "bg-[color:var(--color-primary-50)] text-[color:var(--color-primary-700)] border-[color:var(--color-primary-200)]",
    },
    system: {
      label: "系统",
      cls: "bg-neutral-100 text-neutral-600 border-neutral-200",
    },
  };
  const cfg = map[actor];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium",
        cfg.cls,
      )}
      data-testid={`timeline-actor-${actor}`}
    >
      {cfg.label}
    </span>
  );
}

function statusChangeLabel(from: string | null, to: string): string {
  const toLabel =
    AFTERSALES_STATUS_LABEL[to as AftersalesStatus] ?? to;
  if (!from) return `售后创建 · ${toLabel}`;
  const fromLabel =
    AFTERSALES_STATUS_LABEL[from as AftersalesStatus] ?? from;
  return `${fromLabel} → ${toLabel}`;
}

function messageKindLabel(kind: AftersalesMessageKind): string {
  switch (kind) {
    case "nudge":
      return "买家催办";
    case "appeal":
      return "买家申诉";
    case "reply":
      return "回复";
    case "system_notice":
      return "系统通知";
    default:
      return kind;
  }
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("zh-CN", { hour12: false });
  } catch {
    return iso;
  }
}
