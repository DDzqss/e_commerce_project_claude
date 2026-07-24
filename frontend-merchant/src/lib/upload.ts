/**
 * 图片上传工具（§9 二步流程）。
 *
 * 步骤：
 *   1. `POST /merchant/uploads/presign` 拿到 presigned URL + object_key
 *   2. 直接 `PUT` 到 MinIO 上传文件字节
 *   3. 返回 { object_key, public_url } 供业务保存
 *
 * 关键约束：
 *   - 允许类型：image/jpeg | image/png | image/webp
 *   - 大小上限：5 MB（后端还会二次校验）
 *   - 失败必须 throw，让 caller 显示 toast，避免"表单空提交"
 *   - 上传步骤不经 backend 中转，浏览器 -> MinIO
 */

import { presignUpload } from "./upload-api";
import type { PresignUploadOut, UploadPurpose } from "@/types/api";

/** 允许上传的图片 MIME 类型。 */
export const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

/** 单文件最大字节数（5 MB）。 */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * 上传前的本地校验（不依赖后端）。
 * @returns 校验通过时返回 null；否则返回可展示的中文错误文案
 */
export function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return "仅支持 JPG / PNG / WebP 格式图片";
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return "图片大小不能超过 5MB";
  }
  return null;
}

export interface UploadResult {
  object_key: string;
  public_url: string;
}

export interface UploadOptions {
  /**
   * 上传进度回调（0-100 整数）。
   * 使用 XMLHttpRequest 才能拿到进度；fetch 目前不支持。
   */
  onProgress?: (percent: number) => void;
  /** 允许外部中断上传。 */
  signal?: AbortSignal;
}

/**
 * 上传单个文件到 MinIO。
 *
 * 内部使用 XHR 以支持进度回调；presign 阶段仍走 ky（携带 auth）。
 *
 * @throws Error 上传任一环节失败时抛错；message 已中文化
 */
export async function uploadFile(
  file: File,
  purpose: UploadPurpose,
  options: UploadOptions = {},
): Promise<UploadResult> {
  const validationError = validateImageFile(file);
  if (validationError) throw new Error(validationError);

  // 1. 申请 presigned URL
  const presigned: PresignUploadOut = await presignUpload({
    purpose,
    content_type: file.type,
    file_size: file.size,
  });

  // 2. PUT 到 MinIO
  await putToPresignedUrl(presigned.upload_url, file, options);

  // 3. 返回 object_key 供业务保存
  return {
    object_key: presigned.object_key,
    public_url: presigned.public_url,
  };
}

/**
 * 使用 XMLHttpRequest 上传，以便暴露进度事件。
 * MinIO 的 presigned URL 要求裸 body + `Content-Type` 头，不允许任何其他 signed header。
 */
function putToPresignedUrl(
  url: string,
  file: File,
  { onProgress, signal }: UploadOptions,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.setRequestHeader("Content-Type", file.type);

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return;
        const percent = Math.min(
          100,
          Math.floor((e.loaded / e.total) * 100),
        );
        onProgress(percent);
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
      } else {
        reject(new Error(`图片上传失败（HTTP ${xhr.status}），请重试`));
      }
    };
    xhr.onerror = () => reject(new Error("图片上传失败：网络异常"));
    xhr.ontimeout = () => reject(new Error("图片上传超时"));
    xhr.onabort = () => reject(new Error("图片上传已取消"));

    if (signal) {
      if (signal.aborted) {
        xhr.abort();
        reject(new Error("图片上传已取消"));
        return;
      }
      signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }

    xhr.send(file);
  });
}
