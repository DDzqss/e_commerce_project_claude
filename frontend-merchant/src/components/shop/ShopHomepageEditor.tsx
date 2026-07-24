"use client";

/**
 * ShopHomepageEditor —— 店铺主页设置表单（Phase 5 §9.3）。
 *
 * 覆盖字段（PATCH /merchant/me/shop）：
 *   - logo_url          (shop_logo purpose，5MB)
 *   - banner_url        (shop_banner purpose，5MB；banner 更长，页面单独宽尺寸)
 *   - name              只读（平台核定）
 *   - description       500 字以内
 *   - announcement      店铺公告（Phase 5 简化：纯文本 + 换行）
 *   - contact_name / contact_phone
 *
 * 提交：单一「保存」按钮触发 PATCH；成功后同步 store + query cache。
 * 状态：logo / banner 用本地 useState 管理（因为不参与 zod schema 校验），
 *       其余字段用 react-hook-form + zod。
 */

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { Input } from "@/components/ui/Input";
import { toast } from "@/components/ui/Toast";
import { useUpdateShopHomepage } from "@/hooks/useShopHomepage";
import { ApiError } from "@/types/errors";
import type { ShopOut } from "@/types/api";

const DESCRIPTION_MAX = 500;
const ANNOUNCEMENT_MAX = 1000;

const schema = z.object({
  description: z
    .string()
    .max(DESCRIPTION_MAX, `店铺简介不超过 ${DESCRIPTION_MAX} 字`)
    .optional()
    .transform((v) => (v === undefined || v === "" ? null : v)),
  announcement: z
    .string()
    .max(ANNOUNCEMENT_MAX, `公告不超过 ${ANNOUNCEMENT_MAX} 字`)
    .optional()
    .transform((v) => (v === undefined || v === "" ? null : v)),
  contact_name: z
    .string()
    .min(2, "联系人姓名至少 2 字")
    .max(60, "联系人姓名不超过 60 字"),
  contact_phone: z
    .string()
    .regex(/^1\d{10}$/u, "请输入 11 位中国大陆手机号"),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

export interface ShopHomepageEditorProps {
  shop: ShopOut;
  /** SHOP_OWNER 才能编辑；其他角色只读展示。 */
  canEdit: boolean;
}

export function ShopHomepageEditor({ shop, canEdit }: ShopHomepageEditorProps) {
  const mutation = useUpdateShopHomepage();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      description: shop.description ?? "",
      announcement: shop.announcement ?? "",
      contact_name: shop.contact_name,
      contact_phone: shop.contact_phone,
    },
  });

  const [logoKey, setLogoKey] = useState<string | null>(shop.logo_url ?? null);
  const [bannerKey, setBannerKey] = useState<string | null>(
    shop.banner_url ?? null,
  );

  // 若外部 shop 数据刷新（如 refetch），同步 logo/banner 状态
  useEffect(() => {
    setLogoKey(shop.logo_url ?? null);
    setBannerKey(shop.banner_url ?? null);
  }, [shop.logo_url, shop.banner_url]);

  const onSubmit = handleSubmit((raw) => {
    const parsed = raw as unknown as FormOutput;
    mutation.mutate(
      {
        description: parsed.description,
        announcement: parsed.announcement,
        contact_name: parsed.contact_name,
        contact_phone: parsed.contact_phone,
        logo_url: logoKey,
        banner_url: bannerKey,
      },
      {
        onSuccess: (data) => {
          toast.success("店铺主页已更新");
          reset({
            description: data.description ?? "",
            announcement: data.announcement ?? "",
            contact_name: data.contact_name,
            contact_phone: data.contact_phone,
          });
          setLogoKey(data.logo_url ?? null);
          setBannerKey(data.banner_url ?? null);
        },
        onError: (err) => {
          const msg =
            err instanceof ApiError ? err.toUserMessage() : "保存失败，请稍后重试";
          toast.error(msg);
        },
      },
    );
  });

  const logoDirty = logoKey !== (shop.logo_url ?? null);
  const bannerDirty = bannerKey !== (shop.banner_url ?? null);
  const anyDirty = isDirty || logoDirty || bannerDirty;

  const doReset = () => {
    reset({
      description: shop.description ?? "",
      announcement: shop.announcement ?? "",
      contact_name: shop.contact_name,
      contact_phone: shop.contact_phone,
    });
    setLogoKey(shop.logo_url ?? null);
    setBannerKey(shop.banner_url ?? null);
  };

  return (
    <form
      className="space-y-6"
      onSubmit={onSubmit}
      noValidate
      aria-label="店铺主页编辑表单"
    >
      {/* Logo & Banner */}
      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-neutral-800">品牌形象</h3>
        <p className="mt-1 text-xs text-neutral-500">
          Logo 建议 200×200 正方形，Banner 建议 1200×300；单张不超过 5MB
        </p>
        <div className="mt-4 flex flex-col gap-6 sm:flex-row">
          <FormField label="店铺 Logo" hint="展示在店铺首页顶栏与商品卡片">
            {() => (
              <ImageUpload
                value={logoKey}
                onChange={setLogoKey}
                purpose="shop_logo"
                disabled={!canEdit}
                sizeClass="h-24 w-24"
                hint="点击上传 Logo"
              />
            )}
          </FormField>
          <div className="flex-1">
            <FormField label="店铺 Banner" hint="宽幅横图，展示在店铺主页顶部">
              {() => (
                <ImageUpload
                  value={bannerKey}
                  onChange={setBannerKey}
                  purpose="shop_banner"
                  disabled={!canEdit}
                  sizeClass="h-24 w-full sm:w-80"
                  hint="点击上传 Banner"
                />
              )}
            </FormField>
          </div>
        </div>
      </section>

      {/* 基础信息 */}
      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-neutral-800">基础信息</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="店铺名称" hint="由平台核定，暂不支持自助修改">
            {(id) => <Input id={id} value={shop.name} disabled readOnly />}
          </FormField>
          <FormField label="店铺 ID">
            {(id) => (
              <Input id={id} value={String(shop.id)} disabled readOnly />
            )}
          </FormField>
          <FormField
            label="联系人"
            required
            error={errors.contact_name?.message}
          >
            {(id) => (
              <Input
                id={id}
                disabled={!canEdit}
                invalid={Boolean(errors.contact_name)}
                {...register("contact_name")}
              />
            )}
          </FormField>
          <FormField
            label="联系电话"
            required
            error={errors.contact_phone?.message}
          >
            {(id) => (
              <Input
                id={id}
                inputMode="tel"
                disabled={!canEdit}
                invalid={Boolean(errors.contact_phone)}
                {...register("contact_phone")}
              />
            )}
          </FormField>
        </div>
      </section>

      {/* 描述与公告 */}
      <section className="rounded-lg border border-neutral-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-neutral-800">描述与公告</h3>
        <div className="mt-4 space-y-4">
          <FormField
            label="店铺简介"
            hint={`用于展示给消费者，不超过 ${DESCRIPTION_MAX} 字`}
            error={errors.description?.message}
          >
            {(id) => (
              <textarea
                id={id}
                rows={3}
                disabled={!canEdit}
                className="block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus-visible:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-blue-200 disabled:bg-neutral-50 disabled:text-neutral-400"
                placeholder="简单介绍主营品类、经营理念等"
                {...register("description")}
              />
            )}
          </FormField>
          <FormField
            label="店铺公告"
            hint="换行会保留展示；不超过 1000 字。（Phase 5 简化：纯文本 + \\n）"
            error={errors.announcement?.message}
          >
            {(id) => (
              <textarea
                id={id}
                rows={5}
                disabled={!canEdit}
                className="block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus-visible:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-blue-200 disabled:bg-neutral-50 disabled:text-neutral-400"
                placeholder="例如：暑期不打烊 · 客服时段 9:00-21:00"
                {...register("announcement")}
              />
            )}
          </FormField>
        </div>
      </section>

      {canEdit ? (
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={doReset}
            disabled={!anyDirty || mutation.isPending}
          >
            重置
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={mutation.isPending}
            disabled={!anyDirty}
          >
            保存
          </Button>
        </div>
      ) : (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
          当前角色为「运营 / 客服」，仅可查看店铺信息。请联系店主进行修改。
        </p>
      )}
    </form>
  );
}
