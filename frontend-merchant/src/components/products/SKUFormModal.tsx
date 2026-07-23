"use client";

/**
 * SKU 编辑弹窗。
 *
 * 复用于：
 *   - 新建向导第 3 步（本地态，不落库；提交时一起 POST）
 *   - 详情页 SKU 管理 tab（直接调 create/update API）
 *
 * 契约（§8.2）：
 *   - specs 键必须 ⊂ spu.spec_axes
 *   - sku_code 与 specs 一旦创建不可改
 */

import { useEffect, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";

import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { PriceInput } from "@/components/ui/PriceInput";
import type { CreateSKUIn, SKUOut, UpdateSKUIn } from "@/types/api";

export interface SKUFormValues {
  sku_code: string;
  /** 与 spec_axes 一一对应，值必填 */
  specs: Record<string, string>;
  price_cents: number | null;
  original_price_cents: number | null;
  stock: number;
  image: string | null;
  is_active: boolean;
}

/** 输出内容：调用方按 create/update 分别序列化 */
export type SKUFormOutput =
  | { mode: "create"; payload: CreateSKUIn }
  | { mode: "update"; payload: UpdateSKUIn };

export interface SKUFormModalProps {
  open: boolean;
  onClose: () => void;
  /** SPU 的 spec_axes；用来生成 specs 输入项 */
  specAxes: string[];
  /** null → 新增；否则编辑 */
  editing: SKUOut | null;
  /** 已有 SKU 列表，用来校验 sku_code 唯一（不含 editing 自身） */
  existingCodes: string[];
  saving?: boolean;
  onSubmit: (out: SKUFormOutput) => void;
}

function makeDefault(
  specAxes: string[],
  editing: SKUOut | null,
): SKUFormValues {
  const specs: Record<string, string> = {};
  for (const axis of specAxes) {
    specs[axis] = editing?.specs[axis] ?? "";
  }
  return {
    sku_code: editing?.sku_code ?? "",
    specs,
    price_cents: editing?.price_cents ?? null,
    original_price_cents: editing?.original_price_cents ?? null,
    stock: editing?.stock ?? 0,
    image: editing?.image ?? null,
    is_active: editing?.is_active ?? true,
  };
}

export function SKUFormModal({
  open,
  onClose,
  specAxes,
  editing,
  existingCodes,
  saving = false,
  onSubmit,
}: SKUFormModalProps) {
  const isEdit = !!editing;
  const defaults = useMemo(
    () => makeDefault(specAxes, editing),
    [specAxes, editing],
  );

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SKUFormValues>({ defaultValues: defaults });

  useEffect(() => {
    if (open) reset(defaults);
  }, [open, defaults, reset]);

  const submit = handleSubmit((values) => {
    // 校验 specs 全部填写（键必须 = spec_axes）
    for (const axis of specAxes) {
      if (!values.specs?.[axis]?.trim()) {
        return;
      }
    }
    if (!values.price_cents || values.price_cents <= 0) return;
    if (values.stock < 0) return;

    // 划线价 > 现价
    if (
      values.original_price_cents !== null &&
      values.original_price_cents <= (values.price_cents ?? 0)
    ) {
      setValue("original_price_cents", null);
    }

    if (isEdit) {
      const payload: UpdateSKUIn = {
        price_cents: values.price_cents!,
        original_price_cents: values.original_price_cents ?? null,
        stock: values.stock,
        image: values.image,
        is_active: values.is_active,
      };
      onSubmit({ mode: "update", payload });
    } else {
      const payload: CreateSKUIn = {
        sku_code: values.sku_code.trim(),
        specs: values.specs,
        price_cents: values.price_cents!,
        original_price_cents: values.original_price_cents ?? null,
        stock: values.stock,
        image: values.image,
        is_active: values.is_active,
      };
      onSubmit({ mode: "create", payload });
    }
  });

  // 校验函数
  const validateCode = (v: string) => {
    const trimmed = v.trim();
    if (!trimmed) return "请填写 SKU 编码";
    if (!/^[A-Za-z0-9_-]{1,60}$/u.test(trimmed))
      return "SKU 编码仅允许字母/数字/-/_，最多 60 字符";
    if (existingCodes.includes(trimmed))
      return "该编码在本商品下已存在";
    return true;
  };

  const specs = watch("specs");
  const specsIncomplete = specAxes.some((k) => !specs?.[k]?.trim());

  return (
    <Modal
      open={open}
      onClose={() => {
        if (saving) return;
        onClose();
      }}
      title={isEdit ? "编辑 SKU" : "新增 SKU"}
      widthClass="max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            取消
          </Button>
          <Button variant="primary" onClick={submit} loading={saving}>
            {isEdit ? "保存" : "添加"}
          </Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={submit} noValidate>
        <FormField
          label="SKU 编码"
          required
          hint={
            isEdit
              ? "SKU 编码创建后不可修改"
              : "商家自定义，例如 RED-L；创建后不可修改"
          }
          error={errors.sku_code?.message}
        >
          {(id) => (
            <Input
              id={id}
              disabled={isEdit}
              readOnly={isEdit}
              invalid={!!errors.sku_code}
              placeholder="如 RED-L"
              {...register("sku_code", { validate: validateCode })}
            />
          )}
        </FormField>

        {specAxes.length > 0 ? (
          <FormField
            label="规格值"
            required
            hint="每个规格轴都必须填值；创建后不可修改"
          >
            {() => (
              <div className="grid grid-cols-2 gap-3">
                {specAxes.map((axis) => (
                  <div key={axis}>
                    <label className="mb-1 block text-xs text-neutral-600">
                      {axis}
                    </label>
                    <Input
                      disabled={isEdit}
                      readOnly={isEdit}
                      placeholder={`如 ${axis === "color" ? "红" : "L"}`}
                      {...register(`specs.${axis}` as const, {
                        required: true,
                      })}
                    />
                  </div>
                ))}
              </div>
            )}
          </FormField>
        ) : (
          <div className="rounded border border-neutral-200 bg-neutral-50 p-2 text-xs text-neutral-500">
            此商品为单规格（未定义 spec_axes），无需填写规格值。
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <FormField label="现价（元）" required>
            {() => (
              <Controller
                control={control}
                name="price_cents"
                rules={{ validate: (v) => (v && v > 0 ? true : "价格必须 > 0") }}
                render={({ field, fieldState }) => (
                  <PriceInput
                    valueCents={field.value}
                    onChangeCents={field.onChange}
                    invalid={!!fieldState.error}
                  />
                )}
              />
            )}
          </FormField>
          <FormField label="划线价（元）" hint="可选，需 > 现价">
            {() => (
              <Controller
                control={control}
                name="original_price_cents"
                render={({ field }) => (
                  <PriceInput
                    valueCents={field.value}
                    onChangeCents={field.onChange}
                  />
                )}
              />
            )}
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="初始库存"
            required
            error={errors.stock?.message}
            hint={isEdit ? "如需调整库存请到「库存」tab；此处直接修改不写日志" : "创建后可到库存 tab 调整"}
          >
            {(id) => (
              <Input
                id={id}
                type="number"
                min={0}
                {...register("stock", {
                  valueAsNumber: true,
                  min: { value: 0, message: "库存不能为负" },
                })}
              />
            )}
          </FormField>
          <FormField label="是否启用" hint="禁用后该 SKU 不对外展示">
            {() => (
              <Controller
                control={control}
                name="is_active"
                render={({ field }) => (
                  <label className="mt-2 inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                      className="h-4 w-4 accent-[var(--color-primary)]"
                    />
                    <span>{field.value ? "启用中" : "已禁用"}</span>
                  </label>
                )}
              />
            )}
          </FormField>
        </div>

        <FormField label="SKU 图" hint="可选，为空使用 SPU 主图">
          {() => (
            <Controller
              control={control}
              name="image"
              render={({ field }) => (
                <ImageUpload
                  value={field.value}
                  onChange={field.onChange}
                  purpose="spu_gallery"
                />
              )}
            />
          )}
        </FormField>

        {specsIncomplete ? (
          <p className="text-xs text-red-600">请补齐所有规格值再提交</p>
        ) : null}
      </form>
    </Modal>
  );
}
