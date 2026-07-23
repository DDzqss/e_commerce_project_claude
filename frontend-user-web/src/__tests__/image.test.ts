import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PLACEHOLDER, getImageCdn, imageUrl } from "@/lib/image";

// process.env 只读 → 直接改，vitest 会在文件级隔离
const ORIGINAL_ENV = { ...process.env };

describe("imageUrl", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    // 恢复初始 env，避免用例之间串
    for (const k of Object.keys(process.env)) {
      if (!(k in ORIGINAL_ENV)) delete (process.env as Record<string, string>)[k];
    }
    Object.assign(process.env, ORIGINAL_ENV);
  });

  it("objectKey 为 null 时返回默认占位图", () => {
    expect(imageUrl(null)).toBe(DEFAULT_PLACEHOLDER);
  });

  it("objectKey 为 undefined 时返回默认占位图", () => {
    expect(imageUrl(undefined)).toBe(DEFAULT_PLACEHOLDER);
  });

  it("objectKey 为空字符串返回默认占位图", () => {
    expect(imageUrl("   ")).toBe(DEFAULT_PLACEHOLDER);
  });

  it("允许自定义 fallback", () => {
    expect(imageUrl(null, "/custom.png")).toBe("/custom.png");
  });

  it("拼接 NEXT_PUBLIC_IMAGE_CDN 前缀", () => {
    process.env.NEXT_PUBLIC_IMAGE_CDN = "http://cdn.example.com/bucket";
    expect(imageUrl("spu/xxx.jpg")).toBe(
      "http://cdn.example.com/bucket/spu/xxx.jpg",
    );
  });

  it("env 未设置时回落到本地 MinIO 地址", () => {
    delete process.env.NEXT_PUBLIC_IMAGE_CDN;
    expect(imageUrl("spu/x.jpg")).toBe(
      "http://localhost:9000/jdclone-public/spu/x.jpg",
    );
  });

  it("去掉 CDN 尾部斜杠避免 双斜杠", () => {
    process.env.NEXT_PUBLIC_IMAGE_CDN = "http://cdn.example.com/bucket/";
    expect(imageUrl("spu/x.jpg")).toBe(
      "http://cdn.example.com/bucket/spu/x.jpg",
    );
  });

  it("站内绝对路径（以 / 开头）视为已完整，不再拼 CDN", () => {
    process.env.NEXT_PUBLIC_IMAGE_CDN = "http://cdn.example.com/bucket";
    // 后端契约里 object_key 不会以 / 开头；如果传了 /xxx.svg 视为站内静态资源保留原样，
    // 方便 <ImageWithFallback src="/placeholder.svg"> 这类用法。
    expect(imageUrl("/spu/x.jpg")).toBe("/spu/x.jpg");
  });

  it("绝对 URL 原样返回，不再拼前缀", () => {
    process.env.NEXT_PUBLIC_IMAGE_CDN = "http://cdn.example.com/bucket";
    expect(imageUrl("https://other.example.com/a.jpg")).toBe(
      "https://other.example.com/a.jpg",
    );
  });

  it("站内绝对路径原样返回", () => {
    expect(imageUrl("/local.png")).toBe("/local.png");
  });

  it("getImageCdn 返回归一化的 CDN（去尾斜杠）", () => {
    process.env.NEXT_PUBLIC_IMAGE_CDN = "http://cdn.example.com/bucket///";
    expect(getImageCdn()).toBe("http://cdn.example.com/bucket");
  });
});
