"use client";

/**
 * SPU 基本信息表单（step 1 + edit 基本信息 tab 共用）。
 *
 * 字段：title / subtitle / category_id / brand_id / main_image / spec_axes
 * spec_axes 使用 chips + 输入框，支持添加 / 删除。
 */

import { useState, type KeyboardEvent } from "react";
import { Controller, useFormContext } from "react-hook-form";

import { BrandPicker } from "@/components/ui/BrandPicker";
import { CategoryPicker } from "@/components/ui/CategoryPicker";
import { FormField } from "@/components/ui/FormField";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { Input } from "@/components/ui/Input";
import { useBrands, useCategoryTree } from "@/hooks/useCatalog";
import { cn } from "@/lib/cn";

export interface SPUBasicFormValues {
  title: string;
  subtitle: string;
  category_id: number | null;
  brand_id: number | null;
  main_image: string;
  spec_axes: string[];
}

export interface SPUBasicInfoFormProps {
  disabled?: boolean;
  /** 关键字段修改警告横幅（editing approved 时使用） */
  showApprovedWarning?: boolean;
}

/**
 * 与 react-hook-form 集成的基本信息表单块。
 * 必须在 FormProvider<SPUBasicFormValues> 内使用。
 */
export function SPUBasicInfoForm({
  disabled,
  showApprovedWarning,
}: SPUBasicInfoFormProps) {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<SPUBasicFormValues>();

  const categoryQuery = useCategoryTree();
  const brandsQuery = useBrands();

  return (
    <div className="space-y-4">
      {showApprovedWarning ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          注意：修改标题、类目、主图、规格轴等关键字段将<strong>重新进入审核</strong>；
          仅修改副标题 / 详情图 / 描述 / SKU 价格库存等非关键字段会立即生效。
        </div>
      ) : null}

      <FormField
        label="商品标题"
        required
        error={errors.title?.message}
        hint="展示给消费者的主标题，建议 5-30 字"
      >
        {(id) => (
          <Input
            id={id}
            disabled={disabled}
            invalid={!!errors.title}
            placeholder="如 iPhone 20 Pro 钛金属版"
            {...register("title", {
              required: "请输入商品标题",
              maxLength: { value: 200, message: "标题不超过 200 字" },
            })}
          />
        )}
      </FormField>

      <FormField
        label="副标题 / 促销语"
        hint="可选，展示在标题下方"
        error={errors.subtitle?.message}
      >
        {(id) => (
          <Input
            id={id}
            disabled={disabled}
            invalid={!!errors.subtitle}
            placeholder="如 12 期免息 / 顺丰包邮"
            {...register("subtitle", {
              maxLength: { value: 200, message: "副标题不超过 200 字" },
            })}
          />
        )}
      </FormField>

      <FormField
        label="商品类目"
        required
        hint="选择三级叶子类目（如 数码 → 手机通讯 → 手机）"
        error={errors.category_id?.message}
      >
        {() => (
          <Controller
            control={control}
            name="category_id"
            rules={{
              validate: (v) => (v ? true : "请选择三级类目"),
            }}
            render={({ field }) => (
              <CategoryPicker
                tree={categoryQuery.data ?? []}
                value={field.value}
                onChange={field.onChange}
                disabled={disabled || categoryQuery.isLoading}
                invalid={!!errors.category_id}
              />
            )}
          />
        )}
      </FormField>

      <FormField
        label="品牌"
        hint="可选，若商品无明确品牌可留空"
      >
        {() => (
          <Controller
            control={control}
            name="brand_id"
            render={({ field }) => (
              <BrandPicker
                brands={brandsQuery.data?.items ?? []}
                value={field.value}
                onChange={field.onChange}
                disabled={disabled || brandsQuery.isLoading}
              />
            )}
          />
        )}
      </FormField>

      <FormField
        label="主图"
        required
        hint="推荐 800×800 白底方图；后续用户列表页显示这张图"
        error={errors.main_image?.message}
      >
        {() => (
          <Controller
            control={control}
            name="main_image"
            rules={{
              validate: (v) => (v && v.length > 0 ? true : "请上传主图"),
            }}
            render={({ field }) => (
              <ImageUpload
                value={field.value || null}
                onChange={(k) => field.onChange(k ?? "")}
                purpose="spu_main"
                disabled={disabled}
                invalid={!!errors.main_image}
                sizeClass="h-32 w-32"
              />
            )}
          />
        )}
      </FormField>

      <FormField
        label="规格轴（spec_axes）"
        hint='SKU 的差异维度，如 "color" / "size"；空表示单规格商品'
      >
        {() => (
          <Controller
            control={control}
            name="spec_axes"
            render={({ field }) => (
              <SpecAxesEditor
                value={field.value ?? []}
                onChange={field.onChange}
                disabled={disabled}
              />
            )}
          />
        )}
      </FormField>
    </div>
  );
}

// ---------- spec_axes 编辑器 ----------

/** 规格轴 key 校验：小写英文 + 数字 + 下划线，1-20 字符。 */
export function isValidAxisKey(k: string): boolean {
  return /^[a-z][a-z0-9_]{0,19}$/u.test(k);
}

function SpecAxesEditor({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const add = () => {
    const k = text.trim();
    if (!k) return;
    if (!isValidAxisKey(k)) {
      setErr("请使用英文小写字母开头，仅含 [a-z0-9_]，最多 20 字符");
      return;
    }
    if (value.includes(k)) {
      setErr("该规格轴已存在");
      return;
    }
    if (value.length >= 3) {
      setErr("最多 3 个规格轴");
      return;
    }
    setErr(null);
    onChange([...value, k]);
    setText("");
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add();
    }
  };

  const removeAt = (idx: number) => {
    if (disabled) return;
    const next = value.slice();
    next.splice(idx, 1);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {value.map((axis, idx) => (
          <span
            key={axis}
            className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-[var(--color-primary)]"
          >
            {axis}
            {!disabled ? (
              <button
                type="button"
                aria-label={`移除 ${axis}`}
                onClick={() => removeAt(idx)}
                className="rounded-full text-blue-400 hover:text-blue-700"
              >
                ×
              </button>
            ) : null}
          </span>
        ))}
        {!disabled ? (
          <div className="flex items-center gap-1">
            <Input
              placeholder="添加，如 color"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setErr(null);
              }}
              onKeyDown={onKey}
              className="h-8 w-32"
            />
            <button
              type="button"
              onClick={add}
              className="rounded border border-neutral-300 px-2 py-0.5 text-xs text-neutral-600 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
            >
              添加
            </button>
          </div>
        ) : null}
      </div>
      {err ? (
        <p className={cn("text-xs text-red-600")}>{err}</p>
      ) : (
        <p className="text-xs text-neutral-500">
          添加后新建 SKU 时需为每个规格填值；单规格商品可留空。
        </p>
      )}
    </div>
  );
}
