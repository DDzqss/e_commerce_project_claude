"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/components/ui/Toast";

const ROLE_LABEL: Record<string, string> = {
  SHOP_OWNER: "店主",
  SHOP_OPERATOR: "运营",
  SHOP_SUPPORT: "客服",
};

/**
 * 右上角商家账号菜单：显示店铺 + 登录名 + 角色 badge；下拉为修改密码 / 退出。
 */
export function AccountMenu() {
  const router = useRouter();
  const { merchantAccount, shop, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  if (!merchantAccount || !shop) {
    return null;
  }

  const roleLabel = ROLE_LABEL[merchantAccount.role] ?? merchantAccount.role;

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    toast.info("已退出登录");
    router.replace("/login");
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-neutral-100"
      >
        <span
          className="max-w-[160px] truncate font-medium text-neutral-800"
          title={shop.name}
        >
          {shop.name}
        </span>
        <span className="text-neutral-300">|</span>
        <span className="max-w-[120px] truncate text-neutral-600">
          {merchantAccount.login_name}
        </span>
        <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-[var(--color-primary)]">
          {roleLabel}
        </span>
        <span aria-hidden className="text-neutral-400">
          ▾
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-1 w-44 overflow-hidden rounded-md border border-neutral-200 bg-white shadow-lg"
        >
          <Link
            role="menuitem"
            href="/account/change-password"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
          >
            修改密码
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
          >
            退出登录
          </button>
        </div>
      ) : null}
    </div>
  );
}
