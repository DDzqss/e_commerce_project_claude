/**
 * Phase 4 · 用户端上传 API（§10.1）。
 *
 * 契约新增：POST /api/v1/user/uploads/presign
 *   - 需要登录用户；用于售后 apply / user_return / appeal 三个 stage 的凭证上传
 *   - purpose 枚举：aftersales_apply / aftersales_user_return / aftersales_appeal / avatar
 *   - 二步流程：前端 → presign → PUT MinIO → 拿 object_key → 提交业务请求
 *
 * 上传步骤（XHR + 进度）复用与商家端相同的思路；两端组件不共享是为了避免
 * 跨 workspace 依赖，保持每个前端 workspace 自洽。
 */

import { apiPost } from "./api";
import type {
  UserPresignUploadIn,
  UserPresignUploadOut,
  UserUploadPurpose,
} from "@/types/aftersales";

/** POST /user/uploads/presign */
export function presignUpload(
  payload: UserPresignUploadIn,
): Promise<UserPresignUploadOut> {
  return apiPost<UserPresignUploadOut, UserPresignUploadIn>(
    "user/uploads/presign",
    payload,
  );
}

/** 允许上传的图片 MIME 类型。 */
export const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

/** 单文件最大字节数（5 MB）。 */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** 上传前的本地校验；通过返回 null。 */
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
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

/**
 * 上传单个文件到 MinIO：presign → PUT → 返回 object_key。
 * 失败一律 throw；调用方 toast 展示 error.message。
 */
export async function uploadFile(
  file: File,
  purpose: UserUploadPurpose,
  options: UploadOptions = {},
): Promise<UploadResult> {
  const validationError = validateImageFile(file);
  if (validationError) throw new Error(validationError);

  const presigned = await presignUpload({
    purpose,
    content_type: file.type,
    file_size: file.size,
  });

  await putToPresignedUrl(presigned.upload_url, file, options);

  return {
    object_key: presigned.object_key,
    public_url: presigned.public_url,
  };
}

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
