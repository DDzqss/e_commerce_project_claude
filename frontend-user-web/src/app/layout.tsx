import type { Metadata, Viewport } from "next";
import { ReactQueryProvider } from "@/lib/query-client";
import { ToastViewport } from "@/components/ui/Toast";
import { BackToTop } from "@/components/ui/BackToTop";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "JD-Clone · 用户中心",
    template: "%s · JD-Clone",
  },
  description: "JD-Clone 电商平台用户端 —— 商品浏览、购物车、下单、售后一站式体验",
  applicationName: "JD-Clone",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#D0211A",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen bg-neutral-50 text-neutral-900 antialiased">
        <ReactQueryProvider>
          {children}
          <BackToTop />
          <ToastViewport />
        </ReactQueryProvider>
      </body>
    </html>
  );
}
