/**
 * 图片上传 API（MinIO Presigned URL）。
 *
 * 契约 §9 三步流程：
 *   1. POST /admin/uploads/presign  → 拿 object_key + upload_url
 *   2. PUT  {upload_url}            → 直传文件字节
 *   3. 把 object_key 塞进业务字段（category.icon_url / brand.logo_url ...）
 *
 * 注意：本 Phase Admin 侧主要上传类目 icon 与品牌 logo。
 * 契约 §9 中 `POST /api/v1/merchant/uploads/presign` 是商家端；Admin 侧使用平行
 * 端点 `POST /api/v1/admin/uploads/presign`（后端若沿用同一路径也可通过 X-Client
 * 与 JWT 分辨；若后端未实现 admin 版本，本文件的 uploadPresign 需 fallback 到
 * merchant 端点——此处默认后端已提供 admin 版）。
 */

import ky from "ky";
import { apiPost, ApiError } from "@/lib/api";
import type {
  PresignRequestPayload,
  PresignResponse,
  UploadPurpose,
} from "@/types/api";

/** 允许的图片 MIME（前端 accept 一并限制）*/
const ALLOWED_MIME: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

/** 单文件最大字节数：5MB */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * 前端预校验：类型 & 大小。命中返回中文提示，未命中返回 null。
 */
export function validateImage(file: File): string | null {
  if (!ALLOWED_MIME.includes(file.type)) {
    return "仅支持 JPG / PNG / WebP 格式的图片";
  }
  if (file.size > MAX_FILE_SIZE) {
    return "图片大小不得超过 5MB";
  }
  return null;
}

/**
 * POST /admin/uploads/presign
 * 权限：admin:category:manage 或 admin:brand:manage（后端按 purpose 决定）
 */
export function requestPresign(
  payload: PresignRequestPayload,
): Promise<PresignResponse> {
  return apiPost<PresignResponse, PresignRequestPayload>(
    "admin/uploads/presign",
    payload,
  );
}

/**
 * PUT 直传 MinIO。使用独立的 ky 实例，避免 admin api 的 Authorization header
 * 干扰 MinIO 的签名校验；presigned URL 已含签名参数，不需要额外鉴权头。
 */
export async function uploadToPresignedUrl(
  uploadUrl: string,
  file: File,
): Promise<void> {
  await ky.put(uploadUrl, {
    body: file,
    headers: { "Content-Type": file.type },
    timeout: 60_000,
    retry: 0,
  });
}

/**
 * 高层封装：presign + PUT 直传 → 返回业务字段用的 object_key。
 *
 * 使用示例：
 *   const key = await uploadImage(file, "category_icon");
 *   await createCategory({ ..., icon_url: key });
 *
 * 抛错策略：
 * - 前端校验失败 → Error("...")
 * - presign 业务失败 → 抛 ApiError（含 code / message）
 * - 直传失败      → 抛 HTTPError（ky 原生）
 */
export async function uploadImage(
  file: File,
  purpose: UploadPurpose,
): Promise<string> {
  const invalid = validateImage(file);
  if (invalid) {
    throw new ApiError(10001, invalid);
  }
  const presign = await requestPresign({
    purpose,
    content_type: file.type,
    file_size: file.size,
  });
  await uploadToPresignedUrl(presign.upload_url, file);
  return presign.object_key;
}
