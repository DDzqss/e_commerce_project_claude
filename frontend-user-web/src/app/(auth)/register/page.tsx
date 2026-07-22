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
import { PasswordInput } from "@/components/ui/PasswordInput";
import { FormField } from "@/components/ui/FormField";
import { toast } from "@/components/ui/Toast";
import { useAuthStore } from "@/lib/auth-store";
import { registerUser } from "@/lib/auth-api";
import { ApiError } from "@/lib/api";
import { ErrorCode, messageForCode } from "@/types/errors";

const PHONE_REGEX = /^1\d{10}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** 密码策略：契约 §5.1 + 附录 A —— 8-64 位，至少 1 字母 + 1 数字。 */
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)[\S]{8,64}$/;

const baseSchema = z
  .object({
    tab: z.enum(["phone", "email"]),
    phone: z.string().optional().default(""),
    email: z.string().optional().default(""),
    password: z
      .string()
      .min(8, "密码 8-64 位")
      .max(64, "密码 8-64 位")
      .regex(PASSWORD_REGEX, "密码需同时含字母和数字"),
    confirm: z.string(),
    nickname: z.string().max(60, "昵称最长 60 字").optional().default(""),
  })
  .superRefine((v, ctx) => {
    if (v.tab === "phone") {
      if (!PHONE_REGEX.test(v.phone)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "请输入正确的手机号",
          path: ["phone"],
        });
      }
    } else if (!EMAIL_REGEX.test(v.email)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "请输入正确的邮箱地址",
        path: ["email"],
      });
    }
    if (v.confirm !== v.password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "两次输入的密码不一致",
        path: ["confirm"],
      });
    }
  });

type RegisterForm = z.infer<typeof baseSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [topError, setTopError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(baseSchema),
    defaultValues: {
      tab: "phone",
      phone: "",
      email: "",
      password: "",
      confirm: "",
      nickname: "",
    },
  });

  const tab = watch("tab");

  const onSubmit = handleSubmit(async (values) => {
    setTopError(null);
    try {
      const payload = {
        phone: values.tab === "phone" ? values.phone.trim() : null,
        email: values.tab === "email" ? values.email.trim() : null,
        password: values.password,
        nickname: values.nickname?.trim() || null,
      };
      const result = await registerUser(payload);
      login(result);
      toast.success("注册成功，欢迎来到 JD-Clone");
      router.replace("/");
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === ErrorCode.PhoneAlreadyRegistered) {
          setTopError("该手机号已注册，请直接登录");
        } else if (e.code === ErrorCode.EmailAlreadyRegistered) {
          setTopError("该邮箱已注册，请直接登录");
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
      title="注册新账户"
      subtitle="仅需一分钟，即刻开启购物之旅"
      footer={
        <span>
          已有账号？
          <Link
            href="/login"
            className="ml-1 text-[color:var(--color-primary)] hover:underline"
          >
            去登录
          </Link>
        </span>
      }
    >
      {/* tab 切换 */}
      <div className="mb-4 flex overflow-hidden rounded-md border border-neutral-300 text-sm">
        {(
          [
            { key: "phone", label: "手机号注册" },
            { key: "email", label: "邮箱注册" },
          ] as const
        ).map((opt) => {
          const active = tab === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              className={
                active
                  ? "flex-1 bg-[color:var(--color-primary)] py-2 font-medium text-white"
                  : "flex-1 bg-white py-2 text-neutral-600 hover:bg-neutral-50"
              }
              onClick={() => setValue("tab", opt.key)}
              aria-pressed={active}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

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

        {tab === "phone" ? (
          <FormField
            control={control}
            name="phone"
            render={({ value, onChange, onBlur, name, error }) => (
              <Input
                label="手机号"
                placeholder="11 位中国大陆手机号"
                inputMode="numeric"
                autoComplete="tel"
                name={name}
                value={(value as string) ?? ""}
                onChange={(e) => onChange(e.target.value)}
                onBlur={onBlur}
                error={error}
              />
            )}
          />
        ) : (
          <FormField
            control={control}
            name="email"
            render={({ value, onChange, onBlur, name, error }) => (
              <Input
                label="邮箱"
                placeholder="you@example.com"
                type="email"
                autoComplete="email"
                name={name}
                value={(value as string) ?? ""}
                onChange={(e) => onChange(e.target.value)}
                onBlur={onBlur}
                error={error}
              />
            )}
          />
        )}

        <FormField
          control={control}
          name="nickname"
          render={({ value, onChange, onBlur, name, error }) => (
            <Input
              label="昵称（可选）"
              placeholder="留空将自动生成"
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
              placeholder="8-64 位，含字母和数字"
              autoComplete="new-password"
              name={name}
              value={(value as string) ?? ""}
              onChange={(e) => onChange(e.target.value)}
              onBlur={onBlur}
              error={error}
              hint={error ? undefined : "至少 8 位，需同时包含字母和数字"}
            />
          )}
        />

        <FormField
          control={control}
          name="confirm"
          render={({ value, onChange, onBlur, name, error }) => (
            <PasswordInput
              label="确认密码"
              placeholder="再输入一次"
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
          创建账户
        </Button>

        <p className="text-center text-xs text-neutral-400">
          注册即代表同意《用户协议》与《隐私政策》
        </p>
      </form>
    </AuthLayout>
  );
}
