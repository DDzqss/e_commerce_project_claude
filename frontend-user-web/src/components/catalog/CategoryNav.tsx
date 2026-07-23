"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { useCategories } from "@/hooks/useCategories";
import type { CategoryTree } from "@/types/catalog";

interface CategoryNavProps {
  className?: string;
  /** 显示的一级类目上限（超出隐藏，"更多"入口预留） */
  maxTopLevel?: number;
}

/**
 * 顶部横向类目导航。
 * 每个一级类目 hover 时弹出二/三级级联菜单。
 * 数据来自 useCategories（5min 缓存）；加载中显示占位。
 */
export function CategoryNav({
  className,
  maxTopLevel = 8,
}: CategoryNavProps) {
  const { data, isLoading } = useCategories();
  const [openId, setOpenId] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div
        className={cn(
          "flex items-center gap-4 overflow-x-auto",
          className,
        )}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-4 w-16 flex-none animate-pulse rounded bg-neutral-200/70"
          />
        ))}
      </div>
    );
  }

  const items = (data ?? [])
    .filter((c) => c.is_visible)
    .slice(0, maxTopLevel);

  if (items.length === 0) return null;

  return (
    <nav className={cn("relative", className)}>
      <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-neutral-700">
        {items.map((cat) => (
          <li
            key={cat.id}
            className="relative"
            onMouseEnter={() => setOpenId(cat.id)}
            onMouseLeave={() => setOpenId(null)}
          >
            <Link
              href={`/category/${cat.id}`}
              className="inline-flex items-center gap-1 py-1 hover:text-[color:var(--color-primary)]"
            >
              {cat.name}
              {cat.children.length > 0 && (
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M6 9l6 6 6-6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </Link>
            {openId === cat.id && cat.children.length > 0 && (
              <CategoryFlyout groups={cat.children} />
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * 二级类目分组浮层。
 * 二级类目名做小标题，其下横排三级类目链接。
 */
function CategoryFlyout({ groups }: { groups: CategoryTree[] }) {
  return (
    <div
      role="menu"
      className="absolute left-0 top-full z-40 mt-1 min-w-[420px] rounded-md border border-neutral-200 bg-white p-4 shadow-lg"
    >
      <ul className="grid grid-cols-2 gap-4">
        {groups.map((group) => (
          <li key={group.id}>
            <Link
              href={`/category/${group.id}`}
              className="block text-sm font-medium text-neutral-800 hover:text-[color:var(--color-primary)]"
            >
              {group.name}
            </Link>
            {group.children.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                {group.children.map((leaf) => (
                  <Link
                    key={leaf.id}
                    href={`/category/${leaf.id}`}
                    className="text-xs text-neutral-500 hover:text-[color:var(--color-primary)]"
                  >
                    {leaf.name}
                  </Link>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
