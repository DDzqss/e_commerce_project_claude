"use client";

import type { ReactNode } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  /** 描述内容；string 会渲染成段落，也可传自定义 JSX。 */
  description?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  /** 危险操作（红色按钮）；默认 false。 */
  danger?: boolean;
  /** 处理中禁用按钮。 */
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

/**
 * 二次确认弹窗。
 *
 * 用法：
 *   <ConfirmModal
 *     open={showCancel}
 *     title="确认取消订单？"
 *     description="订单取消后不可恢复，库存会自动释放。"
 *     danger
 *     onConfirm={handleCancel}
 *     onCancel={() => setShowCancel(false)}
 *   />
 */
export function ConfirmModal({
  open,
  title,
  description,
  confirmText = "确认",
  cancelText = "取消",
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={loading ? () => {} : onCancel}
      dismissOnBackdrop={!loading}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            {cancelText}
          </Button>
          <Button
            variant={danger ? "primary" : "primary"}
            onClick={() => void onConfirm()}
            loading={loading}
          >
            {confirmText}
          </Button>
        </>
      }
    >
      {typeof description === "string" ? (
        <p className="text-sm text-neutral-700">{description}</p>
      ) : (
        description
      )}
    </Modal>
  );
}
