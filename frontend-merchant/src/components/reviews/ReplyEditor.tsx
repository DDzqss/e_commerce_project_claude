"use client";

/**
 * ReplyEditor —— 就地编辑 / 新建评价回复。
 *
 * 三种模式（由 `mode` 决定）：
 *   - `create`：无 reply → 展开输入框，「提交回复」
 *   - `edit`  ：已有 reply，用户点了「编辑」→ 预填内容，「保存」/「取消」
 *   - `view`  ：已有 reply 的只读态 → 展示内容 + 「编辑」/「删除」按钮
 *
 * 校验（§5.2）：内容 5-500 字。前端校验后再落网络。
 * 交互：
 *   - Ctrl/Cmd + Enter 快捷提交
 *   - 提交中禁用按钮，避免重复请求
 */

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import type { MerchantReviewReplyOut } from "@/types/review";

const CONTENT_MIN = 5;
const CONTENT_MAX = 500;

export type ReplyEditorMode = "create" | "edit" | "view";

export interface ReplyEditorProps {
  reviewId: number;
  reply: MerchantReviewReplyOut | null;
  onCreate: (reviewId: number, content: string) => Promise<void>;
  onUpdate: (reviewId: number, content: string) => Promise<void>;
  onDelete: (reviewId: number) => Promise<void>;
  /** SHOP_SUPPORT 只读；SHOP_OWNER / SHOP_OPERATOR 允许写。 */
  canWrite: boolean;
}

export function ReplyEditor({
  reviewId,
  reply,
  onCreate,
  onUpdate,
  onDelete,
  canWrite,
}: ReplyEditorProps) {
  const [mode, setMode] = useState<ReplyEditorMode>(reply ? "view" : "create");
  const [draft, setDraft] = useState(reply?.content ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 外部 reply 变更（如刷新数据）→ 同步内部状态
  useEffect(() => {
    setMode(reply ? "view" : "create");
    setDraft(reply?.content ?? "");
    setError(null);
  }, [reply]);

  const validate = (v: string): string | null => {
    const trimmed = v.trim();
    if (trimmed.length < CONTENT_MIN) return `回复不少于 ${CONTENT_MIN} 字`;
    if (trimmed.length > CONTENT_MAX) return `回复不超过 ${CONTENT_MAX} 字`;
    return null;
  };

  const submit = async () => {
    if (submitting) return;
    const trimmed = draft.trim();
    const validation = validate(trimmed);
    if (validation) {
      setError(validation);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (reply) {
        await onUpdate(reviewId, trimmed);
        toast.success("回复已更新");
      } else {
        await onCreate(reviewId, trimmed);
        toast.success("回复已发布");
      }
      setMode("view");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "回复失败，请稍后重试";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const removeReply = async () => {
    if (submitting) return;
    if (!window.confirm("确定要删除该回复吗？")) return;
    setSubmitting(true);
    try {
      await onDelete(reviewId);
      toast.success("回复已删除");
      setDraft("");
      setMode("create");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "删除失败，请稍后重试";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ---- 视图态：已有回复 -----------------------------------------------------
  if (mode === "view" && reply) {
    return (
      <div className="mt-3 rounded-md border border-blue-100 bg-blue-50/60 px-3 py-2 text-sm">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--color-primary)]">
            商家回复
          </span>
          <span className="text-[11px] text-neutral-500">
            {new Date(reply.updated_at).toLocaleString("zh-CN")}
          </span>
        </div>
        <p className="whitespace-pre-line text-neutral-800">{reply.content}</p>
        {canWrite ? (
          <div className="mt-2 flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setMode("edit")}
              disabled={submitting}
            >
              编辑
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={removeReply}
              disabled={submitting}
              className="text-red-600 hover:bg-red-50"
            >
              删除
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  // ---- 创建 / 编辑 ---------------------------------------------------------
  if (!canWrite) {
    return null;
  }

  return (
    <div className="mt-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
      <label htmlFor={`reply-${reviewId}`} className="mb-1 block text-xs text-neutral-600">
        {reply ? "编辑回复" : "写下回复以帮助其他消费者了解真实情况"}
      </label>
      <textarea
        id={`reply-${reviewId}`}
        rows={3}
        value={draft}
        maxLength={CONTENT_MAX + 20}
        onChange={(e) => {
          setDraft(e.target.value);
          if (error) setError(null);
        }}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            void submit();
          }
        }}
        placeholder="用简明专业的语言回应用户……（5-500 字）"
        aria-invalid={Boolean(error)}
        className="block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus-visible:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-blue-200"
      />
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs">
          {error ? (
            <span role="alert" className="text-red-600">
              {error}
            </span>
          ) : (
            <span className="text-neutral-500">
              {draft.trim().length}/{CONTENT_MAX}
            </span>
          )}
          <span className="text-neutral-400">·</span>
          <span className="text-neutral-400">⌘/Ctrl + Enter 提交</span>
        </div>
        <div className="flex gap-2">
          {mode === "edit" ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setDraft(reply?.content ?? "");
                setError(null);
                setMode("view");
              }}
              disabled={submitting}
            >
              取消
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="primary"
            loading={submitting}
            onClick={submit}
          >
            {reply ? "保存" : "发布回复"}
          </Button>
        </div>
      </div>
    </div>
  );
}
