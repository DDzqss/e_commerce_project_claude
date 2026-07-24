"use client";

/**
 * 售后时间轴 —— 融合 status_history + messages。
 *
 * - 按时间倒序（最新在上）
 * - actor 徽章颜色区分：user 蓝 / merchant 绿 / admin 紫 / system 灰
 * - 消息可展开（默认收起长文本）
 *
 * 用途：详情页右侧栏 / 后续 admin 侧同款复用。
 */

import { useMemo, useState } from "react";

import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/order-utils";
import {
  ACTOR_LABEL,
  AFTERSALES_STATUS_LABEL,
  MESSAGE_KIND_LABEL,
  type AftersalesActorType,
  type AftersalesMessage,
  type AftersalesStatusHistoryItem,
} from "@/types/aftersales";

// ---------- actor 徽章色 ----------------------------------------------------

const ACTOR_BADGE: Record<AftersalesActorType, string> = {
  user: "bg-blue-50 text-[var(--color-primary)] ring-blue-200",
  merchant: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  admin: "bg-purple-50 text-purple-700 ring-purple-200",
  system: "bg-neutral-100 text-neutral-600 ring-neutral-200",
};

const ACTOR_DOT: Record<AftersalesActorType, string> = {
  user: "bg-[var(--color-primary)]",
  merchant: "bg-emerald-500",
  admin: "bg-purple-500",
  system: "bg-neutral-400",
};

// ---------- 内部统一事件模型 ------------------------------------------------

type TimelineEvent =
  | {
      kind: "status";
      id: string;
      created_at: string;
      actor_type: AftersalesActorType;
      actor_id: number | null;
      note: string | null;
      from_status: string | null;
      to_status: string;
    }
  | {
      kind: "message";
      id: string;
      created_at: string;
      actor_type: AftersalesActorType;
      actor_id: number | null;
      messageKind: AftersalesMessage["kind"];
      content: string;
    };

// 最长直显字符数，超过则折叠
const COLLAPSE_LIMIT = 80;

export interface AftersalesTimelineProps {
  history: AftersalesStatusHistoryItem[];
  messages: AftersalesMessage[];
  className?: string;
}

export function AftersalesTimeline({
  history,
  messages,
  className,
}: AftersalesTimelineProps) {
  const events = useMemo<TimelineEvent[]>(() => {
    const statusEvents: TimelineEvent[] = history.map((h) => ({
      kind: "status" as const,
      id: `s-${h.id}`,
      created_at: h.created_at,
      actor_type: h.actor_type,
      actor_id: h.actor_id,
      note: h.note,
      from_status: h.from_status,
      to_status: h.to_status,
    }));
    const messageEvents: TimelineEvent[] = messages.map((m) => ({
      kind: "message" as const,
      id: `m-${m.id}`,
      created_at: m.created_at,
      actor_type: m.sender_type,
      actor_id: m.sender_id,
      messageKind: m.kind,
      content: m.content,
    }));
    return [...statusEvents, ...messageEvents].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [history, messages]);

  if (events.length === 0) {
    return <p className="text-sm text-neutral-400">暂无历史</p>;
  }

  return (
    <ol className={cn("space-y-3", className)}>
      {events.map((e) => (
        <TimelineRow key={e.id} event={e} />
      ))}
    </ol>
  );
}

function TimelineRow({ event }: { event: TimelineEvent }) {
  const [expanded, setExpanded] = useState(false);
  const badgeCls = ACTOR_BADGE[event.actor_type];
  const dotCls = ACTOR_DOT[event.actor_type];

  return (
    <li className="flex items-start gap-3 text-sm">
      <span
        aria-hidden
        className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", dotCls)}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center rounded px-1.5 py-0.5 text-[11px] ring-1 ring-inset",
              badgeCls,
            )}
          >
            {ACTOR_LABEL[event.actor_type]}
          </span>
          {event.kind === "status" ? (
            <span className="min-w-0 truncate text-neutral-800">
              {event.from_status ? (
                <>
                  <span className="text-neutral-500">
                    {statusLabel(event.from_status)}
                  </span>
                  <span className="mx-1 text-neutral-400">→</span>
                </>
              ) : null}
              <span className="font-medium text-[var(--color-primary)]">
                {statusLabel(event.to_status)}
              </span>
            </span>
          ) : (
            <span className="text-neutral-800">
              [{MESSAGE_KIND_LABEL[event.messageKind]}]
            </span>
          )}
        </div>
        {event.kind === "status" && event.note ? (
          <div className="mt-0.5 text-xs text-neutral-600">{event.note}</div>
        ) : null}
        {event.kind === "message" ? (
          <div className="mt-0.5 text-xs text-neutral-700 whitespace-pre-line">
            {shouldCollapse(event.content) && !expanded
              ? `${event.content.slice(0, COLLAPSE_LIMIT)}…`
              : event.content}
            {shouldCollapse(event.content) ? (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="ml-1 text-[var(--color-primary)] hover:underline"
              >
                {expanded ? "收起" : "展开"}
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="mt-0.5 text-xs text-neutral-400">
          {formatDateTime(event.created_at)}
        </div>
      </div>
    </li>
  );
}

function shouldCollapse(text: string): boolean {
  return text.length > COLLAPSE_LIMIT;
}

function statusLabel(s: string): string {
  return AFTERSALES_STATUS_LABEL[s as keyof typeof AFTERSALES_STATUS_LABEL] ?? s;
}
