import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui/Toast";

/**
 * (auth) 路由组布局：登录 / 找回密码等未登录页面共用。
 *
 * 保持极简：管理端登录页刻意不放 Sidebar/Header，突出"平台管理员通道"文案。
 * ToastProvider 在此挂一份，避免登录失败/成功 toast 找不到 provider。
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <div className="flex min-h-screen items-center justify-center bg-[color:var(--color-surface-muted)] px-4">
        {children}
      </div>
    </ToastProvider>
  );
}
