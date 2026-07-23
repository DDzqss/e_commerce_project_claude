"use client";

/**
 * 品牌管理页 (`/console/catalog/brands`)。
 *
 * 契约 §6.2：
 * - GET    /admin/brands?page&size&keyword     分页
 * - POST   /admin/brands                       { name, slug, logo_url?, description?, sort_order?, is_visible? }
 * - PATCH  /admin/brands/{id}
 * - DELETE /admin/brands/{id}                  软删
 *
 * UI 要素：
 * - 顶部：搜索 + 「新建品牌」
 * - Table：logo + name + slug + is_visible + sort_order + 操作
 * - 分页
 * - 弹窗表单：新建 / 编辑
 * - RequirePermission "admin:brand:manage"
 */

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RequirePermission } from "@/components/auth/RequirePermission";
import { Badge } from "@/components/ui/Badge";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Table, type TableColumn } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import {
  createBrand,
  deleteBrand,
  updateBrand,
} from "@/lib/brand-api";
import { useBrands } from "@/hooks/useCatalog";
import { ApiError } from "@/lib/api";
import { getErrorMessage } from "@/types/errors";
import type {
  BrandOut,
  CreateBrandPayload,
  UpdateBrandPayload,
} from "@/types/api";

const PAGE_SIZE = 20;

export default function BrandsPage() {
  return (
    <RequirePermission permission="admin:brand:manage">
      <Suspense
        fallback={<div className="text-sm text-neutral-400">加载中…</div>}
      >
        <BrandsInner />
      </Suspense>
    </RequirePermission>
  );
}

function BrandsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const queryClient = useQueryClient();

  const initialKeyword = searchParams.get("keyword") ?? "";
  const initialPage = Number(searchParams.get("page") ?? "1") || 1;

  const [keywordInput, setKeywordInput] = useState(initialKeyword);
  const [debouncedKeyword, setDebouncedKeyword] = useState(initialKeyword);
  const [page, setPage] = useState(initialPage);

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedKeyword(keywordInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(handle);
  }, [keywordInput]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedKeyword) params.set("keyword", debouncedKeyword);
    if (page !== 1) params.set("page", String(page));
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }, [debouncedKeyword, page, router]);

  const query = useMemo(
    () => ({
      keyword: debouncedKeyword || undefined,
      page,
      size: PAGE_SIZE,
    }),
    [debouncedKeyword, page],
  );

  const { data, isLoading, isFetching, isError, refetch } = useBrands(query);
  const rows = data?.items ?? [];
  const total = data?.total ?? 0;

  const [formTarget, setFormTarget] = useState<
    { kind: "create" } | { kind: "edit"; brand: BrandOut } | null
  >(null);
  const [pendingDelete, setPendingDelete] = useState<BrandOut | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["admin", "brands"] });

  const createMutation = useMutation({
    mutationFn: (payload: CreateBrandPayload) => createBrand(payload),
    onSuccess: () => {
      setFormTarget(null);
      toast.push({ type: "success", message: "品牌已创建" });
      invalidate();
    },
    onError: (err) => toastApiError(toast, err),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: UpdateBrandPayload;
    }) => updateBrand(id, payload),
    onSuccess: () => {
      setFormTarget(null);
      toast.push({ type: "success", message: "品牌已更新" });
      invalidate();
    },
    onError: (err) => toastApiError(toast, err),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteBrand(id),
    onSuccess: () => {
      setPendingDelete(null);
      toast.push({ type: "success", message: "品牌已删除" });
      invalidate();
    },
    onError: (err) => toastApiError(toast, err),
  });

  const submitting = createMutation.isPending || updateMutation.isPending;

  const columns: TableColumn<BrandOut>[] = [
    {
      key: "logo",
      title: "Logo",
      width: 60,
      render: (row) => <BrandLogo objectKey={row.logo_url} name={row.name} />,
    },
    {
      key: "name",
      title: "名称",
      render: (row) => (
        <div>
          <div className="font-medium text-neutral-900">{row.name}</div>
          {row.description ? (
            <div className="mt-0.5 line-clamp-1 text-xs text-neutral-400">
              {row.description}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      key: "slug",
      title: "Slug",
      render: (row) => (
        <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs">
          {row.slug}
        </code>
      ),
    },
    {
      key: "is_visible",
      title: "可见",
      align: "center",
      width: 80,
      render: (row) =>
        row.is_visible ? (
          <Badge tone="success">可见</Badge>
        ) : (
          <Badge tone="default">隐藏</Badge>
        ),
    },
    {
      key: "sort_order",
      title: "排序",
      align: "center",
      width: 80,
      render: (row) => (
        <span className="tabular-nums text-neutral-600">{row.sort_order}</span>
      ),
    },
    {
      key: "actions",
      title: "操作",
      align: "right",
      width: 140,
      render: (row) => (
        <div className="flex items-center justify-end gap-2 text-xs">
          <button
            type="button"
            onClick={() => setFormTarget({ kind: "edit", brand: row })}
            className="rounded px-2 py-0.5 text-[color:var(--color-primary)] hover:bg-neutral-100"
          >
            编辑
          </button>
          <button
            type="button"
            onClick={() => setPendingDelete(row)}
            className="rounded px-2 py-0.5 text-[color:var(--color-danger)] hover:bg-red-50"
          >
            删除
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">品牌管理</h1>
          <p className="mt-1 text-sm text-neutral-500">
            维护品牌库。品牌 slug 全局唯一，创建后不建议修改。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => refetch()}
            loading={isFetching && !isLoading}
          >
            刷新
          </Button>
          <Button onClick={() => setFormTarget({ kind: "create" })}>
            + 新建品牌
          </Button>
        </div>
      </header>

      <div className="flex items-center gap-3">
        <div className="max-w-sm flex-1">
          <Input
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            placeholder="搜索品牌名 / slug"
            aria-label="搜索品牌"
          />
        </div>
        {debouncedKeyword ? (
          <Button variant="ghost" size="sm" onClick={() => setKeywordInput("")}>
            清空
          </Button>
        ) : null}
      </div>

      {isError ? (
        <div className="rounded border border-red-200 bg-[color:var(--color-danger-soft)] px-3 py-2 text-xs text-[color:var(--color-danger)]">
          加载失败，请点击右上角「刷新」重试。
        </div>
      ) : null}

      <Table
        columns={columns}
        rows={rows}
        loading={isLoading}
        rowKey={(row) => row.id}
        emptyText="暂无符合条件的品牌"
        pagination={{
          page,
          size: PAGE_SIZE,
          total,
          onPageChange: setPage,
        }}
      />

      <BrandFormModal
        target={formTarget}
        submitting={submitting}
        onClose={() => setFormTarget(null)}
        onSubmit={(payload) => {
          if (formTarget?.kind === "edit") {
            updateMutation.mutate({
              id: formTarget.brand.id,
              payload,
            });
          } else if (formTarget?.kind === "create") {
            createMutation.mutate(payload as CreateBrandPayload);
          }
        }}
      />

      <DeleteBrandConfirmModal
        brand={pendingDelete}
        submitting={deleteMutation.isPending}
        onClose={() => setPendingDelete(null)}
        onConfirm={() =>
          pendingDelete && deleteMutation.mutate(pendingDelete.id)
        }
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 品牌表单（新建 / 编辑复用）
// ---------------------------------------------------------------------------

interface BrandFormValues {
  name: string;
  slug: string;
  logo_url: string | null;
  description: string;
  sort_order: number;
  is_visible: boolean;
}

function BrandFormModal({
  target,
  submitting,
  onClose,
  onSubmit,
}: {
  target: { kind: "create" } | { kind: "edit"; brand: BrandOut } | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateBrandPayload | UpdateBrandPayload) => void;
}) {
  const open = target !== null;
  const toast = useToast();
  const [values, setValues] = useState<BrandFormValues>(() => emptyValues());
  const [errors, setErrors] = useState<
    Partial<Record<keyof BrandFormValues, string>>
  >({});
  const [lastKey, setLastKey] = useState("");

  const key =
    target?.kind === "edit" ? `edit-${target.brand.id}` : target ? "create" : "";
  if (open && key !== lastKey) {
    setLastKey(key);
    if (target?.kind === "edit") {
      setValues({
        name: target.brand.name,
        slug: target.brand.slug,
        logo_url: target.brand.logo_url,
        description: target.brand.description ?? "",
        sort_order: target.brand.sort_order,
        is_visible: target.brand.is_visible,
      });
    } else {
      setValues(emptyValues());
    }
    setErrors({});
  }

  const handleSubmit = () => {
    const nextErrors: typeof errors = {};
    if (!values.name.trim()) nextErrors.name = "请填写品牌名";
    if (values.name.trim().length > 80) nextErrors.name = "名称不超过 80 字";
    if (!values.slug.trim()) nextErrors.slug = "请填写 slug";
    if (!/^[a-z0-9-]{2,80}$/.test(values.slug.trim())) {
      nextErrors.slug = "slug 只能包含小写字母/数字/连字符，2-80 字";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onSubmit({
      name: values.name.trim(),
      slug: values.slug.trim(),
      logo_url: values.logo_url,
      description: values.description.trim() || null,
      sort_order: values.sort_order,
      is_visible: values.is_visible,
    });
  };

  return (
    <Modal
      open={open}
      onClose={submitting ? () => undefined : onClose}
      title={target?.kind === "edit" ? `编辑品牌「${target.brand.name}」` : "新建品牌"}
      closeOnOverlay={!submitting}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            取消
          </Button>
          <Button loading={submitting} onClick={handleSubmit}>
            保存
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <FormField label="品牌名" required error={errors.name}>
          <Input
            value={values.name}
            onChange={(e) => setValues({ ...values, name: e.target.value })}
            maxLength={80}
            placeholder="如 Apple"
          />
        </FormField>

        <FormField
          label="Slug"
          required
          error={errors.slug}
          description="URL 用；小写字母/数字/连字符"
        >
          <Input
            value={values.slug}
            onChange={(e) => setValues({ ...values, slug: e.target.value })}
            maxLength={80}
            placeholder="如 apple"
          />
        </FormField>

        <FormField label="品牌介绍" description="选填，最多 500 字">
          <textarea
            className="block h-20 w-full resize-none rounded border border-[color:var(--color-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)] focus:ring-1 focus:ring-[color:var(--color-primary)]/20"
            value={values.description}
            onChange={(e) =>
              setValues({ ...values, description: e.target.value })
            }
            maxLength={500}
          />
        </FormField>

        <FormField label="Logo" description="选填。方形图，≤5MB">
          <ImageUpload
            value={values.logo_url}
            onChange={(key) => setValues({ ...values, logo_url: key })}
            purpose="brand_logo"
            onError={(msg) =>
              toast.push({ type: "error", message: msg })
            }
          />
        </FormField>

        <FormField label="排序" description="数值越小越靠前">
          <Input
            type="number"
            value={values.sort_order}
            onChange={(e) =>
              setValues({
                ...values,
                sort_order: Number(e.target.value) || 0,
              })
            }
          />
        </FormField>

        <FormField label="是否可见">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={values.is_visible}
              onChange={(e) =>
                setValues({ ...values, is_visible: e.target.checked })
              }
            />
            对外可见（用户端展示）
          </label>
        </FormField>
      </div>
    </Modal>
  );
}

function emptyValues(): BrandFormValues {
  return {
    name: "",
    slug: "",
    logo_url: null,
    description: "",
    sort_order: 0,
    is_visible: true,
  };
}

// ---------------------------------------------------------------------------
// 删除确认
// ---------------------------------------------------------------------------

function DeleteBrandConfirmModal({
  brand,
  submitting,
  onClose,
  onConfirm,
}: {
  brand: BrandOut | null;
  submitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={brand !== null}
      onClose={submitting ? () => undefined : onClose}
      title="确认删除品牌"
      closeOnOverlay={!submitting}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            取消
          </Button>
          <Button variant="danger" loading={submitting} onClick={onConfirm}>
            确认删除
          </Button>
        </>
      }
    >
      <p className="text-sm text-neutral-700">
        即将软删品牌「
        <strong className="text-neutral-900">{brand?.name}</strong>」。
        若该品牌已被商品引用，后端会阻止删除。
      </p>
    </Modal>
  );
}

function toastApiError(
  toast: ReturnType<typeof useToast>,
  err: unknown,
) {
  const msg =
    err instanceof ApiError
      ? getErrorMessage(err.code, err.message)
      : "操作失败，请稍后重试";
  toast.push({ type: "error", message: msg });
}
