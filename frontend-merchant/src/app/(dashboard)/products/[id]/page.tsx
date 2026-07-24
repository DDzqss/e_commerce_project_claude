"use client";

/**
 * SPU 编辑页（Tab 结构）。
 *
 * 三个 Tab：
 *   - 基本信息（可编辑；根据状态显示警告 / 禁用）
 *   - SKU 管理
 *   - 库存管理
 *
 * 顶部操作栏依状态显示（§4）：
 *   draft:           保存 / 提交审核 / 删除
 *   pending_review:  撤回审核（表单只读）
 *   approved:        保存（改关键字段需重新审核） / 下架 / 删除禁用
 *   rejected:        修改后重新提交 / 删除
 *   off_shelf:       重新上架 / 删除
 */

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { MultiImageUpload } from "@/components/ui/MultiImageUpload";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { toast } from "@/components/ui/Toast";
import {
  SPUBasicInfoForm,
  type SPUBasicFormValues,
} from "@/components/products/SPUBasicInfoForm";
import { cn } from "@/lib/cn";
import {
  deleteSPU,
  offshelf,
  onshelf,
  submitReview,
  updateSPU,
  withdrawReview,
} from "@/lib/product-api";
import { MY_SPU_QUERY_KEY, useMySPU } from "@/hooks/useMySPUs";
import { MY_SPUS_QUERY_KEY } from "@/hooks/useMySPUs";
import { ApiError } from "@/types/errors";
import type { SPUDetailOut, SPUStatus, UpdateSPUIn } from "@/types/api";

import { SKUManagementTab } from "./_SKUManagementTab";
import { InventoryTab } from "./_InventoryTab";

interface EditFormValues extends SPUBasicFormValues {
  description: string;
  images: string[];
}

type TabKey = "basic" | "skus" | "inventory";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "basic", label: "基本信息" },
  { key: "skus", label: "SKU 管理" },
  { key: "inventory", label: "库存管理" },
];

export default function ProductEditPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useMySPU(id);
  const initialTab = (searchParams.get("tab") as TabKey | null) ?? "basic";
  const [tab, setTab] = useState<TabKey>(
    ["basic", "skus", "inventory"].includes(initialTab) ? initialTab : "basic",
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        商品加载失败。
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

  return (
    <div className="space-y-6">
      <EditHeader
        spu={data}
        onDeleted={() => {
          queryClient.invalidateQueries({ queryKey: MY_SPUS_QUERY_KEY });
          router.push("/products");
        }}
      />

      <nav className="border-b border-neutral-200">
        <div className="-mb-px flex gap-1">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  "border-b-2 px-4 py-2 text-sm transition-colors",
                  active
                    ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                    : "border-transparent text-neutral-500 hover:text-neutral-800",
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </nav>

      {tab === "basic" ? <BasicInfoTab spu={data} /> : null}
      {tab === "skus" ? (
        <SKUManagementTab spu={data} />
      ) : null}
      {tab === "inventory" ? <InventoryTab spu={data} /> : null}
    </div>
  );
}

// ============================================================================
// 顶部操作栏
// ============================================================================

/** 每种状态支持哪些顶部操作（不含"保存"）。 */
function actionsForStatus(status: SPUStatus): Array<
  | "submit_review"
  | "withdraw_review"
  | "offshelf"
  | "onshelf"
  | "delete"
> {
  switch (status) {
    case "draft":
      return ["submit_review", "delete"];
    case "pending_review":
      return ["withdraw_review"];
    case "approved":
      return ["offshelf"];
    case "rejected":
      return ["submit_review", "delete"];
    case "off_shelf":
      return ["onshelf", "delete"];
    default:
      return [];
  }
}

function EditHeader({
  spu,
  onDeleted,
}: {
  spu: SPUDetailOut;
  onDeleted: () => void;
}) {
  const queryClient = useQueryClient();
  const actions = actionsForStatus(spu.status);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: MY_SPU_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: MY_SPUS_QUERY_KEY });
  }, [queryClient]);

  const submitMutation = useMutation({
    mutationFn: () => submitReview(spu.id),
    onSuccess: () => {
      toast.success("已提交审核");
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const withdrawMutation = useMutation({
    mutationFn: () => withdrawReview(spu.id),
    onSuccess: () => {
      toast.success("已撤回审核");
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const offshelfMutation = useMutation({
    mutationFn: () => offshelf(spu.id),
    onSuccess: () => {
      toast.success("已下架");
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const onshelfMutation = useMutation({
    mutationFn: () => onshelf(spu.id),
    onSuccess: () => {
      toast.success("已重新上架");
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteSPU(spu.id),
    onSuccess: () => {
      toast.success("商品已删除");
      onDeleted();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <h2 className="truncate text-2xl font-semibold text-neutral-900">
            {spu.title}
          </h2>
          <StatusBadge status={spu.status} />
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          ID: {spu.id} · 更新于 {new Date(spu.updated_at).toLocaleString("zh-CN")}
        </p>
        {spu.status === "rejected" && spu.review_note ? (
          <p className="mt-2 max-w-xl rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <span className="font-semibold">驳回原因：</span>
            {spu.review_note}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {actions.includes("withdraw_review") ? (
          <Button
            variant="secondary"
            onClick={() => withdrawMutation.mutate()}
            loading={withdrawMutation.isPending}
          >
            撤回审核
          </Button>
        ) : null}
        {actions.includes("submit_review") ? (
          <Button
            variant="primary"
            onClick={() => submitMutation.mutate()}
            loading={submitMutation.isPending}
          >
            {spu.status === "rejected" ? "重新提交审核" : "提交审核"}
          </Button>
        ) : null}
        {actions.includes("offshelf") ? (
          <Button
            variant="secondary"
            onClick={() => offshelfMutation.mutate()}
            loading={offshelfMutation.isPending}
          >
            下架
          </Button>
        ) : null}
        {actions.includes("onshelf") ? (
          <Button
            variant="primary"
            onClick={() => onshelfMutation.mutate()}
            loading={onshelfMutation.isPending}
          >
            重新上架
          </Button>
        ) : null}
        {actions.includes("delete") ? (
          <Button
            variant="danger"
            onClick={() => setConfirmDelete(true)}
            loading={deleteMutation.isPending}
          >
            删除
          </Button>
        ) : null}
      </div>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="确认删除商品"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setConfirmDelete(false)}
              disabled={deleteMutation.isPending}
            >
              取消
            </Button>
            <Button
              variant="danger"
              onClick={() => deleteMutation.mutate()}
              loading={deleteMutation.isPending}
            >
              确认删除
            </Button>
          </>
        }
      >
        <p className="text-sm text-neutral-700">
          确定要删除「{spu.title}」吗？该操作为软删除。
        </p>
      </Modal>
    </header>
  );
}

// ============================================================================
// 基本信息 Tab
// ============================================================================

function BasicInfoTab({ spu }: { spu: SPUDetailOut }) {
  const queryClient = useQueryClient();
  const isReadonly = spu.status === "pending_review";
  const isApproved = spu.status === "approved";

  const methods = useForm<EditFormValues>({
    defaultValues: {
      title: spu.title,
      subtitle: spu.subtitle ?? "",
      category_id: spu.category_id,
      brand_id: spu.brand_id ?? null,
      main_image: spu.main_image,
      spec_axes: spu.spec_axes ?? [],
      description: spu.description ?? "",
      images: spu.images ?? [],
    },
    mode: "onBlur",
  });

  // spu 变化（invalidate 后）→ 重置表单
  useEffect(() => {
    methods.reset({
      title: spu.title,
      subtitle: spu.subtitle ?? "",
      category_id: spu.category_id,
      brand_id: spu.brand_id ?? null,
      main_image: spu.main_image,
      spec_axes: spu.spec_axes ?? [],
      description: spu.description ?? "",
      images: spu.images ?? [],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spu.id, spu.updated_at]);

  const saveMutation = useMutation({
    mutationFn: (payload: UpdateSPUIn) => updateSPU(spu.id, payload),
    onSuccess: () => {
      toast.success("已保存");
      queryClient.invalidateQueries({ queryKey: MY_SPU_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: MY_SPUS_QUERY_KEY });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const onSave = methods.handleSubmit((values) => {
    saveMutation.mutate({
      title: values.title,
      subtitle: values.subtitle || null,
      description: values.description || null,
      category_id: values.category_id ?? undefined,
      brand_id: values.brand_id ?? null,
      main_image: values.main_image,
      images: values.images,
      spec_axes: values.spec_axes,
    });
  });

  return (
    <FormProvider {...methods}>
      <section className="space-y-6 rounded-lg border border-neutral-200 bg-white p-6">
        {isReadonly ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            商品正在审核中，此期间不可编辑。如需修改请先「撤回审核」。
          </div>
        ) : null}

        <fieldset disabled={isReadonly} className="space-y-6 disabled:opacity-70">
          <SPUBasicInfoForm
            disabled={isReadonly}
            showApprovedWarning={isApproved}
          />

          <div className="space-y-4 border-t border-neutral-100 pt-6">
            <FormField label="详情图 gallery" hint="最多 8 张">
              {() => (
                <MultiImageUpload
                  value={methods.watch("images")}
                  onChange={(next) =>
                    methods.setValue("images", next, { shouldDirty: true })
                  }
                  purpose="spu_gallery"
                  max={8}
                  disabled={isReadonly}
                />
              )}
            </FormField>

            <FormField label="商品描述" hint="Phase 2 版本仅支持纯文本">
              {(id) => (
                <textarea
                  id={id}
                  rows={8}
                  disabled={isReadonly}
                  className="block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-neutral-50 disabled:text-neutral-500"
                  {...methods.register("description", {
                    maxLength: {
                      value: 5000,
                      message: "描述不超过 5000 字",
                    },
                  })}
                />
              )}
            </FormField>
          </div>
        </fieldset>

        {!isReadonly ? (
          <div className="flex justify-end gap-2 border-t border-neutral-100 pt-4">
            <Button
              variant="primary"
              onClick={onSave}
              loading={saveMutation.isPending}
              disabled={!methods.formState.isDirty}
            >
              保存
            </Button>
          </div>
        ) : null}
      </section>
    </FormProvider>
  );
}

function errMsg(e: unknown): string {
  if (e instanceof ApiError) return e.toUserMessage();
  if (e instanceof Error) return e.message;
  return "操作失败";
}
