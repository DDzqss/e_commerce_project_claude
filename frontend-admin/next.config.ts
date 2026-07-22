import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // 管理员后台通常部署在内网 / 独立子域名，无需 SEO
  // 后续可增加 basePath: "/admin" 供反向代理复用
  images: {
    // 商家资质图、商品审核图来源域名，后续接入 MinIO / CDN 时补充
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
