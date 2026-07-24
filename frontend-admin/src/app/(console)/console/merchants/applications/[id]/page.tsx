"use client";

/**
 * 商家入驻申请详情页 (`/console/merchants/applications/[id]`)。
 *
 * 契约 §9：
 * - GET /admin/merchant-applications/{id}
 * - POST /admin/merchant-applications/{id}/approve   { review_note? }
 * - POST /admin/merchant-applications/{id}/reject    { review_note }（5-500 字必填）
 *
 * UI 要素：
 * - 详情展示所有字段（含营业执照号）
 * - 状态 timeline：申请时间 / 审核时间 / 审核人 / review_note
 * - 若 status=pending 且有 review 权限：
 *   - "通过审批" → 弹窗（可选备注） → approve → 展示生成的 login_name + initial_password（一次性）
 *   - "驳回申请" → 弹窗（必填备注 5-500 字） → reject
 * - 若已 approved 且有 approved_merchant_account_id：展示 login_name（密码不再展示）
 * - 拒绝/通过成功后返回列表
 */

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RequirePermission } from "@/components/auth/RequirePermission";
import { ApplicationStatusBadge, Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { useToast } from "@/components/ui/Toast";
import {
  approveMerchantApplication,
  getMerchantApplication,
  rejectMerchantApplication,
} from "@/lib/merchant-application-api";
import { usePermission } from "@/hooks/useAuth";
import { ApiError } from "@/lib/api";
import { getErrorMessage } from "@/types/errors";
import type {
  ApproveMerchantApplicationResponse,
  MerchantApplicationOut,
} from "@/types/api";

interface PageProps {
  // Next 15 async params
  params: Promise<{ id: string }>;
}

export default function ApplicationDetailPage(props: PageProps) {
  const { id } = use(props.params);

  return (
    <RequirePermission permission="admin:merchant_application:read">
      <ApplicationDetailInner id={id} />
    </RequirePermission>
  );
}

function ApplicationDetailInner({ id }: { id: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const canReview = usePermission("admin:merchant_application:review");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["merchant-application", id],
    queryFn: () => getMerchantApplication(id),
  });

  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [approvedInfo, setApprovedInfo] =
    useState<ApproveMerchantApplicationResponse | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["merchant-application", id] });
    queryClient.invalidateQueries({ queryKey: ["merchant-applications"] });
    queryClient.invalidateQueries({
      queryKey: ["dashboard", "pending-applications-count"],
    });
  };

  const approveMutation = useMutation({
    mutationFn: (review_note?: string) =>
      approveMerchantApplication(id, review_note ? { review_note } : {}),
    onSuccess: (res) => {
      setApprovedInfo(res);
      setApproveOpen(false);
      toast.push({
        type: "success",
        message: `已通过 · 已生成商家账号 ${res.merchant_account.login_name}`,
      });
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
      rejectMerchantApplication(id, { review_note }),
    onSuccess: () => {
      setRejectOpen(false);
      toast.push({ type: "success", message: "已驳回该申请" });
      invalidate();
      // 驳回后回列表
      router.push("/console/merchants/applications?status=rejected");
    },
    onError: (err) => {
      const msg =
        err instanceof ApiError ? getErrorMessage(err.code, err.message) : "操作失败";
      toast.push({ type: "error", message: msg });
    },
  });

  if (isLoading) {
    return <DetailSkeleton />;
  }
  if (isError || !data) {
    return (
      <div className="rounded border border-red-200 bg-[color:var(--color-danger-soft)] px-4 py-3 text-sm text-[color:var(--color-danger)]">
        {error instanceof ApiError
          ? getErrorMessage(error.code, error.message)
          : "申请详情加载失败"}
        <div className="mt-2">
          <Link
            href="/console/merchants/applications"
            className="text-[color:var(--color-info)] hover:underline"
          >
            返回列表
          </Link>
        </div>
      </div>
    );
  }

  const app = data;
  const showActionBar = app.status === "pending" && canReview;

  return (
    <div className="flex flex-col gap-6">
      {/* 顶部返回 + 标题 + 状态 */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/console/merchants/applications"
            className="mb-2 inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-800"
          >
            ← 返回申请列表
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-neutral-900">
              入驻申请 #{app.id}
            </h1>
            <ApplicationStatusBadge status={app.status} />
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            申请人 {app.applicant_nickname || `#${app.applicant_user_id}`} · 提交于{" "}
            {formatDateTime(app.created_at)}
          </p>
        </div>

        {showActionBar ? (
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => setRejectOpen(true)}
              className="!text-[color:var(--color-danger)]"
            >
              驳回申请
            </Button>
            <Button onClick={() => setApproveOpen(true)}>通过审批</Button>
          </div>
        ) : null}
      </div>

      {/* 已通过的商家账号信息（若之前批准过，明文密码不再展示） */}
      {app.status === "approved" && app.approved_merchant_account_id ? (
        <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-900">
          <div className="mb-1 flex items-center gap-2 font-medium">
            <Badge tone="success">已开通商家账号</Badge>
            <span>商家账号 ID：{app.approved_merchant_account_id}</span>
          </div>
          <p className="text-xs text-green-800">
            初始密码仅在批准的那一刻展示一次，如申请人遗忘请通过「重置密码」能力（Phase 2 提供）处理。
          </p>
        </div>
      ) : null}

      {/* 申请信息 */}
      <section className="rounded-md border border-[color:var(--color-border)] bg-white">
        <header className="border-b border-[color:var(--color-border)] px-4 py-3 text-sm font-semibold text-neutral-800">
          申请信息
        </header>
        <dl className="grid grid-cols-1 gap-y-3 gap-x-6 p-4 sm:grid-cols-2">
          <Field label="店铺名">{app.shop_name}</Field>
          <Field label="联系人">{app.contact_name}</Field>
          <Field label="联系电话">
            <span className="tabular-nums">{app.contact_phone}</span>
          </Field>
          <Field label="营业执照号">
            <span className="tabular-nums">{app.business_license_no}</span>
          </Field>
          <Field label="营业执照图">
            {app.business_license_url ? (
              <a
                href={app.business_license_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[color:var(--color-info)] hover:underline"
              >
                查看图片
              </a>
            ) : (
              <span className="text-neutral-400">未上传（Phase 1 预留）</span>
            )}
          </Field>
          <Field label="申请人 UID">#{app.applicant_user_id}</Field>
          <Field label="申请说明" full>
            <p className="whitespace-pre-wrap text-neutral-700">
              {app.description || (
                <span className="text-neutral-400">申请人未填写</span>
              )}
            </p>
          </Field>
        </dl>
      </section>

      {/* 审核 timeline */}
      <section className="rounded-md border border-[color:var(--color-border)] bg-white">
        <header className="border-b border-[color:var(--color-border)] px-4 py-3 text-sm font-semibold text-neutral-800">
          审核记录
        </header>
        <ul className="flex flex-col gap-3 p-4 text-sm">
          <TimelineItem
            time={formatDateTime(app.created_at)}
            title="提交申请"
            body={`申请人 ${app.applicant_nickname || `#${app.applicant_user_id}`}`}
          />
          {app.reviewed_at ? (
            <TimelineItem
              time={formatDateTime(app.reviewed_at)}
              title={
                app.status === "approved"
                  ? "审核通过"
                  : app.status === "rejected"
                    ? "审核驳回"
                    : "审核处理"
              }
              body={
                <>
                  <div>
                    审核人：
                    {app.reviewer_display_name ||
                      (app.reviewer_admin_id
                        ? `管理员 #${app.reviewer_admin_id}`
                        : "—")}
                  </div>
                  {app.review_note ? (
                    <div className="mt-1 whitespace-pre-wrap rounded bg-neutral-50 px-2 py-1 text-xs text-neutral-700">
                      审核备注：{app.review_note}
                    </div>
                  ) : null}
                </>
              }
              tone={app.status === "rejected" ? "danger" : "success"}
            />
          ) : (
            <TimelineItem
              time="—"
              title="等待审核"
              body="尚未有管理员处理此申请"
              tone="warning"
            />
          )}
        </ul>
      </section>

      {/* Approve 弹窗 */}
      <ApproveModal
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        onSubmit={(note) => approveMutation.mutate(note || undefined)}
        submitting={approveMutation.isPending}
      />

      {/* Reject 弹窗 */}
      <RejectModal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        onSubmit={(note) => rejectMutation.mutate(note)}
        submitting={rejectMutation.isPending}
      />

      {/* Approve 成功结果弹窗（展示 login_name + 明文密码） */}
      <ApprovedResultModal
        open={Boolean(approvedInfo)}
        info={approvedInfo}
        onClose={() => {
          setApprovedInfo(null);
          // 关闭后返回列表
          router.push("/console/merchants/applications?status=approved");
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 局部小组件
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

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

// ---- Approve modal ----

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
      title="通过入驻申请"
      closeOnOverlay={!submitting}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            取消
          </Button>
          <Button loading={submitting} onClick={() => onSubmit(note)}>
            确认通过
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-neutral-600">
          审批通过后系统将自动创建商家账号与店铺，并生成初始密码
          <strong className="text-neutral-900">仅显示一次</strong>，
          请立即抄送申请人。
        </p>
        <FormField
          label="审核备注（可选）"
          description="选填。用于内部审核记录，不会展示给申请人"
        >
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="例如：资质齐全"
            maxLength={200}
          />
        </FormField>
      </div>
    </Modal>
  );
}

// ---- Reject modal ----

function RejectModal({
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
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    const trimmed = note.trim();
    if (trimmed.length < 5 || trimmed.length > 500) {
      setError("驳回理由需 5-500 字");
      return;
    }
    setError(null);
    onSubmit(trimmed);
  };

  return (
    <Modal
      open={open}
      onClose={submitting ? () => undefined : onClose}
      title="驳回入驻申请"
      closeOnOverlay={!submitting}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            取消
          </Button>
          <Button variant="danger" loading={submitting} onClick={handleSubmit}>
            确认驳回
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-neutral-600">
          请填写驳回理由。理由将展示给申请人，请措辞清晰、可执行。
        </p>
        <FormField
          label="驳回理由"
          required
          error={error}
          description="长度 5-500 字。示例：营业执照信息与工商登记不匹配。"
        >
          <textarea
            className="block h-28 w-full resize-none rounded border border-[color:var(--color-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)] focus:ring-1 focus:ring-[color:var(--color-primary)]/20"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            aria-invalid={Boolean(error)}
            placeholder="请填写具体驳回理由（5-500 字）"
          />
        </FormField>
        <div className="text-right text-xs text-neutral-400">
          {note.trim().length} / 500
        </div>
      </div>
    </Modal>
  );
}

// ---- Approve success modal (展示明文密码) ----

function ApprovedResultModal({
  open,
  info,
  onClose,
}: {
  open: boolean;
  info: ApproveMerchantApplicationResponse | null;
  onClose: () => void;
}) {
  const toast = useToast();

  if (!info) return null;

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.push({ type: "success", message: `${label} 已复制到剪贴板` });
    } catch {
      toast.push({ type: "warning", message: "复制失败，请手动选择文本" });
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="审批通过 · 商家账号已生成"
      closeOnOverlay={false}
      showClose={false}
      size="md"
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() =>
              copy(
                `登录名：${info.merchant_account.login_name}\n初始密码：${info.merchant_account.initial_password}`,
                "账号信息",
              )
            }
          >
            一键复制账号信息
          </Button>
          <Button onClick={onClose}>我已抄送申请人</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {/* 显眼的黄色警告框 */}
        <div className="rounded-md border-2 border-amber-400 bg-amber-50 p-4">
          <div className="flex items-start gap-2">
            <span aria-hidden className="text-lg">
              ⚠
            </span>
            <div className="flex-1">
              <div className="text-sm font-semibold text-amber-900">
                此密码仅显示一次
              </div>
              <p className="mt-1 text-xs text-amber-800">
                关闭本弹窗后系统将不再展示明文密码。请立即通过安全渠道（如企微、邮件）
                通知申请人首次登录后立即修改。
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-md border border-[color:var(--color-border)] bg-neutral-50 p-4">
          <dl className="flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-neutral-500">登录名</dt>
              <dd className="flex items-center gap-2">
                <code className="rounded bg-white px-2 py-1 text-sm tabular-nums text-neutral-900">
                  {info.merchant_account.login_name}
                </code>
                <button
                  type="button"
                  onClick={() =>
                    copy(info.merchant_account.login_name, "登录名")
                  }
                  className="text-xs text-[color:var(--color-info)] hover:underline"
                >
                  复制
                </button>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-neutral-500">初始密码</dt>
              <dd className="flex flex-1 items-center justify-end gap-2">
                <div className="w-48">
                  <PasswordInput
                    value={info.merchant_account.initial_password}
                    readOnly
                    defaultVisible
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    copy(info.merchant_account.initial_password, "初始密码")
                  }
                  className="text-xs text-[color:var(--color-info)] hover:underline"
                >
                  复制
                </button>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-neutral-500">店铺 ID</dt>
              <dd className="tabular-nums text-neutral-800">
                #{info.merchant_account.shop_id}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-neutral-500">商家账号 ID</dt>
              <dd className="tabular-nums text-neutral-800">
                #{info.merchant_account.id}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </Modal>
  );
}

/**
 * 格式化 ISO timestamp → "YYYY-MM-DD HH:mm"。
 */
function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/**
 * 仅为 lint 保留：MerchantApplicationOut 会在 hooks 内部间接被使用，
 * 显式 re-export 便于测试文件复用。
 */
export type { MerchantApplicationOut };
