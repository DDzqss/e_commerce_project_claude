import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // 保留占位，后续按需启用如 typedRoutes、serverActions 等
    // 注意：启用 typedRoutes 需要所有 Link href 使用 Route 类型而非 string
  },
};

export default nextConfig;
