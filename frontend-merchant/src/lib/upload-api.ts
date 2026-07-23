/**
 * 图片上传 presign API（§9.1）。
 *
 * 单独抽出到独立文件是为了让 `upload.ts` 的 XHR 上传步骤能被 mock 且不与业务耦合。
 */

import { api, unwrap } from "./api";
import type { PresignUploadIn, PresignUploadOut } from "@/types/api";

/** `POST /api/v1/merchant/uploads/presign` */
export function presignUpload(
  payload: PresignUploadIn,
): Promise<PresignUploadOut> {
  return unwrap<PresignUploadOut>(
    api.post("v1/merchant/uploads/presign", { json: payload }),
  );
}
