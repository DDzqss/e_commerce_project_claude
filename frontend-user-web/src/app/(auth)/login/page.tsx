"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Suspense, useEffect, useState } from "react";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { FormField } from "@/components/ui/FormField";
import { toast } from "@/components/ui/Toast";
import { useAuthStore } from "@/lib/auth-store";
import { loginUser } from "@/lib/auth-api";
import { ApiError } from "@/lib/api";
import { ErrorCode, messageForCode } from "@/types/errors";
import { useAuth } from "@/hooks/useAuth";

/** identifier：手机号（11 位）或邮箱。 */
const IDENTIFIER_REGEX = /^(1\d{10}|[^\s@]+@[^\s@]+\.[^\s@]+)$/;

const loginSchema = z.object({
  identifier: z
    .string()
    .min(1, "请输入手机号或邮箱")
    .regex(IDENTIFIER_REGEX, "请输入正确的手机号或邮箱"),
  password: z
    .string()
    .min(8, "密码至少 8 位")
    .max(64, "密码最长 64 位"),
  remember: z.boolean().optional(),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const login = useAuthStore((s) => s.login);
  const { isLoggedIn, hasHydrated } = useAuth();

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "", remember: true },
    mode: "onSubmit",
  });

  const [topError, setTopError] = useState<string | null>(null);

  // 已登录直接跳走
  useEffect(() => {
    if (hasHydrated && isLoggedIn) {
      router.replace(next);
    }
  }, [hasHydrated, isLoggedIn, next, router]);

  const onSubmit = handleSubmit(async (values) => {
    setTopError(null);
    try {
      const result = await loginUser({
        identifier: values.identifier.trim(),
        password: values.password,
      });
      login(result);
      toast.success("登录成功");
      router.replace(next);
    } catch (e) {
      if (e instanceof ApiError) {
        if (
          e.code === ErrorCode.BadCredential ||
          e.code === ErrorCode.UserNotFound
        ) {
          setTopError("账号或密码错误");
        } else if (e.code === ErrorCode.AccountDisabled) {
          setTopError("账号已被禁用，请联系客服");
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
      title="登录 JD-Clone"
      subtitle="使用手机号或邮箱登录你的账户"
      footer={
        <span>
          还没有账号？
          <Link
            href="/register"
            className="ml-1 text-[color:var(--color-primary)] hover:underline"
          >
            立即注册
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
              inputMode="email"
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
          name="password"
          render={({ value, onChange, onBlur, name, error }) => (
            <PasswordInput
              label="密码"
              placeholder="请输入密码"
              autoComplete="current-password"
              name={name}
              value={(value as string) ?? ""}
              onChange={(e) => onChange(e.target.value)}
              onBlur={onBlur}
              error={error}
            />
          )}
        />

        <div className="flex items-center justify-between text-sm">
          <FormField
            control={control}
            name="remember"
            render={({ value, onChange }) => (
              <label className="inline-flex items-center gap-2 text-neutral-600">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[color:var(--color-primary)]"
                  checked={Boolean(value)}
                  onChange={(e) => onChange(e.target.checked)}
                />
                记住我
              </label>
            )}
          />
          <Link
            href="/forgot-password"
            className="text-[color:var(--color-primary)] hover:underline"
          >
            忘记密码？
          </Link>
        </div>

        <Button type="submit" fullWidth size="lg" loading={isSubmitting}>
          登录
        </Button>
      </form>
    </AuthLayout>
  );
}
