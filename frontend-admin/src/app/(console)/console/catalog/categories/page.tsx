"use client";

/**
 * 类目管理页 (`/console/catalog/categories`)。
 *
 * 契约 §6.1：
 * - 类目最大 3 级
 * - PATCH 不支持改 parent_id（要移动就删了重建）
 * - DELETE 时若有子类目或被 SPU 引用返回 6002
 *
 * UI 要素：
 * - 顶部：标题 + 「新建根类目」按钮
 * - 主体：CategoryTreeEditor（编辑 / 删除 / 添加子类目 / 上下移）
 * - Modal：新建 / 编辑（复用同一个表单组件）
 * - 删除二次确认（带 6002 错误提示）
 * - RequirePermission "admin:category:manage"
 *
 * 排序策略：本地"上下移"直接调 PATCH 相邻两节点的 sort_order（swap）。
 * 后端如提供批量 reorder 端点后端可优化，本 Phase 用双 PATCH 简化。
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RequirePermission } from "@/components/auth/RequirePermission";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ImageUpload } from "@/components/ui/ImageUpload";
import {
  CategoryTreeEditor,
  countTreeNodes,
} from "@/components/ui/CategoryTreeEditor";
import {
  createCategory,
  deleteCategory,
  updateCategory,
} from "@/lib/category-api";
import { useCategories } from "@/hooks/useCatalog";
import { ApiError } from "@/lib/api";
import { getErrorMessage } from "@/types/errors";
import type {
  CategoryTreeNode,
  CreateCategoryPayload,
  UpdateCategoryPayload,
} from "@/types/api";

export default function CategoriesPage() {
  return (
    <RequirePermission permission="admin:category:manage">
      <CategoriesInner />
    </RequirePermission>
  );
}

type FormMode =
  | { kind: "create-root" }
  | { kind: "create-child"; parent: CategoryTreeNode }
  | { kind: "edit"; node: CategoryTreeNode };

function CategoriesInner() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: tree = [], isLoading, isError, refetch } = useCategories();

  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [pendingDelete, setPendingDelete] =
    useState<CategoryTreeNode | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });

  const createMutation = useMutation({
    mutationFn: (payload: CreateCategoryPayload) => createCategory(payload),
    onSuccess: () => {
      setFormMode(null);
      toast.push({ type: "success", message: "类目已创建" });
      invalidate();
      queryClient.invalidateQueries({
        queryKey: ["dashboard", "category-tree"],
      });
    },
    onError: (err) => toastApiError(toast, err),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: UpdateCategoryPayload;
    }) => updateCategory(id, payload),
    onSuccess: () => {
      setFormMode(null);
      toast.push({ type: "success", message: "类目已更新" });
      invalidate();
    },
    onError: (err) => toastApiError(toast, err),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteCategory(id),
    onSuccess: () => {
      setPendingDelete(null);
      toast.push({ type: "success", message: "类目已删除" });
      invalidate();
      queryClient.invalidateQueries({
        queryKey: ["dashboard", "category-tree"],
      });
    },
    onError: (err) => {
      // 6002 = 有子类目或被引用
      if (err instanceof ApiError && err.code === 6002) {
        toast.push({
          type: "error",
          message: getErrorMessage(6002),
        });
      } else {
        toastApiError(toast, err);
      }
    },
  });

  const moveMutation = useMutation({
    mutationFn: async ({
      a,
      b,
    }: {
      a: CategoryTreeNode;
      b: CategoryTreeNode;
    }) => {
      // 交换 sort_order：先把 a 改成 b 的 sort_order，再把 b 改成 a 原有的。
      await updateCategory(a.id, { sort_order: b.sort_order });
      await updateCategory(b.id, { sort_order: a.sort_order });
    },
    onSuccess: () => {
      invalidate();
    },
    onError: (err) => toastApiError(toast, err),
  });

  const handleSubmit = (
    payload: CreateCategoryPayload | UpdateCategoryPayload,
  ) => {
    if (!formMode) return;
    if (formMode.kind === "edit") {
      updateMutation.mutate({
        id: formMode.node.id,
        payload: payload as UpdateCategoryPayload,
      });
    } else if (formMode.kind === "create-root") {
      createMutation.mutate({
        ...(payload as CreateCategoryPayload),
        parent_id: null,
      });
    } else {
      createMutation.mutate({
        ...(payload as CreateCategoryPayload),
        parent_id: formMode.parent.id,
      });
    }
  };

  const submitting = createMutation.isPending || updateMutation.isPending;
  const totalNodes = countTreeNodes(tree);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">类目管理</h1>
          <p className="mt-1 text-sm text-neutral-500">
            维护商品类目树。最大 3 级；类目删除仅在无子类目 / 无商品引用时允许。
            {totalNodes > 0 ? ` 当前共 ${totalNodes} 个类目。` : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => refetch()}
            loading={isLoading}
          >
            刷新
          </Button>
          <Button onClick={() => setFormMode({ kind: "create-root" })}>
            + 新建根类目
          </Button>
        </div>
      </header>

      {isError ? (
        <div className="rounded border border-red-200 bg-[color:var(--color-danger-soft)] px-3 py-2 text-xs text-[color:var(--color-danger)]">
          加载失败，请点击右上角「刷新」重试。
        </div>
      ) : null}

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <CategoryTreeEditor
          tree={tree}
          onEdit={(node) => setFormMode({ kind: "edit", node })}
          onDelete={(node) => setPendingDelete(node)}
          onAddChild={(parent) => setFormMode({ kind: "create-child", parent })}
          onMove={(node, direction, siblings) => {
            const idx = siblings.findIndex((s) => s.id === node.id);
            const target =
              direction === "up"
                ? siblings[idx - 1]
                : siblings[idx + 1];
            if (!target) return;
            moveMutation.mutate({ a: node, b: target });
          }}
        />
      )}

      <CategoryFormModal
        mode={formMode}
        submitting={submitting}
        onClose={() => setFormMode(null)}
        onSubmit={handleSubmit}
      />

      <DeleteConfirmModal
        node={pendingDelete}
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
// 表单弹窗（新建 / 编辑复用）
// ---------------------------------------------------------------------------

interface CategoryFormValues {
  name: string;
  slug: string;
  icon_url: string | null;
  sort_order: number;
  is_visible: boolean;
}

function CategoryFormModal({
  mode,
  submitting,
  onClose,
  onSubmit,
}: {
  mode: FormMode | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateCategoryPayload | UpdateCategoryPayload) => void;
}) {
  const open = mode !== null;

  const [values, setValues] = useState<CategoryFormValues>(() => emptyValues());
  const [errors, setErrors] = useState<
    Partial<Record<keyof CategoryFormValues, string>>
  >({});
  const toast = useToast();

  // mode 变化时重置表单
  const modeKey =
    mode?.kind === "edit"
      ? `edit-${mode.node.id}`
      : mode?.kind === "create-child"
        ? `child-${mode.parent.id}`
        : mode?.kind === "create-root"
          ? "create-root"
          : "";
  const [lastKey, setLastKey] = useState("");
  if (open && modeKey !== lastKey) {
    setLastKey(modeKey);
    if (mode?.kind === "edit") {
      setValues({
        name: mode.node.name,
        slug: mode.node.slug,
        icon_url: mode.node.icon_url,
        sort_order: mode.node.sort_order,
        is_visible: mode.node.is_visible,
      });
    } else {
      setValues(emptyValues());
    }
    setErrors({});
  }

  const title =
    mode?.kind === "edit"
      ? `编辑类目「${mode.node.name}」`
      : mode?.kind === "create-child"
        ? `在「${mode.parent.name}」下新建子类目`
        : "新建根类目";

  const handleSubmit = () => {
    const nextErrors: typeof errors = {};
    if (!values.name.trim()) nextErrors.name = "请填写类目名";
    if (values.name.trim().length > 60) nextErrors.name = "名称不超过 60 字";
    if (!values.slug.trim()) nextErrors.slug = "请填写 slug";
    if (!/^[a-z0-9-]{2,60}$/.test(values.slug.trim())) {
      nextErrors.slug = "slug 只能包含小写字母/数字/连字符，2-60 字";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onSubmit({
      name: values.name.trim(),
      slug: values.slug.trim(),
      icon_url: values.icon_url,
      sort_order: values.sort_order,
      is_visible: values.is_visible,
    });
  };

  return (
    <Modal
      open={open}
      onClose={submitting ? () => undefined : onClose}
      title={title}
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
        <FormField
          label="类目名"
          required
          error={errors.name}
          description="用户端看到的展示名"
        >
          <Input
            value={values.name}
            onChange={(e) => setValues({ ...values, name: e.target.value })}
            maxLength={60}
            placeholder="如 手机"
          />
        </FormField>

        <FormField
          label="Slug"
          required
          error={errors.slug}
          description="URL 用；小写字母/数字/连字符；创建后不建议修改"
        >
          <Input
            value={values.slug}
            onChange={(e) => setValues({ ...values, slug: e.target.value })}
            maxLength={60}
            placeholder="如 phones"
          />
        </FormField>

        <FormField
          label="排序 (sort_order)"
          description="同级内数值越小越靠前；默认 0"
        >
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

        <FormField label="图标" description="选填。类目 icon（≤5MB）">
          <ImageUpload
            value={values.icon_url}
            onChange={(key) => setValues({ ...values, icon_url: key })}
            purpose="category_icon"
            onError={(msg) =>
              toast.push({ type: "error", message: msg })
            }
          />
        </FormField>

        <FormField label="是否对外可见">
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

function emptyValues(): CategoryFormValues {
  return {
    name: "",
    slug: "",
    icon_url: null,
    sort_order: 0,
    is_visible: true,
  };
}

// ---------------------------------------------------------------------------
// 删除确认弹窗
// ---------------------------------------------------------------------------

function DeleteConfirmModal({
  node,
  submitting,
  onClose,
  onConfirm,
}: {
  node: CategoryTreeNode | null;
  submitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const open = node !== null;
  const hasChildren = (node?.children.length ?? 0) > 0;

  return (
    <Modal
      open={open}
      onClose={submitting ? () => undefined : onClose}
      title="确认删除类目"
      closeOnOverlay={!submitting}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            取消
          </Button>
          <Button
            variant="danger"
            loading={submitting}
            onClick={onConfirm}
            disabled={hasChildren}
          >
            确认删除
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2 text-sm text-neutral-700">
        <p>
          即将软删类目「
          <strong className="text-neutral-900">{node?.name}</strong>」
          （level {node?.level}）。
        </p>
        {hasChildren ? (
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            当前类目下仍有 {node?.children.length} 个子类目，请先删除或迁移它们。
          </p>
        ) : (
          <p className="text-xs text-neutral-500">
            若类目已被商品引用，后端将返回错误并阻止删除（6002）。
          </p>
        )}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------------

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
