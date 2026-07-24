"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { toast } from "@/components/ui/Toast";
import { useAuth } from "@/hooks/useAuth";
import { ApiError } from "@/types/errors";

const passwordPattern = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d\W_]{8,64}$/u;

const schema = z
  .object({
    old_password: z
      .string({ required_error: "请输入原密码" })
      .min(8, "原密码至少 8 位"),
    new_password: z
      .string({ required_error: "请输入新密码" })
      .min(8, "新密码 8-64 位")
      .max(64, "新密码 8-64 位")
      .regex(passwordPattern, "至少包含字母与数字"),
    confirm_password: z.string({ required_error: "请再次输入新密码" }),
  })
  .refine((v) => v.new_password === v.confirm_password, {
    path: ["confirm_password"],
    message: "两次输入的新密码不一致",
  })
  .refine((v) => v.new_password !== v.old_password, {
    path: ["new_password"],
    message: "新密码不能与原密码相同",
  });

type ChangePasswordForm = z.infer<typeof schema>;

export default function ChangePasswordPage() {
  const router = useRouter();
  const { changePasswordMutation, logout } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ChangePasswordForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      old_password: "",
      new_password: "",
      confirm_password: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await changePasswordMutation.mutateAsync({
        old_password: values.old_password,
        new_password: values.new_password,
      });
      toast.success("密码已更新，请使用新密码重新登录");
      reset();
      // 修改密码后按契约后端会 revoke 现有 refresh，我们主动登出保证一致
      await logout();
      router.replace("/login");
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.toUserMessage() : "修改失败，请稍后重试";
      toast.error(msg);
    }
  });

  const submitting = changePasswordMutation.isPending;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-neutral-900">修改密码</h2>
        <p className="mt-1 text-sm text-neutral-500">
          出于安全考虑，修改密码后需重新登录。
        </p>
      </div>

      <form
        className="space-y-4 rounded-lg border border-neutral-200 bg-white p-6"
        onSubmit={onSubmit}
        noValidate
      >
        <FormField
          label="原密码"
          required
          error={errors.old_password?.message}
        >
          {(id) => (
            <PasswordInput
              id={id}
              autoComplete="current-password"
              invalid={Boolean(errors.old_password)}
              {...register("old_password")}
            />
          )}
        </FormField>

        <FormField
          label="新密码"
          required
          hint="8-64 位，至少包含字母与数字"
          error={errors.new_password?.message}
        >
          {(id) => (
            <PasswordInput
              id={id}
              autoComplete="new-password"
              invalid={Boolean(errors.new_password)}
              {...register("new_password")}
            />
          )}
        </FormField>

        <FormField
          label="确认新密码"
          required
          error={errors.confirm_password?.message}
        >
          {(id) => (
            <PasswordInput
              id={id}
              autoComplete="new-password"
              invalid={Boolean(errors.confirm_password)}
              {...register("confirm_password")}
            />
          )}
        </FormField>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            variant="secondary"
            type="button"
            onClick={() => router.back()}
            disabled={submitting}
          >
            返回
          </Button>
          <Button type="submit" variant="primary" loading={submitting}>
            确认修改
          </Button>
        </div>
      </form>
    </div>
  );
}
