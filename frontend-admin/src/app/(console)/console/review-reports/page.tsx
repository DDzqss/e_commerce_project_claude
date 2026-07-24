"use client";

/**
 * 评价举报处理队列 (`/console/review-reports`)。
 *
 * 契约 §5.5：
 * - GET  /admin/review-reports?status=pending&page=&size=
 * - POST /admin/review-reports/{id}/uphold   同事务隐藏评价
 * - POST /admin/review-reports/{id}/dismiss  驳回举报
 *
 * UI 要素：
 * - Status tab（pending / upheld / dismissed）
 * - 顶部统计：待处理数（红色高亮）
 * - Table：关联评价 + 举报人 + reason category badge + note + 状态
 * - 每行"处理"按钮 → HandleReportModal（uphold/dismiss + note ≥ 5 字）
 *
 * 权限：admin:review_report:handle
 */

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RequirePermission } from "@/components/auth/RequirePermission";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { StarRating } from "@/components/ui/StarRating";
import { StatCard } from "@/components/console/StatCard";
import { Table, type TableColumn } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import {
  HandleReportModal,
  type HandleReportAction,
} from "@/components/reports/HandleReportModal";
import { reportReasonLabel } from "@/components/reports/ReportItem";
import { useReports, usePendingReportsCount } from "@/hooks/useReports";
import { dismissReport, upholdReport } from "@/lib/review-report-api";
import { ApiError } from "@/lib/api";
import { getErrorMessage } from "@/types/errors";
import type {
  AdminReviewReportListItem,
  ReviewReportReasonCategory,
  ReviewReportStatus,
} from "@/types/review";

const PAGE_SIZE = 20;

const STATUS_TABS: { key: ReviewReportStatus; label: string }[] = [
  { key: "pending", label: "待处理" },
  { key: "upheld", label: "举报成立" },
  { key: "dismissed", label: "已驳回" },
];

const STATUS_META: Record<
  ReviewReportStatus,
  { label: string; tone: BadgeTone }
> = {
  pending: { label: "待处理", tone: "warning" },
  upheld: { label: "举报成立", tone: "danger" },
  dismissed: { label: "已驳回", tone: "default" },
};

const REASON_TONE: Record<ReviewReportReasonCategory, BadgeTone> = {
  ad_spam: "warning",
  inappropriate: "danger",
  fake_review: "danger",
  offensive: "danger",
  irrelevant: "info",
  other: "default",
};

export default function AdminReviewReportsPage() {
  return (
    <RequirePermission permission="admin:review_report:handle">
      <Suspense
        fallback={<div className="text-sm text-neutral-400">加载中…</div>}
      >
        <AdminReviewReportsInner />
      </Suspense>
    </RequirePermission>
  );
}

function AdminReviewReportsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const queryClient = useQueryClient();

  const initialStatus = (searchParams.get("status") ??
    "pending") as ReviewReportStatus;
  const initialReviewId = searchParams.get("review_id") ?? "";
  const initialPage = Number(searchParams.get("page") ?? "1") || 1;

  const [status, setStatus] = useState<ReviewReportStatus>(initialStatus);
  const [reviewIdInput, setReviewIdInput] = useState(initialReviewId);
  const [debouncedReviewId, setDebouncedReviewId] = useState(initialReviewId);
  const [page, setPage] = useState(initialPage);

  // 输入去抖
  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedReviewId(reviewIdInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(handle);
  }, [reviewIdInput]);

  // URL 同步
  useEffect(() => {
    const params = new URLSearchParams();
    if (status !== "pending") params.set("status", status);
    if (debouncedReviewId) params.set("review_id", debouncedReviewId);
    if (page !== 1) params.set("page", String(page));
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }, [status, debouncedReviewId, page, router]);

  const query = useMemo(
    () => ({
      status,
      review_id: debouncedReviewId || undefined,
      page,
      size: PAGE_SIZE,
    }),
    [status, debouncedReviewId, page],
  );

  const { data, isLoading, isFetching, isError, refetch } = useReports(query);
  const pendingCount = usePendingReportsCount();

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;

  // 处理弹窗
  const [handleTarget, setHandleTarget] =
    useState<AdminReviewReportListItem | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "review-reports"] });
    queryClient.invalidateQueries({ queryKey: ["admin", "reviews-list"] });
  };

  const handleMutation = useMutation({
    mutationFn: (payload: {
      id: number;
      action: HandleReportAction;
      review_note: string;
    }) =>
      payload.action === "uphold"
        ? upholdReport(payload.id, { review_note: payload.review_note })
        : dismissReport(payload.id, { review_note: payload.review_note }),
    onSuccess: (_res, vars) => {
      setHandleTarget(null);
      toast.push({
        type: "success",
        message: vars.action === "uphold" ? "举报成立，评价已隐藏" : "已驳回举报",
      });
      invalidate();
    },
    onError: (err) => {
      const msg =
        err instanceof ApiError
          ? getErrorMessage(err.code, err.message)
          : "操作失败";
      toast.push({ type: "error", message: msg });
    },
  });

  const columns: TableColumn<AdminReviewReportListItem>[] = [
    {
      key: "id",
      title: "举报 #",
      width: 80,
      render: (row) => (
        <span className="text-xs tabular-nums text-neutral-700">#{row.id}</span>
      ),
    },
    {
      key: "review",
      title: "关联评价",
      render: (row) => (
        <div className="flex min-w-0 items-start gap-2">
          {row.review ? (
            <div className="min-w-0 flex-1">
              <div className="mb-0.5 flex items-center gap-2">
                <StarRating rating={row.review.rating} size="sm" />
                <Link
                  href={`/console/reviews/${row.review.id}`}
                  className="text-[11px] text-[color:var(--color-info)] hover:underline"
                >
                  评价 #{row.review.id}
                </Link>
                {!row.review.visible ? (
                  <Badge tone="danger">已隐藏</Badge>
                ) : null}
              </div>
              <p className="line-clamp-2 whitespace-pre-wrap text-xs text-neutral-700">
                {row.review.content}
              </p>
              <div className="mt-0.5 truncate text-[10px] text-neutral-400">
                {row.review.spu?.title ?? `SPU #${row.review.spu_id}`} ·{" "}
                {row.review.shop?.name ?? `店铺 #${row.review.shop_id}`}
              </div>
            </div>
          ) : (
            <Link
              href={`/console/reviews/${row.review_id}`}
              className="text-xs text-[color:var(--color-info)] hover:underline"
            >
              打开评价 #{row.review_id}
            </Link>
          )}
        </div>
      ),
    },
    {
      key: "reporter",
      title: "举报人",
      width: 160,
      render: (row) => (
        <div className="text-xs text-neutral-700">
          <div>
            {row.reporter?.nickname || (
              <span className="text-neutral-400">—</span>
            )}
            <span className="ml-1 text-neutral-400">
              #{row.reporter_user_id}
            </span>
          </div>
          {row.reporter?.phone ? (
            <div className="tabular-nums text-neutral-500">
              {row.reporter.phone}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      key: "reason",
      title: "理由",
      width: 200,
      render: (row) => (
        <div className="flex flex-col gap-1">
          <Badge tone={REASON_TONE[row.reason_category]}>
            {reportReasonLabel(row.reason_category)}
          </Badge>
          {row.reason_note ? (
            <div className="line-clamp-2 whitespace-pre-wrap text-[11px] text-neutral-600">
              {row.reason_note}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      key: "status",
      title: "状态",
      width: 110,
      render: (row) => {
        const meta = STATUS_META[row.status];
        return <Badge tone={meta.tone}>{meta.label}</Badge>;
      },
    },
    {
      key: "created_at",
      title: "举报时间",
      width: 140,
      render: (row) => (
        <span className="text-xs text-neutral-500 tabular-nums">
          {formatDateTime(row.created_at)}
        </span>
      ),
    },
    {
      key: "actions",
      title: "操作",
      align: "right",
      width: 120,
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          {row.status === "pending" ? (
            <Button
              size="sm"
              variant="primary"
              onClick={() => setHandleTarget(row)}
            >
              处理
            </Button>
          ) : (
            <span className="text-xs text-neutral-400">已处理</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">
            评价举报处理队列
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            用户对评价的举报集中处理台。成立时同事务隐藏评价并通知作者。
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => refetch()}
          loading={isFetching && !isLoading}
        >
          刷新
        </Button>
      </header>

      {/* 顶部统计 */}
      <section
        aria-label="举报队列大盘"
        className="grid grid-cols-1 gap-4 sm:grid-cols-3"
      >
        <StatCard
          label="待处理举报"
          value={
            pendingCount.isLoading
              ? "…"
              : pendingCount.isError
                ? "—"
                : String(pendingCount.data?.total ?? 0)
          }
          hint="pending 状态的评价举报数"
          tone="danger"
        />
        <StatCard
          label="当前列表"
          value={String(total)}
          hint={`${STATUS_META[status].label} · 满足当前筛选`}
          tone="info"
        />
        <StatCard
          label="每页"
          value={String(PAGE_SIZE)}
          hint="固定分页大小"
          tone="default"
        />
      </section>

      {/* Status tab */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-[color:var(--color-border)]">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              setStatus(tab.key);
              setPage(1);
            }}
            className={clsx(
              "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm transition",
              status === tab.key
                ? "border-[color:var(--color-primary)] text-[color:var(--color-primary)] font-medium"
                : "border-transparent text-neutral-500 hover:text-neutral-800",
            )}
            aria-current={status === tab.key ? "page" : undefined}
          >
            {tab.label}
            {tab.key === "pending" &&
            (pendingCount.data?.total ?? 0) > 0 ? (
              <span className="ml-1.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-[color:var(--color-danger)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                {(pendingCount.data?.total ?? 0) > 99
                  ? "99+"
                  : pendingCount.data?.total}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* 筛选 */}
      <div className="rounded-md border border-[color:var(--color-border)] bg-white p-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <FormField label="按评价 ID 精确筛选">
            <Input
              value={reviewIdInput}
              onChange={(e) =>
                setReviewIdInput(e.target.value.replace(/\D/g, ""))
              }
              placeholder="评价 ID"
              inputMode="numeric"
              aria-label="按评价 ID 筛选"
            />
          </FormField>
        </div>
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
        emptyText="暂无符合条件的举报记录"
        pagination={{
          page,
          size: PAGE_SIZE,
          total,
          onPageChange: setPage,
        }}
      />

      {/* Handle Modal */}
      <HandleReportModal
        open={handleTarget !== null}
        onClose={() => setHandleTarget(null)}
        onSubmit={(action, review_note) => {
          if (!handleTarget) return;
          handleMutation.mutate({
            id: handleTarget.id,
            action,
            review_note,
          });
        }}
        submitting={handleMutation.isPending}
        reportSummary={
          handleTarget
            ? `举报 #${handleTarget.id} · 评价 #${handleTarget.review_id} · ${reportReasonLabel(
                handleTarget.reason_category,
              )}`
            : undefined
        }
      />
    </div>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}
