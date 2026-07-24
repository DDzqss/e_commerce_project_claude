"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { toast } from "@/components/ui/Toast";
import { useAuth } from "@/hooks/useAuth";
import { useMerchantAuthStore } from "@/lib/auth-store";
import { ApiError } from "@/types/errors";

// 用户端首页地址，用于"申请入驻"跳转（Phase 1 商家端无注册）
const USER_WEB_APPLY_URL =
  process.env.NEXT_PUBLIC_USER_WEB_URL ??
  "http://localhost:3000/account/merchant-apply";

const loginSchema = z.object({
  login_name: z
    .string({ required_error: "请输入登录名" })
    .min(2, "登录名至少 2 位")
    .max(60, "登录名不超过 60 位"),
  password: z
    .string({ required_error: "请输入密码" })
    .min(8, "密码至少 8 位")
    .max(64, "密码不超过 64 位"),
});
type LoginForm = z.infer<typeof loginSchema>;

function safeNext(raw: string | null): string {
  if (!raw) return "/dashboard";
  try {
    const decoded = decodeURIComponent(raw);
    // 防开放重定向：只允许站内、根路径开头
    if (!decoded.startsWith("/") || decoded.startsWith("//")) return "/dashboard";
    return decoded;
  } catch {
    return "/dashboard";
  }
}

function LoginPageInner() {
  const router = useRouter();
  const search = useSearchParams();
  const next = safeNext(search?.get("next") ?? null);

  const { loginMutation } = useAuth();
  const hydrated = useMerchantAuthStore((s) => s.hydrated);
  const authed = useMerchantAuthStore((s) =>
    Boolean(s.accessToken && s.merchantAccount),
  );

  const [rootError, setRootError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { login_name: "", password: "" },
  });

  // 已登录 → 直接跳目标页
  useEffect(() => {
    if (hydrated && authed) {
      router.replace(next);
    }
  }, [hydrated, authed, next, router]);

  const onSubmit = handleSubmit(async (values) => {
    setRootError(null);
    try {
      await loginMutation.mutateAsync(values);
      toast.success("登录成功");
      router.replace(next);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.toUserMessage()
          : "登录失败，请稍后重试";
      setRootError(msg);
    }
  });

  const submitting = isSubmitting || loginMutation.isPending;

  return (
    <AuthLayout
      title="商家账号登录"
      subtitle="请使用平台颁发的商家登录名与密码"
      footer={
        <div className="space-y-1">
          <div>
            还不是商家？前往{" "}
            <a
              href={USER_WEB_APPLY_URL}
              className="text-[var(--color-primary)] hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              用户端申请入驻
            </a>
          </div>
          <div className="text-neutral-400">
            © {new Date().getFullYear()} JD-Clone Merchant Console
          </div>
        </div>
      }
    >
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        <FormField
          label="登录名"
          required
          error={errors.login_name?.message}
        >
          {(id) => (
            <Input
              id={id}
              autoComplete="username"
              autoFocus
              placeholder="例如 shop123_owner"
              invalid={Boolean(errors.login_name)}
              {...register("login_name")}
            />
          )}
        </FormField>

        <FormField label="密码" required error={errors.password?.message}>
          {(id) => (
            <PasswordInput
              id={id}
              autoComplete="current-password"
              placeholder="至少 8 位，含字母与数字"
              invalid={Boolean(errors.password)}
              {...register("password")}
            />
          )}
        </FormField>

        {rootError ? (
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
          >
            {rootError}
          </div>
        ) : null}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          fullWidth
          loading={submitting}
        >
          {submitting ? "登录中…" : "登录"}
        </Button>

        <p className="text-center text-xs text-neutral-400">
          Phase 1 说明：商家端不开放公开注册，账号由平台审批入驻后创建。
        </p>
      </form>
    </AuthLayout>
  );
}

/**
 * Next 15 中 useSearchParams 需要 Suspense 边界，否则 build 会报警告。
 */
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}
