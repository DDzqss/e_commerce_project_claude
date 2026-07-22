"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Suspense, useState } from "react";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { FormField } from "@/components/ui/FormField";
import { toast } from "@/components/ui/Toast";
import { resetPassword } from "@/lib/auth-api";
import { ApiError } from "@/lib/api";
import { ErrorCode, messageForCode } from "@/types/errors";

const IDENTIFIER_REGEX = /^(1\d{10}|[^\s@]+@[^\s@]+\.[^\s@]+)$/;
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)[\S]{8,64}$/;

const schema = z
  .object({
    identifier: z
      .string()
      .min(1, "请输入手机号或邮箱")
      .regex(IDENTIFIER_REGEX, "请输入正确的手机号或邮箱"),
    code: z.string().regex(/^\d{6}$/, "请输入 6 位数字验证码"),
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

type Form = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  // useSearchParams 在 App Router 生产构建时必须包在 Suspense 内，
  // 否则 static rendering 会 bail out。
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  );
}

function ResetPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefill = searchParams.get("identifier") ?? "";
  const [topError, setTopError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      identifier: prefill,
      code: "",
      new_password: "",
      confirm: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setTopError(null);
    try {
      await resetPassword({
        identifier: values.identifier.trim(),
        code: values.code,
        new_password: values.new_password,
      });
      toast.success("密码已重置，请使用新密码登录");
      router.replace("/login");
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === ErrorCode.VerifyCodeInvalid) {
          setTopError("验证码错误或已过期，请重新获取");
        } else {
          setTopError(messageForCode(e.code, e.message));
        }
      } else {
        setTopError("网络异常，请稍后重试");
      }
    }
  });

  return (
    <AuthLayout
      title="重置密码"
      subtitle="输入收到的验证码并设置新密码"
      footer={
        <span>
          未收到验证码？
          <Link
            href="/forgot-password"
            className="ml-1 text-[color:var(--color-primary)] hover:underline"
          >
            重新发送
          </Link>
        </span>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {topError && (
          <div
            role="alert"
            aria-live="assertive"
            className="rounded-md border border-[color:var(--color-primary-200)] bg-[color:var(--color-primary-50)] px-3 py-2 text-sm text-[color:var(--color-primary-700)]"
          >
            {topError}
          </div>
        )}

        <FormField
          control={control}
          name="identifier"
          render={({ value, onChange, onBlur, name, error }) => (
            <Input
              label="手机号 / 邮箱"
              placeholder="例如 13800001234 或 you@example.com"
              autoComplete="username"
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
          name="code"
          render={({ value, onChange, onBlur, name, error }) => (
            <Input
              label="验证码"
              placeholder="6 位数字"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
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
          render={({ value, onChange, onBlur, name, error }) => (
            <PasswordInput
              label="新密码"
              placeholder="8-64 位，含字母和数字"
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
          render={({ value, onChange, onBlur, name, error }) => (
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

        <Button type="submit" fullWidth size="lg" loading={isSubmitting}>
          重置密码
        </Button>
      </form>
    </AuthLayout>
  );
}
