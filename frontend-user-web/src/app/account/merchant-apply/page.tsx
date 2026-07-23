"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { RequireAuth } from "@/components/auth/RequireAuth";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { Skeleton } from "@/components/ui/Skeleton";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toast";
import {
  listMyApplications,
  submitApplication,
  withdrawApplication,
} from "@/lib/merchant-application-api";
import { ApiError } from "@/lib/api";
import { ErrorCode, messageForCode } from "@/types/errors";
import type {
  MerchantApplicationOut,
  MerchantApplicationStatus,
} from "@/types/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { cn } from "@/lib/cn";

export default function MerchantApplyPage() {
  return (
    <RequireAuth>
      <div className="min-h-screen bg-neutral-50">
        <SiteHeader />
        <MerchantApplyContent />
      </div>
    </RequireAuth>
  );
}

function MerchantApplyContent() {
  const meQuery = useCurrentUser();
  const listQuery = useQuery({
    queryKey: ["merchant-applications", "mine"],
    queryFn: () => listMyApplications({ page: 1, size: 20 }),
  });

  const applications = listQuery.data?.items ?? [];
  const pending = applications.find((a) => a.status === "pending") ?? null;
  const approved = applications.find((a) => a.status === "approved") ?? null;
  const alreadyMerchant =
    approved !== null ||
    (meQuery.data?.merchant_account_ids?.length ?? 0) > 0;

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-neutral-900">
        商家入驻
      </h1>

      {listQuery.isLoading || meQuery.isLoading ? (
        <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-6">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : alreadyMerchant ? (
        <AlreadyMerchantCard />
      ) : pending ? (
        <PendingCard application={pending} />
      ) : (
        <SubmitForm />
      )}

      {applications.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-neutral-700">
            申请历史
          </h2>
          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-xs text-neutral-500">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">店铺名</th>
                  <th className="px-3 py-2 text-left font-medium">状态</th>
                  <th className="px-3 py-2 text-left font-medium">提交时间</th>
                  <th className="px-3 py-2 text-left font-medium">审核备注</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((a) => (
                  <tr key={a.id} className="border-t border-neutral-100">
                    <td className="px-3 py-2 text-neutral-900">
                      {a.shop_name}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="px-3 py-2 text-neutral-600">
                      {new Date(a.created_at).toLocaleString("zh-CN", {
                        hour12: false,
                      })}
                    </td>
                    <td className="px-3 py-2 text-neutral-600">
                      {a.status === "rejected" ? (a.review_note ?? "-") : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}

function StatusBadge({ status }: { status: MerchantApplicationStatus }) {
  const meta: Record<
    MerchantApplicationStatus,
    { label: string; cls: string }
  > = {
    pending: {
      label: "审核中",
      cls: "bg-amber-50 text-amber-700 border-amber-200",
    },
    approved: {
      label: "已通过",
      cls: "bg-green-50 text-green-700 border-green-200",
    },
    rejected: {
      label: "已拒绝",
      cls: "bg-[color:var(--color-primary-50)] text-[color:var(--color-primary-700)] border-[color:var(--color-primary-200)]",
    },
    withdrawn: {
      label: "已撤回",
      cls: "bg-neutral-100 text-neutral-600 border-neutral-200",
    },
  };
  const m = meta[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-2 py-0.5 text-xs",
        m.cls,
      )}
    >
      {m.label}
    </span>
  );
}

function AlreadyMerchantCard() {
  return (
    <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-sm text-green-800">
      <div className="mb-2 text-base font-semibold">你已是 JD-Clone 商家</div>
      <p>可以直接进入商家后台管理你的店铺与商品。</p>
      <div className="mt-4">
        <a
          href={process.env.NEXT_PUBLIC_MERCHANT_PORTAL_URL ?? "http://localhost:3001"}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center rounded-md bg-[color:var(--color-primary)] px-4 py-2 text-white hover:opacity-90"
        >
          进入商家后台
        </a>
      </div>
    </div>
  );
}

function PendingCard({
  application,
}: {
  application: MerchantApplicationOut;
}) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  const mutation = useMutation({
    mutationFn: () => withdrawApplication(application.id),
    onSuccess: () => {
      toast.success("申请已撤回");
      queryClient.invalidateQueries({
        queryKey: ["merchant-applications", "mine"],
      });
      queryClient.invalidateQueries({ queryKey: ["user", "me"] });
      setConfirming(false);
    },
    onError: (e) => {
      const msg =
        e instanceof ApiError
          ? e.code === ErrorCode.ApplicationStatusIllegal
            ? "当前状态不允许撤回"
            : messageForCode(e.code, e.message)
          : "撤回失败";
      toast.error(msg);
    },
  });

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
      <div className="mb-2 flex items-center gap-2">
        <StatusBadge status="pending" />
        <span className="text-sm text-amber-800">
          提交于 {new Date(application.created_at).toLocaleString("zh-CN")}
        </span>
      </div>
      <div className="text-lg font-semibold text-neutral-900">
        {application.shop_name}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-y-2 text-sm text-neutral-700">
        <dt className="text-neutral-500">联系人</dt>
        <dd>{application.contact_name}</dd>
        <dt className="text-neutral-500">联系电话</dt>
        <dd>{application.contact_phone}</dd>
        <dt className="text-neutral-500">执照号</dt>
        <dd>{application.business_license_no}</dd>
      </dl>
      {application.description && (
        <p className="mt-3 whitespace-pre-wrap rounded bg-white/60 p-3 text-sm text-neutral-600">
          {application.description}
        </p>
      )}
      <div className="mt-4">
        <Button
          variant="secondary"
          onClick={() => setConfirming(true)}
          loading={mutation.isPending}
        >
          撤回申请
        </Button>
      </div>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="撤回申请"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              取消
            </Button>
            <Button
              variant="primary"
              onClick={() => mutation.mutate()}
              loading={mutation.isPending}
            >
              确认撤回
            </Button>
          </>
        }
      >
        <p className="text-sm text-neutral-700">
          撤回后你可以随时重新提交入驻申请，是否确认？
        </p>
      </Modal>
    </div>
  );
}

// ---------------- 提交申请表单 ----------------
const PHONE_REGEX = /^1\d{10}$/;

const submitSchema = z.object({
  shop_name: z
    .string()
    .min(2, "店铺名至少 2 字")
    .max(120, "店铺名最长 120 字"),
  contact_name: z
    .string()
    .min(2, "联系人姓名至少 2 字")
    .max(60, "联系人姓名最长 60 字"),
  contact_phone: z.string().regex(PHONE_REGEX, "请输入正确的手机号"),
  business_license_no: z
    .string()
    .min(10, "营业执照号至少 10 位")
    .max(50, "营业执照号最长 50 位"),
  description: z.string().max(500, "说明最多 500 字").optional().default(""),
});
type SubmitForm = z.infer<typeof submitSchema>;

function SubmitForm() {
  const queryClient = useQueryClient();
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<SubmitForm>({
    resolver: zodResolver(submitSchema),
    defaultValues: {
      shop_name: "",
      contact_name: "",
      contact_phone: "",
      business_license_no: "",
      description: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await submitApplication({
        shop_name: values.shop_name.trim(),
        contact_name: values.contact_name.trim(),
        contact_phone: values.contact_phone.trim(),
        business_license_no: values.business_license_no.trim(),
        description: values.description?.trim() || undefined,
      });
      toast.success("申请已提交，等待平台审核");
      reset();
      queryClient.invalidateQueries({
        queryKey: ["merchant-applications", "mine"],
      });
      queryClient.invalidateQueries({ queryKey: ["user", "me"] });
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === ErrorCode.MerchantApplicationPending) {
          toast.error("你已有一条待审核的申请");
        } else if (e.code === ErrorCode.AlreadyMerchant) {
          toast.error("你已经是商家，无需重复申请");
        } else {
          toast.error(messageForCode(e.code, e.message));
        }
      } else {
        toast.error("提交失败，请稍后重试");
      }
      queryClient.invalidateQueries({
        queryKey: ["merchant-applications", "mine"],
      });
    }
  });

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
      <p className="mb-4 text-sm text-neutral-600">
        填写以下信息提交入驻申请，平台通常在 3 个工作日内完成审核。审核结果会通过站内通知告知。
        <Link
          href="/account/profile"
          className="ml-1 text-[color:var(--color-primary)] hover:underline"
        >
          返回资料页
        </Link>
      </p>

      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          control={control}
          name="shop_name"
          render={({ value, onChange, onBlur, name, error }) => (
            <Input
              label="店铺名称"
              placeholder="例如：小李杂货铺"
              name={name}
              value={(value as string) ?? ""}
              onChange={(e) => onChange(e.target.value)}
              onBlur={onBlur}
              error={error}
            />
          )}
        />
        <FormField
          control={control}
          name="contact_name"
          render={({ value, onChange, onBlur, name, error }) => (
            <Input
              label="联系人姓名"
              name={name}
              value={(value as string) ?? ""}
              onChange={(e) => onChange(e.target.value)}
              onBlur={onBlur}
              error={error}
            />
          )}
        />
        <FormField
          control={control}
          name="contact_phone"
          render={({ value, onChange, onBlur, name, error }) => (
            <Input
              label="联系电话"
              placeholder="11 位手机号"
              inputMode="numeric"
              name={name}
              value={(value as string) ?? ""}
              onChange={(e) => onChange(e.target.value)}
              onBlur={onBlur}
              error={error}
            />
          )}
        />
        <FormField
          control={control}
          name="business_license_no"
          render={({ value, onChange, onBlur, name, error }) => (
            <Input
              label="营业执照号"
              placeholder="统一社会信用代码"
              name={name}
              value={(value as string) ?? ""}
              onChange={(e) => onChange(e.target.value)}
              onBlur={onBlur}
              error={error}
            />
          )}
        />
        <div className="sm:col-span-2">
          <FormField
            control={control}
            name="description"
            render={({ value, onChange, onBlur, name, error }) => (
              <div>
                <label
                  htmlFor={name}
                  className="mb-1.5 block text-sm font-medium text-neutral-800"
                >
                  经营说明（可选）
                </label>
                <textarea
                  id={name}
                  name={name}
                  value={(value as string) ?? ""}
                  onChange={(e) => onChange(e.target.value)}
                  onBlur={onBlur}
                  rows={4}
                  maxLength={500}
                  placeholder="简述主营类目、供应链或团队情况（≤ 500 字）"
                  className={cn(
                    "w-full rounded-md border bg-white px-3 py-2 text-sm shadow-sm outline-none transition",
                    "focus:ring-2 focus:ring-[color:var(--color-primary)]/40",
                    error
                      ? "border-[color:var(--color-primary)]"
                      : "border-neutral-300 focus:border-[color:var(--color-primary)]",
                  )}
                />
                {error && (
                  <p
                    role="alert"
                    aria-live="polite"
                    className="mt-1 text-xs text-[color:var(--color-primary)]"
                  >
                    {error}
                  </p>
                )}
              </div>
            )}
          />
        </div>

        <div className="sm:col-span-2">
          <Button type="submit" size="lg" fullWidth loading={isSubmitting}>
            提交入驻申请
          </Button>
        </div>
      </form>
    </div>
  );
}
