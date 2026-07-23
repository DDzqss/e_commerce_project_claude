"use client";

/**
 * 新建商品向导（3 步）。
 *
 * 步骤：
 *   1. 基本信息（title/subtitle/category_id/brand_id/main_image/spec_axes）
 *   2. 详情图 + 描述
 *   3. SKU 列表（至少 1 个 active SKU 方可提审；草稿允许缺 SKU）
 *
 * 提交策略：
 *   - "保存草稿"：POST /spus 创建 draft；然后循环 POST /spus/{id}/skus；不调 submit-review
 *   - "提交审核"：先严格校验（至少 1 个 active SKU），再走同样流程 + submit-review
 *
 * 失败保护：SPU 已创建但 SKU 提交失败时，跳转到 /products/{id} 让用户继续。
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { MultiImageUpload } from "@/components/ui/MultiImageUpload";
import { toast } from "@/components/ui/Toast";
import {
  SPUBasicInfoForm,
  type SPUBasicFormValues,
} from "@/components/products/SPUBasicInfoForm";
import {
  SKUFormModal,
  type SKUFormOutput,
} from "@/components/products/SKUFormModal";
import { centsToYuanString } from "@/components/ui/PriceInput";
import { cn } from "@/lib/cn";
import { createSPU, submitReview } from "@/lib/product-api";
import { createSKU } from "@/lib/sku-api";
import { MY_SPUS_QUERY_KEY } from "@/hooks/useMySPUs";
import { ApiError } from "@/types/errors";
import type { CreateSKUIn } from "@/types/api";

interface WizardFormValues extends SPUBasicFormValues {
  description: string;
  images: string[];
}

interface DraftSKU extends CreateSKUIn {
  /** 本地 uid，用于 list key + 删除 */
  _uid: string;
}

const STEPS = [
  { key: 1, label: "基本信息" },
  { key: 2, label: "详情与图片" },
  { key: 3, label: "SKU 管理" },
] as const;

export default function NewProductPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [skus, setSkus] = useState<DraftSKU[]>([]);
  const [skuModalOpen, setSkuModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const methods = useForm<WizardFormValues>({
    defaultValues: {
      title: "",
      subtitle: "",
      category_id: null,
      brand_id: null,
      main_image: "",
      spec_axes: [],
      description: "",
      images: [],
    },
    mode: "onBlur",
  });

  const specAxes = methods.watch("spec_axes");

  const goNext = async () => {
    if (step === 1) {
      const ok = await methods.trigger([
        "title",
        "category_id",
        "main_image",
      ]);
      if (!ok) return;
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };
  const goPrev = () => {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  };

  const addSku = (out: SKUFormOutput) => {
    if (out.mode !== "create") return; // wizard 阶段只走 create
    setSkus((s) => [
      ...s,
      { ...out.payload, _uid: `local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` },
    ]);
    setSkuModalOpen(false);
  };

  const removeSku = (uid: string) => {
    setSkus((s) => s.filter((x) => x._uid !== uid));
  };

  const saveMutation = useMutation({
    mutationFn: async ({ toReview }: { toReview: boolean }) => {
      const values = methods.getValues();
      // 1. 创建 SPU
      const created = await createSPU({
        category_id: values.category_id!,
        brand_id: values.brand_id ?? null,
        title: values.title,
        subtitle: values.subtitle || null,
        description: values.description || null,
        main_image: values.main_image,
        images: values.images,
        spec_axes: values.spec_axes,
      });
      // 2. 批量创建 SKU
      const createdSkus: Array<{ ok: boolean; error?: string }> = [];
      for (const s of skus) {
        try {
          // 剥掉 _uid
          const { _uid: _localUid, ...payload } = s;
          void _localUid;
          await createSKU(created.id, payload);
          createdSkus.push({ ok: true });
        } catch (e) {
          createdSkus.push({
            ok: false,
            error: e instanceof ApiError ? e.toUserMessage() : "SKU 保存失败",
          });
        }
      }
      // 3. 若要提审，且没有失败的 SKU
      const failed = createdSkus.filter((r) => !r.ok);
      if (toReview) {
        if (failed.length > 0) {
          throw new Error(
            `部分 SKU 创建失败（${failed.length}/${skus.length}），已保存为草稿，请到详情页处理后再提审`,
          );
        }
        await submitReview(created.id);
      }
      return { id: created.id, failed: failed.length };
    },
    onSuccess: ({ id, failed }, vars) => {
      queryClient.invalidateQueries({ queryKey: MY_SPUS_QUERY_KEY });
      if (vars.toReview) {
        toast.success("已提交审核");
      } else if (failed > 0) {
        toast.warning(`草稿已保存，但 ${failed} 个 SKU 创建失败`);
      } else {
        toast.success("草稿已保存");
      }
      router.push(`/products/${id}`);
    },
    onError: (err) => {
      const msg =
        err instanceof ApiError
          ? err.toUserMessage()
          : err instanceof Error
            ? err.message
            : "保存失败，请稍后重试";
      toast.error(msg);
    },
    onSettled: () => setSubmitting(false),
  });

  const submit = async (toReview: boolean) => {
    // 基础必填校验
    const ok = await methods.trigger([
      "title",
      "category_id",
      "main_image",
    ]);
    if (!ok) {
      toast.error("请补齐基本信息");
      setStep(1);
      return;
    }
    // 提审严格校验：至少 1 个 active SKU
    if (toReview) {
      const activeCount = skus.filter((s) => s.is_active !== false).length;
      if (activeCount === 0) {
        toast.error("提审需要至少 1 个启用中的 SKU");
        setStep(3);
        return;
      }
    }
    setSubmitting(true);
    saveMutation.mutate({ toReview });
  };

  return (
    <FormProvider {...methods}>
      <div className="space-y-6">
        <header className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-neutral-900">
              新建商品
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              分 3 步完成：基本信息 → 详情图与描述 → 添加 SKU
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={() => router.push("/products")}
            disabled={submitting}
          >
            取消
          </Button>
        </header>

        {/* Stepper */}
        <ol className="flex items-center gap-4 border-b border-neutral-200 pb-4">
          {STEPS.map((s, idx) => {
            const active = step === s.key;
            const past = step > s.key;
            return (
              <li key={s.key} className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold",
                    active
                      ? "bg-[var(--color-primary)] text-white"
                      : past
                        ? "bg-emerald-500 text-white"
                        : "bg-neutral-200 text-neutral-500",
                  )}
                >
                  {past ? "✓" : s.key}
                </span>
                <span
                  className={cn(
                    "text-sm",
                    active
                      ? "font-medium text-neutral-900"
                      : "text-neutral-500",
                  )}
                >
                  {s.label}
                </span>
                {idx < STEPS.length - 1 ? (
                  <span aria-hidden className="mx-2 text-neutral-300">
                    →
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>

        <section className="rounded-lg border border-neutral-200 bg-white p-6">
          {step === 1 ? <SPUBasicInfoForm /> : null}

          {step === 2 ? (
            <div className="space-y-4">
              <FormField
                label="详情图 gallery"
                hint="最多 8 张，可拖拽排序；建议尺寸 800×800 起"
              >
                {() => (
                  <MultiImageUpload
                    value={methods.watch("images")}
                    onChange={(next) =>
                      methods.setValue("images", next, {
                        shouldDirty: true,
                      })
                    }
                    purpose="spu_gallery"
                    max={8}
                  />
                )}
              </FormField>

              <FormField
                label="商品描述"
                hint="Phase 2 版本仅支持纯文本"
              >
                {(id) => (
                  <textarea
                    id={id}
                    rows={8}
                    placeholder="从材质、卖点、售后等角度介绍商品"
                    className="block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-blue-200"
                    {...methods.register("description", {
                      maxLength: {
                        value: 5000,
                        message: "描述不超过 5000 字",
                      },
                    })}
                  />
                )}
              </FormField>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-medium text-neutral-900">
                    SKU 列表（本地待提交）
                  </h3>
                  <p className="mt-1 text-xs text-neutral-500">
                    提审需至少 1 个启用中的 SKU；草稿允许缺 SKU。
                    {specAxes.length > 0
                      ? `每个 SKU 需为规格 [${specAxes.join(", ")}] 填值。`
                      : "当前为单规格商品。"}
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setSkuModalOpen(true)}
                >
                  ＋ 添加 SKU
                </Button>
              </div>

              {skus.length === 0 ? (
                <div className="rounded border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-400">
                  暂未添加 SKU
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
                    <tr>
                      <th className="px-3 py-2">编码</th>
                      <th className="px-3 py-2">规格</th>
                      <th className="px-3 py-2">价格（元）</th>
                      <th className="px-3 py-2">库存</th>
                      <th className="px-3 py-2">状态</th>
                      <th className="px-3 py-2 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {skus.map((s) => (
                      <tr key={s._uid}>
                        <td className="px-3 py-2 font-mono text-xs">
                          {s.sku_code}
                        </td>
                        <td className="px-3 py-2 text-xs text-neutral-600">
                          {Object.entries(s.specs)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(" / ") || "—"}
                        </td>
                        <td className="px-3 py-2">
                          ¥{centsToYuanString(s.price_cents)}
                        </td>
                        <td className="px-3 py-2">{s.stock}</td>
                        <td className="px-3 py-2">
                          <span
                            className={cn(
                              "rounded px-2 py-0.5 text-xs",
                              s.is_active !== false
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-neutral-100 text-neutral-500",
                            )}
                          >
                            {s.is_active !== false ? "启用" : "禁用"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            className="text-xs text-red-600 hover:underline"
                            onClick={() => removeSku(s._uid)}
                          >
                            移除
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : null}
        </section>

        {/* Step controls + submit */}
        <div className="flex items-center justify-between">
          <div>
            {step > 1 ? (
              <Button variant="secondary" onClick={goPrev} disabled={submitting}>
                上一步
              </Button>
            ) : null}
          </div>
          <div className="flex gap-2">
            {step < 3 ? (
              <Button variant="primary" onClick={goNext}>
                下一步
              </Button>
            ) : (
              <>
                <Button
                  variant="secondary"
                  onClick={() => submit(false)}
                  loading={submitting && !saveMutation.variables?.toReview}
                  disabled={submitting}
                >
                  保存草稿
                </Button>
                <Button
                  variant="primary"
                  onClick={() => submit(true)}
                  loading={submitting && saveMutation.variables?.toReview}
                  disabled={submitting}
                >
                  提交审核
                </Button>
              </>
            )}
          </div>
        </div>

        <SKUFormModal
          open={skuModalOpen}
          onClose={() => setSkuModalOpen(false)}
          specAxes={specAxes}
          editing={null}
          existingCodes={skus.map((s) => s.sku_code)}
          onSubmit={addSku}
        />
      </div>
    </FormProvider>
  );
}
