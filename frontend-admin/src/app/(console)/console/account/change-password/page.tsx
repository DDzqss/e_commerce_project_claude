"use client";

/**
 * 管理员修改密码页 (`/console/account/change-password`)。
 *
 * 契约：POST /admin/auth/change-password { old_password, new_password }
 *
 * 交互：
 * - 旧密码 + 新密码 + 再次输入
 * - 前端校验：新密码 8-64 位、至少 1 字母 + 1 数字
 * - 修改成功后强制登出，跳到 /login
 * - 错误 2010 旧密码错误 走友好提示
 */

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { changeAdminPassword } from "@/lib/auth-api";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api";
import { getErrorMessage } from "@/types/errors";

const PWD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)[\S]{8,64}$/;

export default function ChangePasswordPage() {
  const router = useRouter();
  const toast = useToast();
  const { logout } = useAuth();

  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!oldPwd) next.oldPwd = "请输入旧密码";
    if (!PWD_REGEX.test(newPwd)) {
      next.newPwd = "新密码需 8-64 位，且同时包含字母和数字";
    }
    if (newPwd && oldPwd && newPwd === oldPwd) {
      next.newPwd = "新密码不能与旧密码相同";
    }
    if (confirmPwd !== newPwd) {
      next.confirmPwd = "两次密码不一致";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await changeAdminPassword({
        old_password: oldPwd,
        new_password: newPwd,
      });
      toast.push({
        type: "success",
        message: "密码修改成功，请使用新密码重新登录",
      });
      // 修改成功后强制登出
      await logout();
      router.replace("/login");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 2010) {
          setErrors({ oldPwd: getErrorMessage(err.code) });
        } else {
          toast.push({
            type: "error",
            message: getErrorMessage(err.code, err.message),
          });
        }
      } else {
        toast.push({ type: "error", message: "网络异常，请稍后重试" });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold text-neutral-900">修改密码</h1>
        <p className="mt-1 text-sm text-neutral-500">
          修改成功后当前会话将强制退出，请使用新密码重新登录。
        </p>
      </header>

      <form
        onSubmit={onSubmit}
        noValidate
        className="flex flex-col gap-4 rounded-md border border-[color:var(--color-border)] bg-white p-6"
      >
        <FormField
          label="旧密码"
          htmlFor="old-pwd"
          required
          error={errors.oldPwd}
        >
          <PasswordInput
            id="old-pwd"
            autoComplete="current-password"
            value={oldPwd}
            onChange={(e) => setOldPwd(e.target.value)}
            invalid={Boolean(errors.oldPwd)}
          />
        </FormField>

        <FormField
          label="新密码"
          htmlFor="new-pwd"
          required
          error={errors.newPwd}
          description="8-64 位，至少包含 1 个字母和 1 个数字"
        >
          <PasswordInput
            id="new-pwd"
            autoComplete="new-password"
            value={newPwd}
            onChange={(e) => setNewPwd(e.target.value)}
            invalid={Boolean(errors.newPwd)}
          />
        </FormField>

        <FormField
          label="再次输入新密码"
          htmlFor="confirm-pwd"
          required
          error={errors.confirmPwd}
        >
          <PasswordInput
            id="confirm-pwd"
            autoComplete="new-password"
            value={confirmPwd}
            onChange={(e) => setConfirmPwd(e.target.value)}
            invalid={Boolean(errors.confirmPwd)}
          />
        </FormField>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="secondary"
            type="button"
            onClick={() => router.back()}
            disabled={submitting}
          >
            取消
          </Button>
          <Button type="submit" loading={submitting}>
            确认修改
          </Button>
        </div>
      </form>
    </div>
  );
}
