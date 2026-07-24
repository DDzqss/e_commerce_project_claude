"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { RequireAuth } from "@/components/auth/RequireAuth";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Price, formatYuan } from "@/components/ui/Price";
import { ImageWithFallback } from "@/components/ui/ImageWithFallback";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { useAddresses } from "@/hooks/useAddresses";
import { useInvalidateCart } from "@/hooks/useCart";
import { previewOrder, createOrder } from "@/lib/order-api";
import {
  clearIdempotencyKey,
  getOrCreateIdempotencyKey,
} from "@/lib/idempotency";
import { ApiError } from "@/lib/api";
import { ErrorCode, messageForCode } from "@/types/errors";
import type {
  PreviewOrderGroup,
  PreviewOut,
  UserAddress,
} from "@/types/order";

const IDEMPOTENCY_SCOPE = "checkout";

export default function CheckoutPage() {
  return (
    <RequireAuth>
      <div className="min-h-screen bg-neutral-50">
        <SiteHeader />
        <Suspense
          fallback={
            <main className="mx-auto max-w-4xl px-6 py-6">
              <Skeleton className="h-40 w-full" />
            </main>
          }
        >
          <CheckoutContent />
        </Suspense>
      </div>
    </RequireAuth>
  );
}

function parseCartItemIds(raw: string | null): number[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const invalidateCart = useInvalidateCart();

  const cartItemIds = useMemo(
    () => parseCartItemIds(searchParams.get("cart_item_ids")),
    [searchParams],
  );

  const {
    data: addresses,
    isLoading: addressesLoading,
    isError: addressesError,
    refetch: refetchAddresses,
  } = useAddresses();

  const defaultAddress = useMemo(
    () =>
      addresses?.find((a) => a.is_default) ?? addresses?.[0] ?? null,
    [addresses],
  );
  const [addressId, setAddressId] = useState<number | null>(null);
  const [showAddressPicker, setShowAddressPicker] = useState(false);
  const [userNote, setUserNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 默认选中默认地址
  useEffect(() => {
    if (addressId === null && defaultAddress) {
      setAddressId(defaultAddress.id);
    }
  }, [defaultAddress, addressId]);

  const selectedAddress = useMemo(
    () => addresses?.find((a) => a.id === addressId) ?? null,
    [addresses, addressId],
  );

  const previewEnabled =
    cartItemIds.length > 0 && addressId !== null;

  const {
    data: preview,
    isLoading: previewLoading,
    isError: previewError,
    error: previewErrorObj,
    refetch: refetchPreview,
  } = useQuery<PreviewOut>({
    queryKey: ["orders", "preview", cartItemIds, addressId],
    queryFn: () =>
      previewOrder({
        cart_item_ids: cartItemIds,
        address_id: addressId as number,
      }),
    enabled: previewEnabled,
    staleTime: 5_000,
    retry: false,
  });

  const hasBlockingWarnings = useMemo(() => {
    if (!preview?.warnings) return false;
    return preview.warnings.some(
      (w) => w.type === "invalid_sku" || w.type === "stock_short",
    );
  }, [preview]);

  const submitOrder = async () => {
    if (!addressId) {
      toast.error("请选择收货地址");
      return;
    }
    if (cartItemIds.length === 0) {
      toast.error("没有可结算的商品");
      return;
    }
    if (hasBlockingWarnings) {
      toast.error("存在失效商品或库存不足，请返回购物车修改后再提交");
      return;
    }
    setSubmitting(true);
    // 同一 checkout 会话复用同一 idempotency key
    const idem = getOrCreateIdempotencyKey(IDEMPOTENCY_SCOPE);
    try {
      const res = await createOrder(
        {
          cart_item_ids: cartItemIds,
          address_id: addressId,
          user_note: userNote.trim() || undefined,
        },
        idem,
      );
      // 成功后清除 key，避免下次沿用
      clearIdempotencyKey(IDEMPOTENCY_SCOPE);
      invalidateCart();
      const orders = res.orders ?? [];
      if (orders.length === 0) {
        toast.error("下单成功，但未返回订单信息");
        router.push("/orders");
        return;
      }
      toast.success(`已创建 ${orders.length} 个订单，请尽快支付`);
      // 单一订单：直接跳支付选择页；多订单：跳订单列表让用户逐个付
      if (orders.length === 1) {
        router.push(`/orders/${orders[0]!.order_no}/pay`);
      } else {
        router.push(`/orders?status=pending_payment`);
      }
    } catch (e) {
      if (e instanceof ApiError) {
        // 幂等冲突：说明订单其实已创建，跳订单列表
        if (e.code === ErrorCode.OrderIdempotencyConflict) {
          clearIdempotencyKey(IDEMPOTENCY_SCOPE);
          toast.info("订单已提交，请前往订单列表查看");
          router.push("/orders");
          return;
        }
        toast.error(messageForCode(e.code, e.message));
      } else {
        toast.error("提交订单失败，请重试");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (cartItemIds.length === 0) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-6">
        <EmptyState
          title="没有可结算的商品"
          description="请返回购物车选择要结算的商品"
          action={
            <Button onClick={() => router.push("/cart")}>返回购物车</Button>
          }
        />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-6 pb-32">
      <h1 className="mb-4 text-2xl font-semibold text-neutral-900">
        提交订单
      </h1>

      {/* 地址卡片 */}
      <section
        className="mb-4 rounded-lg border border-neutral-200 bg-white p-4"
        data-testid="checkout-address-section"
      >
        <h2 className="mb-3 text-sm font-medium text-neutral-700">收货地址</h2>
        {addressesLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : addressesError ? (
          <div className="flex items-center gap-2 text-sm text-[color:var(--color-primary)]">
            加载地址失败
            <button
              type="button"
              className="underline"
              onClick={() => refetchAddresses()}
            >
              重试
            </button>
          </div>
        ) : !addresses || addresses.length === 0 ? (
          <EmptyState
            title="还没有收货地址"
            description="请先添加收货地址后再结算"
            action={
              <Link href="/account/addresses">
                <Button>去添加</Button>
              </Link>
            }
          />
        ) : (
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              {selectedAddress ? (
                <AddressLine addr={selectedAddress} />
              ) : (
                <p className="text-sm text-neutral-500">请选择收货地址</p>
              )}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowAddressPicker(true)}
            >
              {selectedAddress ? "更换" : "选择"}
            </Button>
          </div>
        )}
      </section>

      {/* 商品分组 */}
      <section className="mb-4">
        {previewLoading && <Skeleton className="h-48 w-full" />}
        {previewError && (
          <div className="rounded-md border border-[color:var(--color-primary-200)] bg-[color:var(--color-primary-50)] px-4 py-3 text-sm text-[color:var(--color-primary-700)]">
            结算预览失败
            {previewErrorObj instanceof ApiError
              ? `：${messageForCode(previewErrorObj.code, previewErrorObj.message)}`
              : ""}
            <button
              type="button"
              className="ml-2 underline"
              onClick={() => refetchPreview()}
            >
              重试
            </button>
          </div>
        )}
        {preview && (
          <div className="flex flex-col gap-3">
            {preview.warnings.length > 0 && (
              <div
                role="alert"
                data-testid="checkout-warnings"
                className="rounded-md border border-yellow-300 bg-yellow-50 px-4 py-2 text-sm text-yellow-800"
              >
                <p className="font-medium">下单前请注意：</p>
                <ul className="mt-1 list-disc pl-5">
                  {preview.warnings.map((w, i) => (
                    <li key={i}>{w.message}</li>
                  ))}
                </ul>
                {hasBlockingWarnings && (
                  <p className="mt-2 text-xs">
                    存在失效或缺货商品，需返回购物车修改后再提交。
                  </p>
                )}
              </div>
            )}
            {preview.groups_by_shop.map((group) => (
              <PreviewGroupCard key={group.shop.id} group={group} />
            ))}
          </div>
        )}
      </section>

      {/* 备注 */}
      <section className="mb-4 rounded-lg border border-neutral-200 bg-white p-4">
        <label
          htmlFor="user_note"
          className="mb-2 block text-sm font-medium text-neutral-700"
        >
          备注（可选）
        </label>
        <textarea
          id="user_note"
          rows={2}
          maxLength={200}
          value={userNote}
          onChange={(e) => setUserNote(e.target.value)}
          placeholder="比如：工作日送达、放门口即可等"
          className="block w-full resize-none rounded border border-neutral-300 p-2 text-sm text-neutral-900 focus:border-[color:var(--color-primary)] focus:outline-none"
        />
      </section>

      {/* 底部固定条 */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-neutral-200 bg-white shadow-[0_-4px_14px_rgba(0,0,0,0.06)]">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-end gap-4 px-6">
          <span className="text-sm text-neutral-600">
            合计{" "}
            <Price cents={preview?.grand_total_cents ?? 0} size="base" highlight />
          </span>
          <Button
            size="lg"
            loading={submitting}
            disabled={
              !preview || hasBlockingWarnings || addressId === null
            }
            onClick={submitOrder}
            data-testid="submit-order-btn"
          >
            提交订单
          </Button>
        </div>
      </div>

      {/* 地址选择 Modal */}
      {showAddressPicker && addresses && (
        <Modal
          open
          onClose={() => setShowAddressPicker(false)}
          title="选择收货地址"
        >
          <ul className="flex max-h-[60vh] flex-col gap-2 overflow-auto">
            {addresses.map((addr) => (
              <li key={addr.id}>
                <button
                  type="button"
                  onClick={() => {
                    setAddressId(addr.id);
                    setShowAddressPicker(false);
                  }}
                  className={cn(
                    "block w-full rounded border p-3 text-left transition",
                    addressId === addr.id
                      ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary-50)]"
                      : "border-neutral-200 hover:border-neutral-400",
                  )}
                >
                  <AddressLine addr={addr} />
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-between">
            <Link
              href="/account/addresses"
              className="text-sm text-neutral-500 hover:text-[color:var(--color-primary)]"
            >
              管理地址 →
            </Link>
            <Button
              variant="ghost"
              onClick={() => setShowAddressPicker(false)}
            >
              关闭
            </Button>
          </div>
        </Modal>
      )}
    </main>
  );
}

function AddressLine({ addr }: { addr: UserAddress }) {
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-semibold text-neutral-900">
          {addr.receiver_name}
        </span>
        <span className="text-sm text-neutral-600">{addr.receiver_phone}</span>
        {addr.is_default && (
          <span className="inline-flex items-center rounded bg-[color:var(--color-primary-50)] px-1.5 py-0.5 text-xs text-[color:var(--color-primary)]">
            默认
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-neutral-700">
        {addr.province}
        {addr.city}
        {addr.district} {addr.detail}
      </p>
    </div>
  );
}

function PreviewGroupCard({ group }: { group: PreviewOrderGroup }) {
  return (
    <section
      className="overflow-hidden rounded-lg border border-neutral-200 bg-white"
      data-testid={`preview-group-${group.shop.id}`}
    >
      <header className="border-b border-neutral-100 bg-neutral-50 px-4 py-2 text-sm font-medium text-neutral-800">
        {group.shop.name}
      </header>
      <ul className="divide-y divide-neutral-100">
        {group.items.map((it) => {
          const specText = Object.values(it.sku.specs ?? {}).join(" / ");
          return (
            <li key={it.id} className="flex items-start gap-3 px-4 py-3">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded border border-neutral-200 bg-neutral-50">
                <ImageWithFallback
                  objectKey={it.sku.image ?? it.spu.main_image}
                  alt={it.spu.title}
                  className="h-full w-full"
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="line-clamp-2 text-sm text-neutral-900">
                  {it.spu.title}
                </span>
                {specText && (
                  <span className="text-xs text-neutral-500">{specText}</span>
                )}
                <Price cents={it.sku.price_cents} size="sm" />
              </div>
              <div className="flex flex-col items-end gap-1 text-sm">
                <span className="text-neutral-500">×{it.quantity}</span>
                <span className="font-semibold text-neutral-900 tabular-nums">
                  {formatYuan(it.sku.price_cents * it.quantity)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      <footer className="flex items-center justify-end gap-6 border-t border-neutral-100 bg-neutral-50 px-4 py-2 text-xs text-neutral-600">
        <span>
          小计 <b>{formatYuan(group.subtotal_cents)}</b>
        </span>
        <span>运费 {formatYuan(group.shipping_fee_cents)}</span>
        <span>
          小计合计{" "}
          <b className="text-[color:var(--color-primary)]">
            {formatYuan(group.total_cents)}
          </b>
        </span>
      </footer>
    </section>
  );
}
