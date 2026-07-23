"use client";

/**
 * 发货 Modal —— 商家将订单从 paid 推进到 shipped。
 *
 * 关键校验（与后端 §10.3 / 错误码 13010 对齐）：
 *   - carrier 必选
 *   - tracking_no 长度 6-30，仅 [A-Za-z0-9]
 *
 * 二次警示：
 *   - "一旦发货不可撤回" —— Phase 3 无 shipped → cancelled 状态迁移
 */

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/Button";
import { CarrierPicker } from "@/components/ui/CarrierPicker";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toast";
import { shipOrder } from "@/lib/order-api";
import { isValidTrackingNo } from "@/lib/order-utils";
import { ApiError } from "@/types/errors";
import type { MerchantOrderDetail } from "@/types/order";
import {
  MERCHANT_ORDER_QUERY_KEY,
  MERCHANT_ORDERS_QUERY_KEY,
  MERCHANT_ORDER_STATS_KEY,
} from "@/hooks/useMerchantOrders";

export interface ShipOrderModalProps {
  open: boolean;
  onClose: () => void;
  order: Pick<MerchantOrderDetail, "id" | "order_no" | "receiver_name">;
  /** 发货成功后回调，一般用于关 modal / 触发上层刷新 */
  onSuccess?: (updated: MerchantOrderDetail) => void;
}

export function ShipOrderModal({
  open,
  onClose,
  order,
  onSuccess,
}: ShipOrderModalProps) {
  const queryClient = useQueryClient();
  const [carrier, setCarrier] = useState("");
  const [trackingNo, setTrackingNo] = useState("");
  const [errors, setErrors] = useState<{ carrier?: string; tracking_no?: string }>(
    {},
  );

  // 打开时重置状态（避免上次输入残留）
  useEffect(() => {
    if (open) {
      setCarrier("");
      setTrackingNo("");
      setErrors({});
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: () => shipOrder(order.id, { carrier, tracking_no: trackingNo }),
    onSuccess: (data) => {
      toast.success("已提交发货，物流轨迹稍后展示");
      queryClient.invalidateQueries({ queryKey: MERCHANT_ORDER_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: MERCHANT_ORDERS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: MERCHANT_ORDER_STATS_KEY });
      onSuccess?.(data);
      onClose();
    },
    onError: (e) => {
      const msg = e instanceof ApiError ? e.toUserMessage() : "发货失败，请重试";
      toast.error(msg);
    },
  });

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (!carrier) next.carrier = "请先选择快递公司";
    const t = trackingNo.trim();
    if (!t) next.tracking_no = "请输入快递单号";
    else if (!isValidTrackingNo(t))
      next.tracking_no = "单号需 6-30 位字母/数字组合";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = () => {
    if (mutation.isPending) return;
    if (!validate()) return;
    mutation.mutate();
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!mutation.isPending) onClose();
      }}
      title={`订单发货 · ${order.order_no}`}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            取消
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={mutation.isPending}
          >
            确认发货
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <strong>请确认信息无误。</strong>一旦发货不可撤回，如需取消订单必须先与用户协商走 Phase 4 售后流程。
        </div>

        <p className="text-sm text-neutral-700">
          收货人：<span className="font-medium">{order.receiver_name}</span>
        </p>

        <FormField
          label="快递公司"
          required
          error={errors.carrier}
          hint={!errors.carrier ? "选择实际发货的承运商" : undefined}
        >
          {(id) => (
            <CarrierPicker
              id={id}
              value={carrier}
              onChange={(v) => {
                setCarrier(v);
                if (errors.carrier) setErrors((s) => ({ ...s, carrier: undefined }));
              }}
              invalid={!!errors.carrier}
              disabled={mutation.isPending}
            />
          )}
        </FormField>

        <FormField
          label="快递单号"
          required
          error={errors.tracking_no}
          hint={
            !errors.tracking_no
              ? "6-30 位字母/数字，如 SF1234567890"
              : undefined
          }
        >
          {(id) => (
            <Input
              id={id}
              placeholder="请输入快递单号"
              value={trackingNo}
              onChange={(e) => {
                setTrackingNo(e.target.value);
                if (errors.tracking_no)
                  setErrors((s) => ({ ...s, tracking_no: undefined }));
              }}
              invalid={!!errors.tracking_no}
              disabled={mutation.isPending}
              maxLength={30}
              autoComplete="off"
            />
          )}
        </FormField>
      </div>
    </Modal>
  );
}
