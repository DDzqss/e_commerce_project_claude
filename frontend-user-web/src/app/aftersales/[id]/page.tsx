"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { RequireAuth } from "@/components/auth/RequireAuth";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Modal } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { toast } from "@/components/ui/Toast";
import { Price, formatYuan } from "@/components/ui/Price";
import { ImageWithFallback } from "@/components/ui/ImageWithFallback";
import { AftersalesStatusBadge } from "@/components/aftersales/AftersalesStatusBadge";
import { AftersalesTypeIcon } from "@/components/aftersales/AftersalesTypeIcon";
import { AftersalesTimeline } from "@/components/aftersales/AftersalesTimeline";
import {
  ReturnTrackingForm,
  carrierLabel,
} from "@/components/aftersales/ReturnTrackingForm";
import {
  EvidenceUploader,
  type EvidenceItem,
} from "@/components/aftersales/EvidenceUploader";
import {
  useAftersalesDetail,
  useAppealAftersales,
  useCancelAftersales,
  useConfirmExchange,
  useNudgeAftersales,
  useSubmitTracking,
  useAddEvidence,
} from "@/hooks/useAftersales";
import { ApiError } from "@/lib/api";
import { messageForCode } from "@/types/errors";
import {
  AFTERSALES_STAGE_LABEL,
  AFTERSALES_TYPE_LABEL,
  AftersalesStatus,
  CLOSE_REASON_LABEL,
  ESCALATION_REASON_LABEL,
  REASON_CATEGORY_LABEL,
  USER_CAN_APPEAL,
  USER_CAN_CANCEL,
  USER_CAN_CONFIRM_EXCHANGE,
  USER_CAN_NUDGE,
  USER_CAN_SUBMIT_TRACKING,
  type AftersalesDetail,
  type AftersalesEvidence,
  type AftersalesEvidenceStage,
} from "@/types/aftersales";

export default function AftersalesDetailPage() {
  return (
    <RequireAuth>
      <div className="min-h-screen bg-neutral-50">
        <SiteHeader />
        <DetailContent />
      </div>
    </RequireAuth>
  );
}

type ModalState =
  | { kind: "none" }
  | { kind: "cancel" }
  | { kind: "nudge" }
  | { kind: "appeal" }
  | { kind: "tracking" }
  | { kind: "confirm-exchange" }
  | { kind: "add-evidence" };

function DetailContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const { data, isLoading, isError, refetch } = useAftersalesDetail(id);

  const [modal, setModal] = useState<ModalState>({ kind: "none" });

  const cancel = useCancelAftersales();
  const nudge = useNudgeAftersales();
  const appeal = useAppealAftersales();
  const submitTrack = useSubmitTracking();
  const confirmEx = useConfirmExchange();
  const addEvidence = useAddEvidence();

  if (isLoading) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-6">
        <Skeleton className="h-64 w-full" />
      </main>
    );
  }
  if (isError || !data) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-6">
        <div className="rounded-md border border-[color:var(--color-primary-200)] bg-[color:var(--color-primary-50)] px-4 py-3 text-sm text-[color:var(--color-primary-700)]">
          售后单加载失败，
          <button
            type="button"
            className="ml-1 underline"
            onClick={() => refetch()}
          >
            重试
          </button>
        </div>
      </main>
    );
  }

  const status = data.status;
  const canCancel = USER_CAN_CANCEL.has(status);
  const canNudge = USER_CAN_NUDGE.has(status);
  const canAppeal = USER_CAN_APPEAL.has(status) && data.appeal_count === 0;
  const canSubmitTracking = USER_CAN_SUBMIT_TRACKING.has(status);
  const canConfirmExchange = USER_CAN_CONFIRM_EXCHANGE.has(status);

  const closeModal = () => setModal({ kind: "none" });

  const runMutation = async (
    action: string,
    fn: () => Promise<AftersalesDetail>,
    successMsg: string,
  ) => {
    try {
      await fn();
      toast.success(successMsg);
      closeModal();
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? messageForCode(e.code, e.message)
          : `${action}失败`;
      toast.error(msg);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-6 pb-24">
      {/* 顶部：类型 + 状态 + 售后单号 */}
      <section
        className="rounded-lg border border-neutral-200 bg-white p-5"
        data-testid="aftersales-header"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <AftersalesTypeIcon type={data.type} size={20} />
              <span className="text-lg font-semibold text-neutral-900">
                {AFTERSALES_TYPE_LABEL[data.type]}
              </span>
              <AftersalesStatusBadge status={data.status} size="md" />
            </div>
            <div className="mt-1 text-xs text-neutral-500">
              售后单号 {data.aftersales_no}
              <span className="mx-2">·</span>
              订单
              <Link
                className="ml-1 hover:text-[color:var(--color-primary)]"
                href={`/orders/${data.order_no}`}
              >
                {data.order_no}
              </Link>
              <span className="mx-2">·</span>
              创建于 {formatDateTime(data.created_at)}
            </div>
          </div>
          <div className="flex flex-wrap gap-2" data-testid="detail-actions">
            {canCancel && (
              <Button
                variant="secondary"
                onClick={() => setModal({ kind: "cancel" })}
                data-testid="btn-cancel"
              >
                撤销申请
              </Button>
            )}
            {canNudge && (
              <Button
                variant="secondary"
                onClick={() => setModal({ kind: "nudge" })}
                data-testid="btn-nudge"
              >
                催办
              </Button>
            )}
            {canAppeal && (
              <Button
                onClick={() => setModal({ kind: "appeal" })}
                data-testid="btn-appeal"
              >
                我要申诉
              </Button>
            )}
            {canSubmitTracking && (
              <Button
                onClick={() => setModal({ kind: "tracking" })}
                data-testid="btn-tracking"
              >
                填写寄回快递
              </Button>
            )}
            {canConfirmExchange && (
              <Button
                onClick={() => setModal({ kind: "confirm-exchange" })}
                data-testid="btn-confirm-exchange"
              >
                确认换货完成
              </Button>
            )}
          </div>
        </div>
        {data.escalation_reason && (
          <p className="mt-3 text-xs text-neutral-600">
            升级原因：{ESCALATION_REASON_LABEL[data.escalation_reason]}
          </p>
        )}
        {data.close_reason && (
          <p className="mt-1 text-xs text-neutral-600">
            关闭原因：{CLOSE_REASON_LABEL[data.close_reason]}
          </p>
        )}
      </section>

      {/* 商品明细 */}
      <section className="mt-4 overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <header className="border-b border-neutral-100 bg-neutral-50 px-5 py-2 text-sm font-medium text-neutral-800">
          售后商品
        </header>
        <ul className="divide-y divide-neutral-100">
          {data.items.map((it) => {
            const specText = it.sku_specs
              ? Object.values(it.sku_specs).join(" / ")
              : "";
            return (
              <li key={it.id} className="flex items-start gap-3 px-5 py-3">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded border border-neutral-200 bg-neutral-50">
                  <ImageWithFallback
                    objectKey={it.sku_image ?? null}
                    alt={it.spu_title ?? "商品"}
                    className="h-full w-full"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 text-sm text-neutral-900">
                    {it.spu_title ?? "-"}
                  </div>
                  {specText && (
                    <div className="text-xs text-neutral-500">{specText}</div>
                  )}
                  {typeof it.unit_price_cents === "number" && (
                    <div className="mt-0.5 text-xs text-neutral-500">
                      单价 {formatYuan(it.unit_price_cents)}
                    </div>
                  )}
                </div>
                <div className="text-right text-sm">
                  <div className="text-neutral-500">×{it.quantity}</div>
                  <div className="mt-0.5 font-semibold text-neutral-900 tabular-nums">
                    {formatYuan(it.refund_amount_cents)}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* 退货地址（若有） */}
      {data.return_address && (
        <section className="mt-4 rounded-lg border border-neutral-200 bg-white p-5">
          <h2 className="mb-2 text-sm font-medium text-neutral-800">
            寄回地址
          </h2>
          <p className="text-sm text-neutral-700 whitespace-pre-wrap">
            {data.return_address}
          </p>
          {data.return_carrier || data.return_tracking_no ? (
            <p className="mt-2 text-xs text-neutral-500">
              寄出：{carrierLabel(data.return_carrier)}
              <span className="mx-2">·</span>
              <span className="tabular-nums">
                {data.return_tracking_no ?? "-"}
              </span>
              {data.return_shipped_at && (
                <span className="ml-2">
                  {formatDateTime(data.return_shipped_at)}
                </span>
              )}
            </p>
          ) : null}
          {data.return_ship_deadline && !data.return_shipped_at && (
            <p className="mt-1 text-xs text-neutral-500">
              请在 {formatDateTime(data.return_ship_deadline)} 前完成寄回
            </p>
          )}
        </section>
      )}

      {/* 换货再发货 */}
      {(data.exchange_carrier || data.exchange_tracking_no) && (
        <section className="mt-4 rounded-lg border border-neutral-200 bg-white p-5">
          <h2 className="mb-2 text-sm font-medium text-neutral-800">
            商家再发货
          </h2>
          <p className="text-sm text-neutral-700">
            {carrierLabel(data.exchange_carrier)}
            <span className="mx-2">·</span>
            <span className="tabular-nums">
              {data.exchange_tracking_no ?? "-"}
            </span>
          </p>
          {data.exchange_shipped_at && (
            <p className="mt-1 text-xs text-neutral-500">
              发出时间：{formatDateTime(data.exchange_shipped_at)}
            </p>
          )}
        </section>
      )}

      {/* 金额明细 */}
      <section className="mt-4 rounded-lg border border-neutral-200 bg-white p-5 text-sm">
        <div className="flex justify-between py-1 text-neutral-600">
          <span>申请退款金额</span>
          <span className="tabular-nums">
            {formatYuan(data.refund_amount_cents)}
          </span>
        </div>
        {data.actual_refund_cents !== null && (
          <div className="mt-1 flex justify-between border-t border-neutral-100 pt-2 text-base font-semibold">
            <span>实际退款金额</span>
            <Price cents={data.actual_refund_cents} />
          </div>
        )}
        {data.refund_txn_no && (
          <p className="mt-2 text-xs text-neutral-500">
            退款流水号：{data.refund_txn_no}
            {data.refunded_at && (
              <span className="ml-2">
                {formatDateTime(data.refunded_at)} 已到账
              </span>
            )}
          </p>
        )}
      </section>

      {/* 原因 + 说明 */}
      <section className="mt-4 rounded-lg border border-neutral-200 bg-white p-5 text-sm">
        <h2 className="mb-2 text-sm font-medium text-neutral-800">申请原因</h2>
        <p className="text-neutral-700">
          <span className="text-neutral-500">分类：</span>
          {REASON_CATEGORY_LABEL[data.reason_category]}
        </p>
        <p className="mt-1 whitespace-pre-wrap text-neutral-700">
          <span className="text-neutral-500">说明：</span>
          {data.reason_note}
        </p>
      </section>

      {/* 完整时间轴（合并 status_history + messages） */}
      <section className="mt-4 rounded-lg border border-neutral-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-medium text-neutral-800">
          完整进展
        </h2>
        <AftersalesTimeline
          history={data.status_history}
          messages={data.messages}
        />
      </section>

      {/* 凭证画廊：按 stage 分组 */}
      {data.evidences && data.evidences.length > 0 && (
        <section className="mt-4 rounded-lg border border-neutral-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-neutral-800">凭证图片</h2>
            {canAddEvidenceFor(status) && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setModal({ kind: "add-evidence" })}
                data-testid="btn-add-evidence"
              >
                追加凭证
              </Button>
            )}
          </div>
          <EvidenceGallery evidences={data.evidences} />
        </section>
      )}

      {(!data.evidences || data.evidences.length === 0) &&
        canAddEvidenceFor(status) && (
          <section className="mt-4 rounded-lg border border-neutral-200 bg-white p-5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">
                尚未上传凭证，可根据售后进度补充图片。
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setModal({ kind: "add-evidence" })}
              >
                追加凭证
              </Button>
            </div>
          </section>
        )}

      {/* Modals */}
      <ConfirmModal
        open={modal.kind === "cancel"}
        title="确认撤销该售后申请？"
        description="撤销后不可恢复，如需继续处理请重新发起。"
        confirmText="确认撤销"
        danger
        loading={cancel.isPending}
        onCancel={closeModal}
        onConfirm={() =>
          runMutation(
            "撤销",
            () => cancel.mutateAsync({ idOrNo: data.id }),
            "已撤销售后申请",
          )
        }
      />

      <ConfirmModal
        open={modal.kind === "nudge"}
        title="催办商家？"
        description={
          <span className="text-sm text-neutral-700">
            商家超时未响应，是否催办？（24h 内已催办
            <span className="mx-1 font-medium">{data.nudge_count}</span>
            次，最多 3 次）
          </span>
        }
        confirmText="催办"
        loading={nudge.isPending}
        onCancel={closeModal}
        onConfirm={() =>
          runMutation(
            "催办",
            () => nudge.mutateAsync({ idOrNo: data.id }),
            "已提醒商家尽快处理",
          )
        }
      />

      <AppealModal
        open={modal.kind === "appeal"}
        submitting={appeal.isPending}
        onCancel={closeModal}
        onSubmit={(reason, evidence_image_keys) =>
          runMutation(
            "申诉",
            () =>
              appeal.mutateAsync({
                idOrNo: data.id,
                payload: { reason, evidence_image_keys },
              }),
            "申诉已提交，等待平台客服处理",
          )
        }
      />

      <Modal
        open={modal.kind === "tracking"}
        title="填写寄回快递"
        onClose={closeModal}
      >
        <ReturnTrackingForm
          submitting={submitTrack.isPending}
          onCancel={closeModal}
          onSubmit={(carrier, tracking_no) =>
            runMutation(
              "回填快递",
              () =>
                submitTrack.mutateAsync({
                  idOrNo: data.id,
                  payload: { carrier, tracking_no },
                }),
              "已回填快递单号",
            )
          }
        />
      </Modal>

      <ConfirmModal
        open={modal.kind === "confirm-exchange"}
        title="确认换货完成？"
        description="确认后本次售后将关闭为已完成。若还有问题请先联系商家。"
        confirmText="确认完成"
        loading={confirmEx.isPending}
        onCancel={closeModal}
        onConfirm={() =>
          runMutation(
            "确认换货",
            () => confirmEx.mutateAsync({ idOrNo: data.id }),
            "换货已完成",
          )
        }
      />

      <AddEvidenceModal
        open={modal.kind === "add-evidence"}
        submitting={addEvidence.isPending}
        currentStatus={status}
        onCancel={closeModal}
        onSubmit={async (stage, image_key, note) => {
          await runMutation(
            "上传凭证",
            () =>
              addEvidence.mutateAsync({
                idOrNo: data.id,
                payload: { stage, image_key, note },
              }),
            "已追加凭证",
          );
        }}
      />

      <div className="mt-6 flex justify-end">
        <Button variant="ghost" onClick={() => router.push("/aftersales")}>
          返回售后列表
        </Button>
      </div>
    </main>
  );
}

/** 详情页哪些状态允许追加凭证。 */
function canAddEvidenceFor(status: AftersalesStatus): boolean {
  // 终态不允许追加；仲裁完成后也不允许
  const disallow: ReadonlySet<AftersalesStatus> = new Set([
    AftersalesStatus.CompletedRefunded,
    AftersalesStatus.CompletedExchanged,
    AftersalesStatus.UserCancelled,
    AftersalesStatus.SystemClosed,
  ]);
  return !disallow.has(status);
}

/** 凭证画廊：按 stage 分组渲染。 */
function EvidenceGallery({
  evidences,
}: {
  evidences: AftersalesEvidence[];
}) {
  const groups = useMemo(() => {
    const map = new Map<AftersalesEvidenceStage, AftersalesEvidence[]>();
    for (const ev of evidences) {
      const list = map.get(ev.stage) ?? [];
      list.push(ev);
      map.set(ev.stage, list);
    }
    return Array.from(map.entries());
  }, [evidences]);

  return (
    <div className="flex flex-col gap-4">
      {groups.map(([stage, list]) => (
        <div key={stage}>
          <h3 className="mb-2 text-xs font-medium text-neutral-500">
            {AFTERSALES_STAGE_LABEL[stage]}
          </h3>
          <div className="flex flex-wrap gap-2">
            {list.map((ev) => (
              <a
                key={ev.id}
                href="#"
                onClick={(e) => e.preventDefault()}
                className="block h-20 w-20 overflow-hidden rounded border border-neutral-200"
                title={ev.note ?? ""}
              >
                <ImageWithFallback
                  objectKey={ev.image_url}
                  alt="凭证"
                  className="h-full w-full"
                />
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** 申诉 Modal —— 明确"仅 1 次机会"警告。 */
function AppealModal({
  open,
  submitting,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (reason: string, evidence_image_keys: string[]) => void | Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [evidences, setEvidences] = useState<EvidenceItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (reason.trim().length < 20) {
      setError("申诉理由至少 20 字");
      return;
    }
    if (evidences.some((e) => e.uploading)) {
      setError("还有图片正在上传中，请稍候");
      return;
    }
    setError(null);
    const image_keys = evidences
      .filter((e) => e.object_key && !e.uploading)
      .map((e) => e.object_key);
    void onSubmit(reason.trim(), image_keys);
  };

  return (
    <Modal
      open={open}
      title="发起申诉"
      onClose={submitting ? () => {} : onCancel}
      dismissOnBackdrop={!submitting}
    >
      <div
        role="alert"
        className="mb-3 rounded border border-[color:var(--color-primary-200)] bg-[color:var(--color-primary-50)] px-3 py-2 text-xs text-[color:var(--color-primary-700)]"
      >
        申诉将升级至平台客服仲裁，仅有 <b>1 次</b> 机会，请慎重填写。
      </div>
      <div className="mb-3">
        <label
          htmlFor="appeal-reason"
          className="mb-1.5 block text-sm font-medium text-neutral-800"
        >
          申诉理由
          <span className="ml-2 text-xs text-neutral-500">
            {reason.length} / 500，至少 20 字
          </span>
        </label>
        <textarea
          id="appeal-reason"
          data-testid="appeal-reason"
          rows={4}
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="请说明你对商家结论的具体不认可之处"
          className="block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-[color:var(--color-primary)] focus:outline-none"
        />
      </div>
      <div className="mb-3">
        <label className="mb-1.5 block text-sm font-medium text-neutral-800">
          追加凭证
        </label>
        <EvidenceUploader
          value={evidences}
          onChange={setEvidences}
          purpose="aftersales_appeal"
          max={8}
        />
      </div>
      {error && (
        <p className="mb-3 text-xs text-[color:var(--color-primary)]">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={submitting}>
          取消
        </Button>
        <Button
          onClick={submit}
          loading={submitting}
          data-testid="submit-appeal"
        >
          提交申诉
        </Button>
      </div>
    </Modal>
  );
}

/** 追加凭证 Modal：允许用户选 stage 并上传一张后立即提交（多张调用多次）。 */
function AddEvidenceModal({
  open,
  submitting,
  currentStatus,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  submitting: boolean;
  currentStatus: AftersalesStatus;
  onCancel: () => void;
  onSubmit: (
    stage: AftersalesEvidenceStage,
    image_key: string,
    note?: string,
  ) => void | Promise<void>;
}) {
  // 用户可选的 stage：apply / user_return / appeal 三种（对齐 §7.9）
  const availableStages: AftersalesEvidenceStage[] = useMemo(() => {
    const base: AftersalesEvidenceStage[] = ["apply"];
    if (
      currentStatus === AftersalesStatus.MerchantAgreedWaitingReturn ||
      currentStatus === AftersalesStatus.ReturnShippedWaitingReceive
    ) {
      base.push("user_return");
    }
    if (currentStatus === AftersalesStatus.AdminArbitrating) {
      base.push("appeal");
    }
    return base;
  }, [currentStatus]);

  const [stage, setStage] = useState<AftersalesEvidenceStage>(
    availableStages[0] ?? "apply",
  );
  const [evidences, setEvidences] = useState<EvidenceItem[]>([]);
  const [note, setNote] = useState("");

  // stage 可能因外部状态变化：确保选中的 stage 有效
  useMemo(() => {
    if (!availableStages.includes(stage)) {
      setStage(availableStages[0] ?? "apply");
    }
  }, [availableStages, stage]);

  const purpose =
    stage === "appeal"
      ? "aftersales_appeal"
      : stage === "user_return"
        ? "aftersales_user_return"
        : "aftersales_apply";

  const doSubmit = async () => {
    const uploaded = evidences.filter((e) => e.object_key && !e.uploading);
    if (uploaded.length === 0) {
      toast.error("请至少上传一张图片");
      return;
    }
    // 逐张调用 addEvidence 接口
    for (const e of uploaded) {
      await onSubmit(stage, e.object_key, note.trim() || undefined);
    }
    setEvidences([]);
    setNote("");
  };

  return (
    <Modal
      open={open}
      title="追加凭证"
      onClose={submitting ? () => {} : onCancel}
      dismissOnBackdrop={!submitting}
    >
      <div className="mb-3">
        <label className="mb-1.5 block text-sm font-medium text-neutral-800">
          阶段
        </label>
        <select
          data-testid="add-evidence-stage"
          value={stage}
          onChange={(e) =>
            setStage(e.target.value as AftersalesEvidenceStage)
          }
          disabled={submitting}
          className="block h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-900 focus:border-[color:var(--color-primary)] focus:outline-none"
        >
          {availableStages.map((s) => (
            <option key={s} value={s}>
              {AFTERSALES_STAGE_LABEL[s]}
            </option>
          ))}
        </select>
      </div>
      <div className="mb-3">
        <EvidenceUploader
          value={evidences}
          onChange={setEvidences}
          purpose={purpose}
          max={8}
          disabled={submitting}
        />
      </div>
      <div className="mb-3">
        <label
          htmlFor="add-evidence-note"
          className="mb-1.5 block text-sm font-medium text-neutral-800"
        >
          备注（可选）
        </label>
        <input
          id="add-evidence-note"
          maxLength={200}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="block h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-900 focus:border-[color:var(--color-primary)] focus:outline-none"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={submitting}>
          取消
        </Button>
        <Button
          onClick={() => void doSubmit()}
          loading={submitting}
          data-testid="submit-evidence"
        >
          提交
        </Button>
      </div>
    </Modal>
  );
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("zh-CN", { hour12: false });
  } catch {
    return iso;
  }
}
