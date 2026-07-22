import type { ReactNode } from "react";

/**
 * (auth) 分组布局：登录/注册/找回/重置密码共用。
 * 不加 <html>/<body>（那是 root layout 的职责）。
 * 页面内部会各自 render <AuthLayout />，本 layout 仅做 pass-through 兼容分组路由。
 */
export default function AuthGroupLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}
