"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";

import { RequireAuth } from "@/components/auth/RequireAuth";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/Toast";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAuthStore } from "@/lib/auth-store";
import { changePassword, updateProfile } from "@/lib/auth-api";
import { ApiError } from "@/lib/api";
import { ErrorCode, messageForCode } from "@/types/errors";

export default function ProfilePage() {
  return (
    <RequireAuth>
      <div className="min-h-screen bg-neutral-50">
        <SiteHeader />
        <ProfileContent />
      </div>
    </RequireAuth>
  );
}

function ProfileContent() {
  const { data, isLoading, isError, refetch } = useCurrentUser();
  const [nicknameOpen, setNicknameOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-neutral-900">我的资料</h1>

      {isLoading && (
        <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-6">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-60" />
          <Skeleton className="h-4 w-52" />
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

      {data && (
        <div className="flex flex-col gap-6 rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
          <ProfileRow label="昵称" value={data.user.nickname}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setNicknameOpen(true)}
            >
              修改
            </Button>
          </ProfileRow>
          <ProfileRow label="手机号" value={maskPhone(data.user.phone)} />
          <ProfileRow label="邮箱" value={maskEmail(data.user.email)} />
          <ProfileRow
            label="注册时间"
            value={formatDateTime(data.user.created_at)}
          />
          <ProfileRow
            label="最近登录"
            value={
              data.user.last_login_at
                ? formatDateTime(data.user.last_login_at)
                : "-"
            }
          />

          <div className="border-t border-neutral-100 pt-4">
            <Button variant="secondary" onClick={() => setPwdOpen(true)}>
              修改密码
            </Button>
          </div>
        </div>
      )}

      {nicknameOpen && data && (
        <EditNicknameModal
          current={data.user.nickname}
          onClose={() => setNicknameOpen(false)}
        />
      )}
      {pwdOpen && (
        <ChangePasswordModal onClose={() => setPwdOpen(false)} />
      )}
    </main>
  );
}

function ProfileRow({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-xs text-neutral-500">{label}</div>
        <div className="mt-1 text-sm font-medium text-neutral-900">{value}</div>
      </div>
      {children}
    </div>
  );
}

function maskPhone(phone: string | null): string {
  if (!phone) return "-";
  if (phone.length < 8) return phone;
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

function maskEmail(email: string | null): string {
  if (!email) return "-";
  const [name, domain] = email.split("@");
  if (!name || !domain) return email;
  if (name.length <= 2) return `${name[0]}*@${domain}`;
  return `${name.slice(0, 2)}***@${domain}`;
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("zh-CN", { hour12: false });
  } catch {
    return iso;
  }
}

// ---------------- 修改昵称 ----------------
const nicknameSchema = z.object({
  nickname: z
    .string()
    .min(1, "昵称不能为空")
    .max(60, "昵称最长 60 字"),
});
type NicknameForm = z.infer<typeof nicknameSchema>;

function EditNicknameModal({
  current,
  onClose,
}: {
  current: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const updateUser = useAuthStore((s) => s.updateUser);
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<NicknameForm>({
    resolver: zodResolver(nicknameSchema),
    defaultValues: { nickname: current },
  });

  const onSubmit = handleSubmit(async ({ nickname }) => {
    try {
      const updated = await updateProfile({ nickname: nickname.trim() });
      updateUser({ nickname: updated.nickname });
      queryClient.invalidateQueries({ queryKey: ["user", "me"] });
      toast.success("昵称已更新");
      onClose();
    } catch (e) {
      const msg =
        e instanceof ApiError ? messageForCode(e.code, e.message) : "更新失败";
      toast.error(msg);
    }
  });

  return (
    <Modal open onClose={onClose} title="修改昵称">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormField
          control={control}
          name="nickname"
          render={({ value, onChange, name, error, onBlur }) => (
            <Input
              label="新昵称"
              placeholder="1-60 字"
              name={name}
              value={(value as string) ?? ""}
              onChange={(e) => onChange(e.target.value)}
              onBlur={onBlur}
              error={error}
              maxLength={60}
              autoFocus
            />
          )}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} type="button">
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

// ---------------- 修改密码 ----------------
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)[\S]{8,64}$/;

const pwdSchema = z
  .object({
    old_password: z.string().min(1, "请输入原密码"),
    new_password: z
      .string()
      .min(8, "密码 8-64 位")
      .max(64, "密码 8-64 位")
      .regex(PASSWORD_REGEX, "密码需同时含字母和数字"),
    confirm: z.string(),
  })
  .refine((v) => v.confirm === v.new_password, {
    message: "两次输入的密码不一致",
    path: ["confirm"],
  });
type PwdForm = z.infer<typeof pwdSchema>;

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<PwdForm>({
    resolver: zodResolver(pwdSchema),
    defaultValues: { old_password: "", new_password: "", confirm: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await changePassword({
        old_password: values.old_password,
        new_password: values.new_password,
      });
      toast.success("密码已更新，下次登录请使用新密码");
      onClose();
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === ErrorCode.OldPasswordWrong) {
          toast.error("原密码错误");
        } else {
          toast.error(messageForCode(e.code, e.message));
        }
      } else {
        toast.error("网络异常，请稍后重试");
      }
    }
  });

  return (
    <Modal open onClose={onClose} title="修改密码">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormField
          control={control}
          name="old_password"
          render={({ value, onChange, name, error, onBlur }) => (
            <PasswordInput
              label="原密码"
              autoComplete="current-password"
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
          name="new_password"
          render={({ value, onChange, name, error, onBlur }) => (
            <PasswordInput
              label="新密码"
              autoComplete="new-password"
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
          name="confirm"
          render={({ value, onChange, name, error, onBlur }) => (
            <PasswordInput
              label="确认新密码"
              autoComplete="new-password"
              name={name}
              value={(value as string) ?? ""}
              onChange={(e) => onChange(e.target.value)}
              onBlur={onBlur}
              error={error}
            />
          )}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} type="button">
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
