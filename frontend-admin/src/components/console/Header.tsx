import { ADMIN_ROLE_META, AdminRole } from "@/lib/rbac";

interface HeaderProps {
  userName: string;
  role: AdminRole;
}

/**
 * 顶部 Header。
 *
 * 结构：面包屑占位（左） · 全局操作占位（中） · 用户名 + 角色 Badge（右）
 * 高度固定 56px，与 Sidebar 顶部 logo 对齐。
 */
export function Header({ userName, role }: HeaderProps) {
  const meta = ADMIN_ROLE_META[role];

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-[color:var(--color-border)] bg-white px-6">
      <div className="text-sm text-neutral-500">
        {/* Phase 1 起接入面包屑 */}
        平台管理后台
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm text-neutral-700" aria-label="当前登录用户">
          {userName}
        </span>
        <RoleBadge role={role} label={meta.label} tone={meta.tone} />
      </div>
    </header>
  );
}

function RoleBadge({
  label,
  tone,
}: {
  role: AdminRole;
  label: string;
  tone: "primary" | "info" | "warning" | "danger";
}) {
  const toneClass: Record<typeof tone, string> = {
    primary:
      "bg-[color:var(--color-primary-100)] text-[color:var(--color-primary-800)] border-[color:var(--color-primary-200)]",
    info: "bg-blue-50 text-blue-700 border-blue-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    danger:
      "bg-[color:var(--color-danger-soft)] text-[color:var(--color-danger)] border-red-200",
  };

  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${toneClass[tone]}`}
      aria-label={`当前角色：${label}`}
    >
      {label}
    </span>
  );
}
