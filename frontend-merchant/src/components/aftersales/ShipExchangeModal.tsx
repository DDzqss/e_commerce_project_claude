"use client";

/**
 * 换货再发货 Modal —— merchant_agreed_waiting_ship → exchange_shipped_waiting_receive。
 *
 * 关键点（§8.4 ship-exchange）：
 *   - carrier 必选（复用 Phase 3 CarrierPicker）
 *   - tracking_no 6-30 alphanumeric（复用 Phase 3 isValidTrackingNo）
 *   - 提示"用户需 15 天内确认收货，否则系统自动确认"
 */

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/Button";
import { CarrierPicker } from "@/components/ui/CarrierPicker";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toast";
import { shipExchange } from "@/lib/aftersales-api";
import { isValidTrackingNo } from "@/lib/order-utils";
import {
  MERCHANT_AFTERSALES_DETAIL_KEY,
  MERCHANT_AFTERSALES_QUERY_KEY,
  MERCHANT_AFTERSALES_STATS_KEY,
} from "@/hooks/useMerchantAftersales";
import { ApiError } from "@/types/errors";
import type {
  MerchantAftersalesDetail,
  MerchantAftersalesListItem,
} from "@/types/aftersales";

export interface ShipExchangeModalProps {
  open: boolean;
  onClose: () => void;
  aftersales: Pick<MerchantAftersalesListItem, "id" | "aftersales_no">;
  onSuccess?: (updated: MerchantAftersalesDetail) => void;
}

export function ShipExchangeModal({
  open,
  onClose,
  aftersales,
  onSuccess,
}: ShipExchangeModalProps) {
  const queryClient = useQueryClient();
  const [carrier, setCarrier] = useState("");
  const [trackingNo, setTrackingNo] = useState("");
  const [errors, setErrors] = useState<{
    carrier?: string;
    tracking_no?: string;
  }>({});

  useEffect(() => {
    if (open) {
      setCarrier("");
      setTrackingNo("");
      setErrors({});
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: () =>
      shipExchange(aftersales.id, { carrier, tracking_no: trackingNo }),
    onSuccess: (data) => {
      toast.success("换货发货信息已提交");
      queryClient.invalidateQueries({ queryKey: MERCHANT_AFTERSALES_QUERY_KEY });
      queryClient.invalidateQueries({
        queryKey: MERCHANT_AFTERSALES_DETAIL_KEY,
      });
      queryClient.invalidateQueries({
        queryKey: MERCHANT_AFTERSALES_STATS_KEY,
      });
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
      title={`换货发货 · ${aftersales.aftersales_no}`}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            返回
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
          <strong>请确认信息无误。</strong>
          {" "}发货后用户需在 15 天内确认收货，否则系统自动确认为已完成。
        </div>

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
                if (errors.carrier)
                  setErrors((s) => ({ ...s, carrier: undefined }));
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
