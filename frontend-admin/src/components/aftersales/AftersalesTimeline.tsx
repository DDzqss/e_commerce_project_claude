"use client";

/**
 * 售后 Timeline（状态历史 + 消息 混合流）。
 *
 * 契约 §4.3 / §4.5：
 * - AftersalesStatusHistory：状态流转（actor_type ∈ user/merchant/admin/system）
 * - AftersalesMessage：kind ∈ nudge / appeal / reply / system_notice
 *
 * 视觉规则（Phase 3 已建立 actor 徽章色 + Phase 4 补 system_notice）：
 * - actor_type=user     蓝
 * - actor_type=merchant 绿
 * - actor_type=admin    红
 * - actor_type=system   灰
 * - message kind='system_notice' 灰色斜体（用于系统通知条目）
 *
 * 组件同时接受 histories + messages，按 created_at 合并排序后统一渲染。
 */

import { Fragment } from "react";
import clsx from "clsx";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { getAftersalesStatusLabel } from "./AftersalesStatusBadge";
import type {
  AftersalesActorType,
  AftersalesMessageOut,
  AftersalesStatusHistoryOut,
} from "@/types/aftersales";

const ACTOR_META: Record<
  AftersalesActorType,
  { tone: BadgeTone; label: string; dotClass: string }
> = {
  system: {
    tone: "default",
    label: "系统",
    dotClass: "bg-neutral-300",
  },
  user: {
    tone: "info",
    label: "用户",
    dotClass: "bg-blue-500",
  },
  merchant: {
    tone: "success",
    label: "商家",
    dotClass: "bg-[color:var(--color-success)]",
  },
  admin: {
    tone: "danger",
    label: "管理员",
    dotClass: "bg-[color:var(--color-danger)]",
  },
};

const MESSAGE_KIND_LABEL: Record<AftersalesMessageOut["kind"], string> = {
  nudge: "催办",
  appeal: "申诉",
  reply: "回复",
  system_notice: "系统通知",
};

type TimelineNode =
  | { kind: "history"; at: number; history: AftersalesStatusHistoryOut }
  | { kind: "message"; at: number; message: AftersalesMessageOut };

export interface AftersalesTimelineProps {
  histories: readonly AftersalesStatusHistoryOut[];
  messages?: readonly AftersalesMessageOut[];
  /** 是否隐藏内部消息（例如客服 note，仅在需要精简展示时启用） */
  hideInternalNotes?: boolean;
  emptyText?: string;
}

export function AftersalesTimeline({
  histories,
  messages = [],
  hideInternalNotes = false,
  emptyText = "暂无历史记录",
}: AftersalesTimelineProps) {
  const nodes: TimelineNode[] = [];

  for (const h of histories) {
    nodes.push({
      kind: "history",
      at: new Date(h.created_at).getTime(),
      history: h,
    });
  }
  for (const m of messages) {
    if (hideInternalNotes && m.kind === "reply" && m.sender_type === "admin") {
      continue;
    }
    nodes.push({
      kind: "message",
      at: new Date(m.created_at).getTime(),
      message: m,
    });
  }

  nodes.sort((a, b) => a.at - b.at);

  if (nodes.length === 0) {
    return <div className="text-xs text-neutral-400">{emptyText}</div>;
  }

  return (
    <ul className="flex flex-col gap-3 text-sm">
      {nodes.map((n, i) => (
        <Fragment key={`${n.kind}-${nodeId(n)}`}>
          {n.kind === "history" ? (
            <HistoryItem history={n.history} last={i === nodes.length - 1} />
          ) : (
            <MessageItem message={n.message} last={i === nodes.length - 1} />
          )}
        </Fragment>
      ))}
    </ul>
  );
}

function nodeId(n: TimelineNode): string | number {
  return n.kind === "history" ? `h${n.history.id}` : `m${n.message.id}`;
}

function HistoryItem({
  history,
  last,
}: {
  history: AftersalesStatusHistoryOut;
  last: boolean;
}) {
  const meta = ACTOR_META[history.actor_type];
  const from = history.from_status
    ? getAftersalesStatusLabel(history.from_status)
    : "（初始）";
  const to = getAftersalesStatusLabel(history.to_status);
  return (
    <li className="flex gap-3">
      <span className="flex flex-col items-center">
        <span
          aria-hidden
          className={clsx("mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full", meta.dotClass)}
        />
        {!last ? (
          <span aria-hidden className="mt-1 w-px flex-1 bg-neutral-200" />
        ) : null}
      </span>
      <div className="flex-1 pb-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge tone={meta.tone}>{meta.label}</Badge>
            <span className="text-sm text-neutral-800">
              {from} → <span className="font-medium">{to}</span>
            </span>
          </div>
          <span className="text-xs text-neutral-400 tabular-nums">
            {formatDateTime(history.created_at)}
          </span>
        </div>
        <div className="mt-0.5 text-xs text-neutral-500">
          {history.actor_display_name
            ? history.actor_display_name
            : history.actor_id
              ? `${meta.label} #${history.actor_id}`
              : meta.label}
          {history.note ? (
            <span className="ml-2 rounded bg-neutral-50 px-1.5 py-0.5 text-[11px] text-neutral-700">
              {history.note}
            </span>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function MessageItem({
  message,
  last,
}: {
  message: AftersalesMessageOut;
  last: boolean;
}) {
  const meta = ACTOR_META[message.sender_type];
  const isSystemNotice = message.kind === "system_notice";
  return (
    <li className="flex gap-3">
      <span className="flex flex-col items-center">
        <span
          aria-hidden
          className={clsx(
            "mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full",
            isSystemNotice ? "bg-neutral-300" : meta.dotClass,
          )}
        />
        {!last ? (
          <span aria-hidden className="mt-1 w-px flex-1 bg-neutral-200" />
        ) : null}
      </span>
      <div className="flex-1 pb-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge tone={isSystemNotice ? "default" : meta.tone}>
              {meta.label}
            </Badge>
            <span className="text-xs uppercase tracking-wide text-neutral-500">
              {MESSAGE_KIND_LABEL[message.kind]}
            </span>
          </div>
          <span className="text-xs text-neutral-400 tabular-nums">
            {formatDateTime(message.created_at)}
          </span>
        </div>
        <p
          className={clsx(
            "mt-0.5 whitespace-pre-wrap text-sm",
            isSystemNotice
              ? "italic text-neutral-500"
              : "text-neutral-800",
          )}
        >
          {message.content}
        </p>
      </div>
    </li>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}
