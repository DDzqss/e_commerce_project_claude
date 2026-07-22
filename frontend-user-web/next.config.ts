import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // 商品图片来源域名，后续接入 MinIO / CDN 时补充
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.example.com",
      },
    ],
  },
  experimental: {
    // 保留占位，后续按需启用如 typedRoutes、serverActions 等
  },
};

export default nextConfig;
