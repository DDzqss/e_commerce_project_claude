"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/Toast";
import {
  MERCHANT_ME_QUERY_KEY,
  useCurrentMerchant,
} from "@/hooks/useCurrentMerchant";
import { useMerchantAuthStore } from "@/lib/auth-store";
import { updateShop } from "@/lib/merchant-api";
import { ApiError } from "@/types/errors";
import type { ShopOut, UpdateShopIn } from "@/types/api";

const STATUS_LABEL: Record<ShopOut["status"], { text: string; className: string }> = {
  active: {
    text: "运营中",
    className: "bg-emerald-50 text-emerald-700",
  },
  frozen: {
    text: "已冻结",
    className: "bg-red-50 text-red-700",
  },
};

const editShopSchema = z.object({
  description: z
    .string()
    .max(500, "简介不超过 500 字")
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  contact_name: z
    .string()
    .min(2, "联系人姓名至少 2 字")
    .max(60, "联系人姓名不超过 60 字"),
  contact_phone: z
    .string()
    .regex(/^1\d{10}$/u, "请输入 11 位中国大陆手机号"),
});
type EditShopForm = z.infer<typeof editShopSchema>;

function ShopInfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-neutral-100 py-3 last:border-b-0 sm:flex-row sm:items-center sm:gap-6 sm:py-2">
      <div className="w-28 shrink-0 text-xs text-neutral-500">{label}</div>
      <div className="text-sm text-neutral-900">{value ?? "—"}</div>
    </div>
  );
}

function EditShopModal({
  open,
  onClose,
  shop,
}: {
  open: boolean;
  onClose: () => void;
  shop: ShopOut;
}) {
  const queryClient = useQueryClient();
  const setShop = useMerchantAuthStore((s) => s.setShop);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<EditShopForm>({
    resolver: zodResolver(editShopSchema),
    defaultValues: {
      description: shop.description ?? "",
      contact_name: shop.contact_name,
      contact_phone: shop.contact_phone,
    },
  });

  const mutation = useMutation({
    mutationFn: (payload: UpdateShopIn) => updateShop(payload),
    onSuccess: (data) => {
      setShop(data);
      queryClient.setQueryData(MERCHANT_ME_QUERY_KEY, (prev: unknown) => {
        if (!prev || typeof prev !== "object") return prev;
        return { ...(prev as object), shop: data };
      });
      toast.success("店铺信息已更新");
      onClose();
    },
    onError: (err) => {
      const msg =
        err instanceof ApiError ? err.toUserMessage() : "更新失败，请稍后重试";
      toast.error(msg);
    },
  });

  const onSubmit = handleSubmit((values) => {
    mutation.mutate({
      description: values.description ?? null,
      contact_name: values.contact_name,
      contact_phone: values.contact_phone,
    });
  });

  return (
    <Modal
      open={open}
      onClose={() => {
        if (mutation.isPending) return;
        reset();
        onClose();
      }}
      title="编辑店铺信息"
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => {
              reset();
              onClose();
            }}
            disabled={mutation.isPending}
          >
            取消
          </Button>
          <Button
            variant="primary"
            onClick={onSubmit}
            loading={mutation.isPending}
            disabled={!isDirty}
          >
            保存
          </Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <FormField
          label="店铺名称"
          hint="店铺名称由平台核定，暂不支持自助修改"
        >
          {(id) => <Input id={id} value={shop.name} disabled readOnly />}
        </FormField>

        <FormField
          label="店铺简介"
          hint="500 字以内，用于展示给消费者"
          error={errors.description?.message}
        >
          {(id) => (
            <textarea
              id={id}
              rows={3}
              className="block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus-visible:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-blue-200"
              placeholder="简单介绍主营品类、经营理念等"
              {...register("description")}
            />
          )}
        </FormField>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            label="联系人姓名"
            required
            error={errors.contact_name?.message}
          >
            {(id) => (
              <Input
                id={id}
                invalid={Boolean(errors.contact_name)}
                {...register("contact_name")}
              />
            )}
          </FormField>
          <FormField
            label="联系电话"
            required
            error={errors.contact_phone?.message}
          >
            {(id) => (
              <Input
                id={id}
                inputMode="tel"
                invalid={Boolean(errors.contact_phone)}
                {...register("contact_phone")}
              />
            )}
          </FormField>
        </div>
      </form>
    </Modal>
  );
}

export default function ShopPage() {
  const { data, isLoading, isError, refetch } = useCurrentMerchant();
  const [editing, setEditing] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        无法加载店铺信息。
        <button
          type="button"
          className="ml-2 underline"
          onClick={() => refetch()}
        >
          重试
        </button>
      </div>
    );
  }

  const { shop } = data;
  const statusMeta = STATUS_LABEL[shop.status];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-900">店铺信息</h2>
          <p className="mt-1 text-sm text-neutral-500">
            查看与维护当前登录商家的店铺基础信息
          </p>
        </div>
        <Button variant="primary" onClick={() => setEditing(true)}>
          编辑信息
        </Button>
      </div>

      <section className="rounded-lg border border-neutral-200 bg-white p-6">
        <div className="mb-4 flex items-center gap-3">
          <h3 className="text-lg font-semibold text-neutral-900">{shop.name}</h3>
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium ${statusMeta.className}`}
          >
            {statusMeta.text}
          </span>
        </div>

        <div className="divide-y divide-neutral-100">
          <ShopInfoItem label="店铺 ID" value={shop.id} />
          <ShopInfoItem
            label="店铺简介"
            value={
              shop.description ? (
                <span className="whitespace-pre-line">{shop.description}</span>
              ) : (
                <span className="text-neutral-400">未填写</span>
              )
            }
          />
          <ShopInfoItem label="联系人" value={shop.contact_name} />
          <ShopInfoItem label="联系电话" value={shop.contact_phone} />
          <ShopInfoItem
            label="创建时间"
            value={new Date(shop.created_at).toLocaleString("zh-CN")}
          />
          <ShopInfoItem
            label="最近更新"
            value={new Date(shop.updated_at).toLocaleString("zh-CN")}
          />
        </div>
      </section>

      <EditShopModal
        open={editing}
        onClose={() => setEditing(false)}
        shop={shop}
      />
    </div>
  );
}
