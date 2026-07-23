import Link from "next/link";
import { cn } from "@/lib/cn";

export interface BreadcrumbItem {
  id?: number | string;
  name: string;
  href?: string;
}

interface BreadcrumbCategoryProps {
  items: BreadcrumbItem[];
  className?: string;
}

/**
 * 通用面包屑，类目页/详情页都用它。
 * 首项固定"首页"→"/"，其后由调用方传入。
 */
export function BreadcrumbCategory({
  items,
  className,
}: BreadcrumbCategoryProps) {
  const merged: BreadcrumbItem[] = [
    { name: "首页", href: "/" },
    ...items,
  ];

  return (
    <nav
      aria-label="breadcrumb"
      className={cn("text-xs text-neutral-500", className)}
    >
      <ol className="flex flex-wrap items-center gap-1">
        {merged.map((it, i) => {
          const isLast = i === merged.length - 1;
          return (
            <li key={`${it.name}-${i}`} className="flex items-center gap-1">
              {it.href && !isLast ? (
                <Link
                  href={it.href}
                  className="hover:text-[color:var(--color-primary)]"
                >
                  {it.name}
                </Link>
              ) : (
                <span
                  className={cn(isLast && "text-neutral-800")}
                  aria-current={isLast ? "page" : undefined}
                >
                  {it.name}
                </span>
              )}
              {!isLast && <span aria-hidden="true">/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
