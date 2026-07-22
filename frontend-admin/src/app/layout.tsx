import type { Metadata, Viewport } from "next";
import { ReactQueryProvider } from "@/lib/query-client";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "JD-Clone · 平台管理后台",
    template: "%s · JD-Clone Admin",
  },
  description:
    "JD-Clone 电商平台管理员后台 —— 商家审核、商品审核、订单大盘、售后仲裁、用户与权限管理、系统日志",
  applicationName: "JD-Clone Admin",
  robots: {
    // 管理后台不对外，不允许被搜索引擎收录
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen bg-[color:var(--color-surface-muted)] text-neutral-900 antialiased">
        <ReactQueryProvider>{children}</ReactQueryProvider>
      </body>
    </html>
  );
}
