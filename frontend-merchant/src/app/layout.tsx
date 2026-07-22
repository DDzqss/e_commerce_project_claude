import type { Metadata } from "next";
import "./globals.css";
import { QueryProvider } from "@/lib/query-client";
import { ToastRegion } from "@/components/ui/Toast";

export const metadata: Metadata = {
  title: "商家后台 | JD-Clone",
  description: "JD-Clone 电商平台商家后台管理系统",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-neutral-50 text-neutral-900 antialiased">
        <QueryProvider>
          {children}
          <ToastRegion />
        </QueryProvider>
      </body>
    </html>
  );
}
