"use client";

/**
 * 商品审核详情页 (`/console/products/review/[id]`)。
 *
 * 契约 §7：
 * - GET  /admin/spus/{id}                     详情（含 SKU 列表）
 * - POST /admin/spus/{id}/approve             { review_note? }
 * - POST /admin/spus/{id}/reject              { review_note }（5-500 字必填）
 * - POST /admin/spus/{id}/force-offshelf      { review_note }（5-500 字必填）
 *
 * UI 要素：
 * - 完整信息：主图 + 图集 + 标题/副标题/描述 + 类目路径面包屑 + 品牌 + SKU 表格
 * - 审核 Timeline：提交时间 + 最近一次审核 + review_history（若后端返回）
 * - 若 status=pending_review：按钮「通过审批」/「驳回申请」
 * - 若 status=approved：按钮「强制下架」
 * - RequirePermission：读用 read_all；approve/reject 用 review；force-offshelf 用 force_offshelf
 */

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RequirePermission } from "@/components/auth/RequirePermission";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, type TableColumn } from "@/components/ui/Table";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { usePermission } from "@/hooks/useAuth";
import { useSPUDetail } from "@/hooks/useCatalog";
import {
  approveSPU,
  forceOffshelfSPU,
  rejectSPU,
} from "@/lib/product-api";
import { ApiError } from "@/lib/api";
import { getErrorMessage } from "@/types/errors";
import { imagePlaceholder, imageUrl } from "@/lib/image";
import type {
  AdminSPUDetail,
  ReviewRecord,
  SKUOut,
} from "@/types/api";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function SPUDetailPage(props: PageProps) {
  const { id } = use(props.params);
  return (
    <RequirePermission permission="admin:spu:read_all">
      <SPUDetailInner id={id} />
    </RequirePermission>
  );
}

function SPUDetailInner({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const canReview = usePermission("admin:spu:review");
  const canForceOffshelf = usePermission("admin:spu:force_offshelf");

  const { data, isLoading, isError, error } = useSPUDetail(id);

  const [modal, setModal] = useState<
    "approve" | "reject" | "force_offshelf" | null
  >(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "spu", String(id)] });
    queryClient.invalidateQueries({ queryKey: ["admin", "spus"] });
    queryClient.invalidateQueries({
      queryKey: ["dashboard", "pending-spus-count"],
    });
    queryClient.invalidateQueries({
      queryKey: ["dashboard", "approved-spus-count"],
    });
  };

  const approveMutation = useMutation({
    mutationFn: (review_note?: string) =>
      approveSPU(id, review_note ? { review_note } : {}),
    onSuccess: () => {
      setModal(null);
      toast.push({ type: "success", message: "已通过审批" });
      invalidate();
    },
    onError: (err) => {
      const msg =
        err instanceof ApiError ? getErrorMessage(err.code, err.message) : "操作失败";
      toast.push({ type: "error", message: msg });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (review_note: string) =>
      rejectSPU(id, { review_note }),
    onSuccess: () => {
      setModal(null);
      toast.push({ type: "success", message: "已驳回" });
      invalidate();
      router.push("/console/products/review?status=rejected");
    },
    onError: (err) => {
      const msg =
        err instanceof ApiError ? getErrorMessage(err.code, err.message) : "操作失败";
      toast.push({ type: "error", message: msg });
    },
  });

  const forceOffshelfMutation = useMutation({
    mutationFn: (review_note: string) =>
      forceOffshelfSPU(id, { review_note }),
    onSuccess: () => {
      setModal(null);
      toast.push({ type: "success", message: "已强制下架" });
      invalidate();
      router.push("/console/products/review?status=off_shelf");
    },
    onError: (err) => {
      const msg =
        err instanceof ApiError ? getErrorMessage(err.code, err.message) : "操作失败";
      toast.push({ type: "error", message: msg });
    },
  });

  if (isLoading) return <DetailSkeleton />;

  if (isError || !data) {
    return (
      <div className="rounded border border-red-200 bg-[color:var(--color-danger-soft)] px-4 py-3 text-sm text-[color:var(--color-danger)]">
        {error instanceof ApiError
          ? getErrorMessage(error.code, error.message)
          : "商品详情加载失败"}
        <div className="mt-2">
          <Link
            href="/console/products/review"
            className="text-[color:var(--color-info)] hover:underline"
          >
            返回列表
          </Link>
        </div>
      </div>
    );
  }

  const spu = data;
  const showApproveReject = spu.status === "pending_review" && canReview;
  const showForceOffshelf = spu.status === "approved" && canForceOffshelf;
  const categoryPath = spu.category?.path ?? [];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/console/products/review"
            className="mb-2 inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-800"
          >
            ← 返回审核队列
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-neutral-900">
              {spu.title}
            </h1>
            <StatusBadge status={spu.status} />
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            SPU #{spu.id} · 店铺{" "}
            {spu.shop?.name ?? `#${spu.shop_id}`} · 提交于{" "}
            {formatDateTime(spu.created_at)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {showApproveReject ? (
            <>
              <Button
                variant="secondary"
                onClick={() => setModal("reject")}
                className="!text-[color:var(--color-danger)]"
              >
                驳回申请
              </Button>
              <Button onClick={() => setModal("approve")}>通过审批</Button>
            </>
          ) : null}
          {showForceOffshelf ? (
            <Button
              variant="danger"
              onClick={() => setModal("force_offshelf")}
            >
              强制下架
            </Button>
          ) : null}
        </div>
      </div>

      {/* 基本信息 */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(240px,320px)_1fr]">
        {/* 图片区 */}
        <div className="flex flex-col gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl(spu.main_image)}
            alt={spu.title}
            className="aspect-square w-full rounded-md border border-[color:var(--color-border)] object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = imagePlaceholder();
            }}
          />
          {spu.images && spu.images.length > 0 ? (
            <div className="grid grid-cols-4 gap-2">
              {spu.images.map((k) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={k}
                  src={imageUrl(k)}
                  alt="额外展示图"
                  className="aspect-square w-full rounded border border-[color:var(--color-border)] object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src =
                      imagePlaceholder();
                  }}
                />
              ))}
            </div>
          ) : null}
        </div>

        {/* 信息区 */}
        <div className="flex flex-col gap-4">
          <section className="rounded-md border border-[color:var(--color-border)] bg-white">
            <header className="border-b border-[color:var(--color-border)] px-4 py-3 text-sm font-semibold text-neutral-800">
              商品信息
            </header>
            <dl className="grid grid-cols-1 gap-y-3 gap-x-6 p-4 sm:grid-cols-2">
              <Field label="标题" full>
                <span className="text-neutral-900">{spu.title}</span>
              </Field>
              {spu.subtitle ? (
                <Field label="副标题" full>
                  {spu.subtitle}
                </Field>
              ) : null}
              <Field label="所属店铺">
                {spu.shop?.name ?? "—"}
                <span className="ml-1 text-xs text-neutral-400">
                  #{spu.shop_id}
                </span>
              </Field>
              <Field label="类目">
                {categoryPath.length > 0 ? (
                  <span className="text-sm text-neutral-700">
                    {categoryPath.map((c) => c.name).join(" / ")}
                  </span>
                ) : (
                  <span>{spu.category?.name ?? `#${spu.category_id}`}</span>
                )}
              </Field>
              <Field label="品牌">
                {spu.brand ? (
                  <span className="inline-flex items-center gap-2">
                    <BrandLogo
                      objectKey={spu.brand.logo_url}
                      name={spu.brand.name}
                      size={20}
                    />
                    <span>{spu.brand.name}</span>
                  </span>
                ) : (
                  <span className="text-neutral-400">未指定</span>
                )}
              </Field>
              <Field label="规格轴">
                {spu.spec_axes.length > 0 ? (
                  <span className="tabular-nums text-neutral-700">
                    {spu.spec_axes.join(" / ")}
                  </span>
                ) : (
                  <span className="text-neutral-400">单规格</span>
                )}
              </Field>
              <Field label="销量 / 浏览">
                <span className="tabular-nums text-neutral-700">
                  {spu.sales_count} · {spu.view_count}
                </span>
              </Field>
              <Field label="价格区间">
                {formatPriceRange(
                  spu.min_price_cents,
                  spu.max_price_cents,
                )}
              </Field>
              {spu.published_at ? (
                <Field label="首次通过时间">
                  {formatDateTime(spu.published_at)}
                </Field>
              ) : null}
              {spu.description ? (
                <Field label="商品详情" full>
                  <p className="whitespace-pre-wrap text-sm text-neutral-700">
                    {spu.description}
                  </p>
                </Field>
              ) : null}
            </dl>
          </section>
        </div>
      </section>

      {/* SKU 表格 */}
      <section className="rounded-md border border-[color:var(--color-border)] bg-white">
        <header className="border-b border-[color:var(--color-border)] px-4 py-3 text-sm font-semibold text-neutral-800">
          SKU 列表（{spu.skus.length}）
        </header>
        <div className="p-4">
          <SKUTable rows={[...spu.skus]} />
        </div>
      </section>

      {/* Timeline */}
      <section className="rounded-md border border-[color:var(--color-border)] bg-white">
        <header className="border-b border-[color:var(--color-border)] px-4 py-3 text-sm font-semibold text-neutral-800">
          审核记录
        </header>
        <ul className="flex flex-col gap-3 p-4 text-sm">
          <TimelineItem
            time={formatDateTime(spu.created_at)}
            title="商家提交"
            body={`SPU #${spu.id} 创建`}
          />
          {(spu.review_history ?? [])
            .slice()
            .sort(
              (a, b) =>
                new Date(a.reviewed_at).getTime() -
                new Date(b.reviewed_at).getTime(),
            )
            .map((r, i) => (
              <TimelineItem
                key={`${r.reviewed_at}-${i}`}
                time={formatDateTime(r.reviewed_at)}
                title={reviewActionLabel(r.action)}
                body={
                  <>
                    <div>
                      审核人：
                      {r.reviewer_display_name ||
                        (r.reviewer_admin_id
                          ? `管理员 #${r.reviewer_admin_id}`
                          : "—")}
                    </div>
                    {r.review_note ? (
                      <div className="mt-1 whitespace-pre-wrap rounded bg-neutral-50 px-2 py-1 text-xs text-neutral-700">
                        备注：{r.review_note}
                      </div>
                    ) : null}
                  </>
                }
                tone={reviewActionTone(r.action)}
              />
            ))}
          {/* 若后端未返回 review_history 但有 reviewed_at 兜底展示一条 */}
          {(!spu.review_history || spu.review_history.length === 0) &&
          spu.reviewed_at ? (
            <TimelineItem
              time={formatDateTime(spu.reviewed_at)}
              title={
                spu.status === "approved"
                  ? "审核通过"
                  : spu.status === "rejected"
                    ? "审核驳回"
                    : spu.status === "off_shelf"
                      ? "强制下架"
                      : "审核处理"
              }
              body={
                <>
                  <div>
                    审核人：
                    {spu.reviewer_admin_id
                      ? `管理员 #${spu.reviewer_admin_id}`
                      : "—"}
                  </div>
                  {spu.review_note ? (
                    <div className="mt-1 whitespace-pre-wrap rounded bg-neutral-50 px-2 py-1 text-xs text-neutral-700">
                      备注：{spu.review_note}
                    </div>
                  ) : null}
                </>
              }
              tone={
                spu.status === "rejected" || spu.status === "off_shelf"
                  ? "danger"
                  : "success"
              }
            />
          ) : null}
          {spu.status === "pending_review" ? (
            <TimelineItem
              time="—"
              title="等待审核"
              body="尚未有管理员处理此商品"
              tone="warning"
            />
          ) : null}
        </ul>
      </section>

      {/* Approve Modal */}
      <ApproveModal
        open={modal === "approve"}
        onClose={() => setModal(null)}
        onSubmit={(note) => approveMutation.mutate(note || undefined)}
        submitting={approveMutation.isPending}
      />

      {/* Reject Modal */}
      <ReviewNoteModal
        open={modal === "reject"}
        onClose={() => setModal(null)}
        title="驳回商品"
        confirmText="确认驳回"
        confirmVariant="danger"
        placeholder="请填写驳回理由，将展示给商家（5-500 字）"
        onSubmit={(note) => rejectMutation.mutate(note)}
        submitting={rejectMutation.isPending}
      />

      {/* Force Offshelf Modal */}
      <ReviewNoteModal
        open={modal === "force_offshelf"}
        onClose={() => setModal(null)}
        title="强制下架商品"
        confirmText="确认强制下架"
        confirmVariant="danger"
        placeholder="请填写下架理由，将记录到审核历史（5-500 字）"
        onSubmit={(note) => forceOffshelfMutation.mutate(note)}
        submitting={forceOffshelfMutation.isPending}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// SKU 表格
// ---------------------------------------------------------------------------

function SKUTable({ rows }: { rows: SKUOut[] }) {
  const columns: TableColumn<SKUOut>[] = [
    {
      key: "sku_code",
      title: "SKU Code",
      render: (r) => (
        <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs">
          {r.sku_code}
        </code>
      ),
    },
    {
      key: "specs",
      title: "规格",
      render: (r) => (
        <span className="text-xs text-neutral-700">
          {Object.entries(r.specs)
            .map(([k, v]) => `${k}=${v}`)
            .join(" · ") || "—"}
        </span>
      ),
    },
    {
      key: "price",
      title: "价格",
      render: (r) => (
        <div className="text-sm tabular-nums text-neutral-800">
          ¥{(r.price_cents / 100).toFixed(2)}
          {r.original_price_cents ? (
            <span className="ml-1 text-xs text-neutral-400 line-through">
              ¥{(r.original_price_cents / 100).toFixed(2)}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: "stock",
      title: "库存",
      align: "center",
      width: 100,
      render: (r) => (
        <span className="tabular-nums text-neutral-700">
          {r.stock}
          {r.locked_stock ? (
            <span className="ml-1 text-xs text-neutral-400">
              (锁 {r.locked_stock})
            </span>
          ) : null}
        </span>
      ),
    },
    {
      key: "is_active",
      title: "启用",
      align: "center",
      width: 80,
      render: (r) => (r.is_active ? "是" : "否"),
    },
  ];

  return (
    <Table
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      emptyText="该商品尚无 SKU"
    />
  );
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

function TimelineItem({
  time,
  title,
  body,
  tone = "default",
}: {
  time: string;
  title: string;
  body?: React.ReactNode;
  tone?: "default" | "success" | "danger" | "warning";
}) {
  const dotColor = {
    default: "bg-neutral-300",
    success: "bg-[color:var(--color-success)]",
    danger: "bg-[color:var(--color-danger)]",
    warning: "bg-[color:var(--color-warning)]",
  }[tone];

  return (
    <li className="flex gap-3">
      <span
        aria-hidden
        className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${dotColor}`}
      />
      <div className="flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium text-neutral-800">{title}</span>
          <span className="text-xs text-neutral-400 tabular-nums">{time}</span>
        </div>
        {body ? (
          <div className="mt-1 text-xs text-neutral-600">{body}</div>
        ) : null}
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Modals
// ---------------------------------------------------------------------------

function ApproveModal({
  open,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (note: string) => void;
  submitting: boolean;
}) {
  const [note, setNote] = useState("");
  return (
    <Modal
      open={open}
      onClose={submitting ? () => undefined : onClose}
      title="通过商品审核"
      closeOnOverlay={!submitting}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            取消
          </Button>
          <Button loading={submitting} onClick={() => onSubmit(note.trim())}>
            确认通过
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-neutral-600">
          审核通过后商品会立即上架，用户端可见并可下单。首次通过将写入{" "}
          <code>published_at</code>。
        </p>
        <FormField
          label="审核备注（可选）"
          description="用于内部记录，不会展示给商家"
        >
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            placeholder="例如：资料齐全"
          />
        </FormField>
      </div>
    </Modal>
  );
}

function ReviewNoteModal({
  open,
  onClose,
  onSubmit,
  submitting,
  title,
  confirmText,
  confirmVariant,
  placeholder,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (note: string) => void;
  submitting: boolean;
  title: string;
  confirmText: string;
  confirmVariant: "primary" | "danger";
  placeholder: string;
}) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  // 打开时清空
  const openKey = open ? "open" : "closed";
  const [lastOpen, setLastOpen] = useState("closed");
  if (openKey !== lastOpen) {
    setLastOpen(openKey);
    if (open) {
      setNote("");
      setError(null);
    }
  }

  const handleSubmit = () => {
    const trimmed = note.trim();
    if (trimmed.length < 5 || trimmed.length > 500) {
      setError("备注需 5-500 字");
      return;
    }
    setError(null);
    onSubmit(trimmed);
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
          <Button
            variant={confirmVariant}
            loading={submitting}
            onClick={handleSubmit}
          >
            {confirmText}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <FormField label="备注" required error={error}>
          <textarea
            className="block h-28 w-full resize-none rounded border border-[color:var(--color-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)] focus:ring-1 focus:ring-[color:var(--color-primary)]/20"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            aria-invalid={Boolean(error)}
            placeholder={placeholder}
          />
        </FormField>
        <div className="text-right text-xs text-neutral-400">
          {note.trim().length} / 500
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2" : undefined}>
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-neutral-800">{children}</dd>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function formatPriceRange(minC: number, maxC: number): string {
  const min = (minC / 100).toFixed(2);
  const max = (maxC / 100).toFixed(2);
  if (minC === maxC) return `¥${min}`;
  return `¥${min} ~ ¥${max}`;
}

function reviewActionLabel(action: ReviewRecord["action"]): string {
  switch (action) {
    case "approve":
      return "审核通过";
    case "reject":
      return "审核驳回";
    case "force_offshelf":
      return "强制下架";
    default:
      return "审核处理";
  }
}

function reviewActionTone(
  action: ReviewRecord["action"],
): "success" | "danger" | "warning" {
  switch (action) {
    case "approve":
      return "success";
    case "reject":
      return "danger";
    case "force_offshelf":
      return "danger";
    default:
      return "warning";
  }
}

export type { AdminSPUDetail };
