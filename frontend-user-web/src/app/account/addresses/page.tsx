"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { RequireAuth } from "@/components/auth/RequireAuth";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/Toast";
import { useAddresses, useInvalidateAddresses } from "@/hooks/useAddresses";
import {
  createAddress,
  deleteAddress,
  setDefaultAddress,
  updateAddress,
} from "@/lib/address-api";
import { ApiError } from "@/lib/api";
import { messageForCode } from "@/types/errors";
import type {
  CreateAddressPayload,
  UpdateAddressPayload,
  UserAddress,
} from "@/types/order";

/** 契约 §6.1 — 每用户上限 20 条地址。 */
const ADDRESS_LIMIT = 20;

const phoneRegex = /^1[3-9]\d{9}$/;

const addressSchema = z.object({
  receiver_name: z.string().min(1, "请填写收货人").max(60, "最多 60 字"),
  receiver_phone: z
    .string()
    .min(1, "请填写手机号")
    .regex(phoneRegex, "请输入 11 位手机号"),
  province: z.string().min(1, "请填写省份").max(40, "最多 40 字"),
  city: z.string().min(1, "请填写城市").max(40, "最多 40 字"),
  district: z.string().min(1, "请填写区/县").max(40, "最多 40 字"),
  detail: z.string().min(1, "请填写详细地址").max(200, "最多 200 字"),
  postal_code: z
    .string()
    .max(10, "邮编最长 10 位")
    .optional()
    .or(z.literal("")),
  is_default: z.boolean().optional(),
});
type AddressForm = z.infer<typeof addressSchema>;

export default function AddressesPage() {
  return (
    <RequireAuth>
      <div className="min-h-screen bg-neutral-50">
        <SiteHeader />
        <AddressesContent />
      </div>
    </RequireAuth>
  );
}

function AddressesContent() {
  const { data, isLoading, isError, refetch } = useAddresses();
  const invalidate = useInvalidateAddresses();

  const [editing, setEditing] = useState<UserAddress | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserAddress | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const list = data ?? [];
  const atLimit = list.length >= ADDRESS_LIMIT;

  const onSetDefault = async (addr: UserAddress) => {
    if (addr.is_default) return;
    setBusyId(addr.id);
    try {
      await setDefaultAddress(addr.id);
      toast.success("已设为默认地址");
      invalidate();
    } catch (e) {
      const msg =
        e instanceof ApiError ? messageForCode(e.code, e.message) : "操作失败";
      toast.error(msg);
    } finally {
      setBusyId(null);
    }
  };

  const onConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteAddress(deleteTarget.id);
      toast.success("地址已删除");
      invalidate();
      setDeleteTarget(null);
    } catch (e) {
      const msg =
        e instanceof ApiError ? messageForCode(e.code, e.message) : "删除失败";
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">地址管理</h1>
        <Button
          onClick={() => setCreating(true)}
          disabled={atLimit}
          title={atLimit ? `最多可添加 ${ADDRESS_LIMIT} 条地址` : undefined}
        >
          新增地址
        </Button>
      </div>
      {atLimit && (
        <p className="mb-3 text-xs text-neutral-500">
          地址数量已达上限 {ADDRESS_LIMIT} 条，请删除后再添加。
        </p>
      )}

      {isLoading && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {isError && (
        <div className="rounded-md border border-[color:var(--color-primary-200)] bg-[color:var(--color-primary-50)] px-4 py-3 text-sm text-[color:var(--color-primary-700)]">
          加载失败，
          <button
            type="button"
            className="ml-1 underline"
            onClick={() => refetch()}
          >
            重试
          </button>
        </div>
      )}

      {data && list.length === 0 && (
        <EmptyState
          title="还没有收货地址"
          description="添加第一条地址，下单时可以快速选中"
          action={
            <Button onClick={() => setCreating(true)}>新增地址</Button>
          }
        />
      )}

      {list.length > 0 && (
        <ul className="flex flex-col gap-3">
          {list.map((addr) => (
            <li
              key={addr.id}
              className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
              data-testid={`address-card-${addr.id}`}
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-sm font-semibold text-neutral-900">
                  {addr.receiver_name}
                </span>
                <span className="text-sm text-neutral-600">
                  {addr.receiver_phone}
                </span>
                {addr.is_default && (
                  <span className="inline-flex items-center rounded bg-[color:var(--color-primary-50)] px-2 py-0.5 text-xs text-[color:var(--color-primary)]">
                    默认
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-neutral-700">
                {addr.province}
                {addr.city}
                {addr.district} {addr.detail}
                {addr.postal_code ? ` (${addr.postal_code})` : ""}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setEditing(addr)}
                >
                  编辑
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={addr.is_default || busyId === addr.id}
                  onClick={() => onSetDefault(addr)}
                >
                  {addr.is_default ? "已是默认" : "设为默认"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteTarget(addr)}
                  className="text-[color:var(--color-primary)]"
                >
                  删除
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-xs text-neutral-400">
        <Link href="/orders" className="hover:underline">
          查看我的订单 →
        </Link>
      </p>

      {creating && (
        <AddressFormModal
          onClose={() => setCreating(false)}
          onSaved={() => {
            invalidate();
            setCreating(false);
          }}
        />
      )}
      {editing && (
        <AddressFormModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            invalidate();
            setEditing(null);
          }}
        />
      )}
      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="确认删除该地址？"
        description="删除后不可恢复。若删除的是默认地址，需重新指定新的默认。"
        danger
        loading={deleting}
        onConfirm={onConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </main>
  );
}

function AddressFormModal({
  initial,
  onClose,
  onSaved,
}: {
  initial?: UserAddress;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(initial);
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<AddressForm>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      receiver_name: initial?.receiver_name ?? "",
      receiver_phone: initial?.receiver_phone ?? "",
      province: initial?.province ?? "",
      city: initial?.city ?? "",
      district: initial?.district ?? "",
      detail: initial?.detail ?? "",
      postal_code: initial?.postal_code ?? "",
      is_default: initial?.is_default ?? false,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      // 空 postal_code 转 null，跟契约 nullable 保持一致
      const normalized: CreateAddressPayload & UpdateAddressPayload = {
        receiver_name: values.receiver_name.trim(),
        receiver_phone: values.receiver_phone.trim(),
        province: values.province.trim(),
        city: values.city.trim(),
        district: values.district.trim(),
        detail: values.detail.trim(),
        postal_code: values.postal_code?.trim() ? values.postal_code.trim() : null,
        is_default: Boolean(values.is_default),
      };
      if (isEdit && initial) {
        await updateAddress(initial.id, normalized);
        toast.success("地址已更新");
      } else {
        await createAddress(normalized);
        toast.success("地址已添加");
      }
      onSaved();
    } catch (e) {
      const msg =
        e instanceof ApiError ? messageForCode(e.code, e.message) : "保存失败";
      toast.error(msg);
    }
  });

  return (
    <Modal open onClose={onClose} title={isEdit ? "编辑地址" : "新增地址"}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={control}
            name="receiver_name"
            render={({ value, onChange, name, error, onBlur }) => (
              <Input
                label="收货人"
                name={name}
                value={(value as string) ?? ""}
                onChange={(e) => onChange(e.target.value)}
                onBlur={onBlur}
                error={error}
                maxLength={60}
              />
            )}
          />
          <FormField
            control={control}
            name="receiver_phone"
            render={({ value, onChange, name, error, onBlur }) => (
              <Input
                label="手机号"
                name={name}
                value={(value as string) ?? ""}
                onChange={(e) => onChange(e.target.value)}
                onBlur={onBlur}
                error={error}
                inputMode="tel"
                maxLength={20}
              />
            )}
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <FormField
            control={control}
            name="province"
            render={({ value, onChange, name, error, onBlur }) => (
              <Input
                label="省份"
                name={name}
                value={(value as string) ?? ""}
                onChange={(e) => onChange(e.target.value)}
                onBlur={onBlur}
                error={error}
                maxLength={40}
              />
            )}
          />
          <FormField
            control={control}
            name="city"
            render={({ value, onChange, name, error, onBlur }) => (
              <Input
                label="城市"
                name={name}
                value={(value as string) ?? ""}
                onChange={(e) => onChange(e.target.value)}
                onBlur={onBlur}
                error={error}
                maxLength={40}
              />
            )}
          />
          <FormField
            control={control}
            name="district"
            render={({ value, onChange, name, error, onBlur }) => (
              <Input
                label="区/县"
                name={name}
                value={(value as string) ?? ""}
                onChange={(e) => onChange(e.target.value)}
                onBlur={onBlur}
                error={error}
                maxLength={40}
              />
            )}
          />
        </div>
        <FormField
          control={control}
          name="detail"
          render={({ value, onChange, name, error, onBlur }) => (
            <Input
              label="详细地址"
              placeholder="如街道、门牌号、楼层"
              name={name}
              value={(value as string) ?? ""}
              onChange={(e) => onChange(e.target.value)}
              onBlur={onBlur}
              error={error}
              maxLength={200}
            />
          )}
        />
        <FormField
          control={control}
          name="postal_code"
          render={({ value, onChange, name, error, onBlur }) => (
            <Input
              label="邮政编码（可选）"
              name={name}
              value={(value as string) ?? ""}
              onChange={(e) => onChange(e.target.value)}
              onBlur={onBlur}
              error={error}
              maxLength={10}
              inputMode="numeric"
            />
          )}
        />
        <FormField
          control={control}
          name="is_default"
          render={({ value, onChange }) => (
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={Boolean(value)}
                onChange={(e) => onChange(e.target.checked)}
              />
              设为默认地址
            </label>
          )}
        />

        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" loading={isSubmitting}>
            保存
          </Button>
        </div>
      </form>
    </Modal>
  );
}
