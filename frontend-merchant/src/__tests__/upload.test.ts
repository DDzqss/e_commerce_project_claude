/**
 * upload.ts 二步流程测试。
 *
 * Mock 策略：
 *   - mock `./upload-api` 的 `presignUpload` 以避免真实 HTTP
 *   - mock 全局 XMLHttpRequest 以模拟 PUT 的成功 / 失败
 *
 * 覆盖：
 *   1. 校验：类型不合法直接 throw，不进 presign
 *   2. 校验：文件超过 5MB 直接 throw
 *   3. happy path：presign + PUT + 返回 object_key
 *   4. PUT 失败：throw 包含 HTTP 状态
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const presignMock = vi.fn();
vi.mock("@/lib/upload-api", () => ({
  presignUpload: (...args: unknown[]) => presignMock(...args),
}));

// 延后 import 以确保 mock 生效
import { uploadFile, validateImageFile } from "@/lib/upload";

// ---- XHR mock ----------------------------------------------------------
interface FakeXHRState {
  status: number;
  autoOpen?: boolean;
}

class FakeXHR {
  static state: FakeXHRState = { status: 200 };

  public upload = { onprogress: null as ((e: ProgressEvent) => void) | null };
  public onload: (() => void) | null = null;
  public onerror: (() => void) | null = null;
  public ontimeout: (() => void) | null = null;
  public onabort: (() => void) | null = null;
  public status = 0;
  private headers: Record<string, string> = {};
  private method = "";
  private url = "";

  open(method: string, url: string): void {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(k: string, v: string): void {
    this.headers[k] = v;
  }
  send(_body: unknown): void {
    void _body;
    setTimeout(() => {
      this.status = FakeXHR.state.status;
      if (this.status >= 200 && this.status < 300) {
        // simulate 50 -> 100 progress
        this.upload.onprogress?.({
          lengthComputable: true,
          loaded: 50,
          total: 100,
        } as unknown as ProgressEvent);
        this.upload.onprogress?.({
          lengthComputable: true,
          loaded: 100,
          total: 100,
        } as unknown as ProgressEvent);
        this.onload?.();
      } else {
        this.onload?.();
      }
    }, 0);
  }
  abort(): void {
    this.onabort?.();
  }
  // introspection helpers
  getMethod(): string {
    return this.method;
  }
  getUrl(): string {
    return this.url;
  }
  getHeaders(): Record<string, string> {
    return this.headers;
  }
}

const originalXHR = globalThis.XMLHttpRequest;

beforeEach(() => {
  presignMock.mockReset();
  FakeXHR.state = { status: 200 };
  // @ts-expect-error test override
  globalThis.XMLHttpRequest = FakeXHR;
});
afterEach(() => {
  globalThis.XMLHttpRequest = originalXHR;
});

// ---- fixtures -----------------------------------------------------------
function mkFile(name: string, type: string, size = 1024): File {
  // 用 Blob 构造带 size 的 File
  const blob = new Blob([new Uint8Array(size)], { type });
  return new File([blob], name, { type });
}

// ---- tests --------------------------------------------------------------

describe("upload.validateImageFile", () => {
  it("拒绝非图片类型", () => {
    const f = mkFile("a.pdf", "application/pdf");
    expect(validateImageFile(f)).toMatch(/JPG.*PNG.*WebP/u);
  });

  it("拒绝超过 5MB 的文件", () => {
    const f = mkFile("big.jpg", "image/jpeg", 6 * 1024 * 1024);
    expect(validateImageFile(f)).toMatch(/5MB/u);
  });

  it("接受合法图片", () => {
    const f = mkFile("ok.png", "image/png", 100);
    expect(validateImageFile(f)).toBeNull();
  });
});

describe("upload.uploadFile", () => {
  it("非法类型不会调用 presign", async () => {
    const f = mkFile("a.pdf", "application/pdf");
    await expect(uploadFile(f, "spu_main")).rejects.toThrow(/JPG/u);
    expect(presignMock).not.toHaveBeenCalled();
  });

  it("happy path：presign + PUT 后返回 object_key", async () => {
    const f = mkFile("ok.jpg", "image/jpeg", 200);
    presignMock.mockResolvedValueOnce({
      object_key: "spu/2026/07/22/abc.jpg",
      upload_url: "http://localhost:9000/jdclone-public/xx?sig=1",
      expires_at: "2026-07-22T10:15:00Z",
      public_url: "http://localhost:9000/jdclone-public/spu/2026/07/22/abc.jpg",
    });

    const progresses: number[] = [];
    const res = await uploadFile(f, "spu_main", {
      onProgress: (p) => progresses.push(p),
    });

    expect(presignMock).toHaveBeenCalledWith({
      purpose: "spu_main",
      content_type: "image/jpeg",
      file_size: 200,
    });
    expect(res.object_key).toBe("spu/2026/07/22/abc.jpg");
    expect(res.public_url).toContain("jdclone-public");
    // 至少一次进度事件
    expect(progresses.length).toBeGreaterThan(0);
    // 最终 100
    expect(progresses[progresses.length - 1]).toBe(100);
  });

  it("PUT 失败时抛出带 HTTP 状态的错误", async () => {
    const f = mkFile("ok.jpg", "image/jpeg", 200);
    presignMock.mockResolvedValueOnce({
      object_key: "k",
      upload_url: "http://x",
      expires_at: "",
      public_url: "http://p",
    });
    FakeXHR.state.status = 403;

    await expect(uploadFile(f, "spu_gallery")).rejects.toThrow(/403/u);
  });
});
