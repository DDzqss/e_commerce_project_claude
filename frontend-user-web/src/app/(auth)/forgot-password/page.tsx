"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";

import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { toast } from "@/components/ui/Toast";
import { forgotPassword } from "@/lib/auth-api";
import { ApiError } from "@/lib/api";
import { messageForCode } from "@/types/errors";

const IDENTIFIER_REGEX = /^(1\d{10}|[^\s@]+@[^\s@]+\.[^\s@]+)$/;

const schema = z.object({
  identifier: z
    .string()
    .min(1, "请输入手机号或邮箱")
    .regex(IDENTIFIER_REGEX, "请输入正确的手机号或邮箱"),
});

type Form = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [sent, setSent] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    getValues,
    formState: { isSubmitting },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { identifier: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await forgotPassword({ identifier: values.identifier.trim() });
      // 契约 §5.1：无论账号存在与否统一提示（防枚举）
      setSent(values.identifier.trim());
      toast.success("验证码已发送，请查收（Phase 1 打印到后端日志）");
    } catch (e) {
      const msg =
        e instanceof ApiError ? messageForCode(e.code, e.message) : "发送失败";
      toast.error(msg);
    }
  });

  const goReset = () => {
    const id = sent ?? getValues("identifier");
    router.push(`/reset-password?identifier=${encodeURIComponent(id)}`);
  };

  return (
    <AuthLayout
      title="找回密码"
      subtitle="输入注册手机号或邮箱，我们将发送验证码"
      footer={
        <span>
          想起密码了？
          <Link
            href="/login"
            className="ml-1 text-[color:var(--color-primary)] hover:underline"
          >
            返回登录
          </Link>
        </span>
      }
    >
      {sent ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-md border border-green-300 bg-green-50 px-3 py-3 text-sm text-green-800">
            我们已向 <span className="font-medium">{sent}</span> 发送 6 位验证码，5 分钟内有效。
          </div>
          <Button fullWidth size="lg" onClick={goReset}>
            前往重置密码
          </Button>
          <Button
            fullWidth
            size="md"
            variant="ghost"
            onClick={() => setSent(null)}
          >
            换一个账号
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
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
          <Button type="submit" fullWidth size="lg" loading={isSubmitting}>
            发送验证码
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
