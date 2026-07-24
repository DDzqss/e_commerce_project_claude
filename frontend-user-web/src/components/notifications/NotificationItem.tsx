"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import {
  NOTIFICATION_CATEGORY_LABEL,
  type NotificationOut,
} from "@/types/notification";

interface NotificationItemProps {
  notification: NotificationOut;
  onClick?: (n: NotificationOut) => void;
  onDelete?: (n: NotificationOut) => void;
  className?: string;
  /** 是否显示删除按钮（下拉里紧凑不显示，完整页面显示）。 */
  showDelete?: boolean;
  /** 密集样式（下拉里用） */
  compact?: boolean;
}

/**
 * 单条通知渲染。
 *
 * - 未读：左侧红点 + 加粗标题
 * - 点击：调用 onClick（父组件用来 mark-read）；有 action_url 则跳内部路由
 * - 分类 label 以 pill 显示
 */
export function NotificationItem({
  notification,
  onClick,
  onDelete,
  className,
  showDelete = false,
  compact = false,
}: NotificationItemProps) {
  const { title, body, action_url, category, is_read, created_at } = notification;

  const content = (
    <div className="flex min-w-0 flex-1 gap-2">
      <div className="mt-1.5 h-2 w-2 shrink-0">
        {!is_read && (
          <span
            className="block h-2 w-2 rounded-full bg-[color:var(--color-primary)]"
            aria-label="未读"
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "truncate text-sm",
              is_read ? "text-neutral-600" : "font-semibold text-neutral-900",
            )}
          >
            {title}
          </span>
          <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">
            {NOTIFICATION_CATEGORY_LABEL[category] ?? category}
          </span>
        </div>
        {!compact && (
          <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-xs text-neutral-500">
            {body}
          </p>
        )}
        {compact && (
          <p className="mt-0.5 line-clamp-1 whitespace-pre-wrap text-xs text-neutral-500">
            {body}
          </p>
        )}
        <div className="mt-1 text-[11px] text-neutral-400">
          {formatDateTime(created_at)}
        </div>
      </div>
    </div>
  );

  const inner = (
    <div
      className={cn(
        "flex items-start justify-between gap-2 px-3 py-2 hover:bg-neutral-50",
        !is_read && "bg-[color:var(--color-primary-50)]/40",
        className,
      )}
    >
      {content}
      {showDelete && onDelete && (
        <button
          type="button"
          className="shrink-0 rounded p-1 text-xs text-neutral-400 hover:bg-neutral-100 hover:text-[color:var(--color-primary)]"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete(notification);
          }}
          aria-label="删除通知"
        >
          删除
        </button>
      )}
    </div>
  );

  if (action_url) {
    return (
      <Link
        href={action_url}
        onClick={() => onClick?.(notification)}
        className="block"
        data-testid={`notification-item-${notification.id}`}
      >
        {inner}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onClick?.(notification)}
      className="block w-full text-left"
      data-testid={`notification-item-${notification.id}`}
    >
      {inner}
    </button>
  );
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("zh-CN", { hour12: false });
  } catch {
    return iso;
  }
}
