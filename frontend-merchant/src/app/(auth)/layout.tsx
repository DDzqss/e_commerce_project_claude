import type { ReactNode } from "react";

/**
 * `(auth)` 路由组的布局：负责渲染登录等无需身份的页面。
 * 与 dashboard 布局并列，不共享 Sidebar/Header。
 */
export default function AuthLayoutGroup({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}
