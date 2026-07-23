"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { RequireAuth } from "@/components/auth/RequireAuth";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Button } from "@/components/ui/Button";
import { Price, formatYuan } from "@/components/ui/Price";
import { ImageWithFallback } from "@/components/ui/ImageWithFallback";
import { EmptyState } from "@/components/ui/EmptyState";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { useCart, useInvalidateCart } from "@/hooks/useCart";
import {
  batchDeleteCartItems,
  clearInvalidCartItems,
  deleteCartItem,
  selectAllCartItems,
  updateCartItem,
} from "@/lib/cart-api";
import { ApiError } from "@/lib/api";
import { messageForCode } from "@/types/errors";
import type { CartItem, CartShopGroup } from "@/types/order";

export default function CartPage() {
  return (
    <RequireAuth>
      <div className="min-h-screen bg-neutral-50">
        <SiteHeader />
        <CartContent />
      </div>
    </RequireAuth>
  );
}

function CartContent() {
  const { data, isLoading, isError, refetch } = useCart();
  const invalidate = useInvalidateCart();
  const router = useRouter();

  const [clearInvalidOpen, setClearInvalidOpen] = useState(false);
  const [clearingInvalid, setClearingInvalid] = useState(false);
  const [busyItemId, setBusyItemId] = useState<number | null>(null);

  const groups = useMemo(() => data?.groups ?? [], [data?.groups]);
  const validItems = useMemo(
    () => groups.flatMap((g) => g.items).filter((it) => it.status === "valid"),
    [groups],
  );
  const selectedItems = useMemo(
    () => validItems.filter((it) => it.selected),
    [validItems],
  );
  const allSelected =
    validItems.length > 0 && validItems.every((it) => it.selected);
  const someSelected = selectedItems.length > 0;
  const totalSelectedCents = data?.total_cents_selected ?? 0;
  const totalSelectedCount = data?.total_selected_count ?? 0;
  const invalidCount = data?.invalid_count ?? 0;

  const toggleAll = async (next: boolean) => {
    try {
      await selectAllCartItems(next);
      invalidate();
    } catch (e) {
      const msg =
        e instanceof ApiError ? messageForCode(e.code, e.message) : "操作失败";
      toast.error(msg);
    }
  };

  const toggleItem = async (item: CartItem) => {
    if (item.status !== "valid") return;
    setBusyItemId(item.id);
    try {
      await updateCartItem(item.id, { selected: !item.selected });
      invalidate();
    } catch (e) {
      const msg =
        e instanceof ApiError ? messageForCode(e.code, e.message) : "操作失败";
      toast.error(msg);
    } finally {
      setBusyItemId(null);
    }
  };

  const changeQty = async (item: CartItem, quantity: number) => {
    setBusyItemId(item.id);
    try {
      await updateCartItem(item.id, { quantity });
      invalidate();
    } catch (e) {
      const msg =
        e instanceof ApiError ? messageForCode(e.code, e.message) : "更新失败";
      toast.error(msg);
    } finally {
      setBusyItemId(null);
    }
  };

  const toggleGroup = async (group: CartShopGroup, next: boolean) => {
    const idsToChange = group.items
      .filter((it) => it.status === "valid" && it.selected !== next)
      .map((it) => it.id);
    if (idsToChange.length === 0) return;
    try {
      await Promise.all(
        idsToChange.map((id) => updateCartItem(id, { selected: next })),
      );
      invalidate();
    } catch (e) {
      const msg =
        e instanceof ApiError ? messageForCode(e.code, e.message) : "操作失败";
      toast.error(msg);
    }
  };

  const removeItem = async (item: CartItem) => {
    setBusyItemId(item.id);
    try {
      await deleteCartItem(item.id);
      invalidate();
      toast.success("已从购物车移除");
    } catch (e) {
      const msg =
        e instanceof ApiError ? messageForCode(e.code, e.message) : "删除失败";
      toast.error(msg);
    } finally {
      setBusyItemId(null);
    }
  };

  const removeSelected = async () => {
    if (selectedItems.length === 0) return;
    try {
      await batchDeleteCartItems(selectedItems.map((it) => it.id));
      invalidate();
      toast.success(`已删除 ${selectedItems.length} 件商品`);
    } catch (e) {
      const msg =
        e instanceof ApiError ? messageForCode(e.code, e.message) : "删除失败";
      toast.error(msg);
    }
  };

  const handleClearInvalid = async () => {
    setClearingInvalid(true);
    try {
      await clearInvalidCartItems();
      invalidate();
      toast.success("失效商品已清空");
      setClearInvalidOpen(false);
    } catch (e) {
      const msg =
        e instanceof ApiError ? messageForCode(e.code, e.message) : "清空失败";
      toast.error(msg);
    } finally {
      setClearingInvalid(false);
    }
  };

  const goCheckout = () => {
    if (selectedItems.length === 0) {
      toast.info("请先选择要结算的商品");
      return;
    }
    const ids = selectedItems.map((it) => it.id).join(",");
    router.push(`/checkout?cart_item_ids=${ids}`);
  };

  return (
    <main className="mx-auto max-w-5xl px-6 py-6 pb-32">
      <h1 className="mb-4 text-2xl font-semibold text-neutral-900">购物车</h1>

      {isLoading && <CartSkeleton />}

      {isError && (
        <div className="rounded-md border border-[color:var(--color-primary-200)] bg-[color:var(--color-primary-50)] px-4 py-3 text-sm text-[color:var(--color-primary-700)]">
          加载失败，
          <button
            type="button"
            className="ml-1 underline"
            onClick={() => refetch()}
          >
            重试
          </button>
        </div>
      )}

      {data && groups.length === 0 && (
        <EmptyState
          title="购物车还是空的"
          description="快去逛逛，把心仪的商品加入购物车"
          action={
            <Button onClick={() => router.push("/")}>去逛逛</Button>
          }
        />
      )}

      {invalidCount > 0 && (
        <div className="mb-3 flex items-center justify-between rounded-md border border-neutral-200 bg-white px-4 py-2 text-xs">
          <span className="text-neutral-600">
            购物车中有 <b>{invalidCount}</b> 件失效商品（已下架 / 库存不足）
          </span>
          <button
            type="button"
            className="text-[color:var(--color-primary)] hover:underline"
            onClick={() => setClearInvalidOpen(true)}
          >
            一键清空失效
          </button>
        </div>
      )}

      {groups.length > 0 && (
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <ShopGroupCard
              key={group.shop.id}
              group={group}
              busyItemId={busyItemId}
              onToggleGroup={(next) => toggleGroup(group, next)}
              onToggleItem={toggleItem}
              onChangeQty={changeQty}
              onRemoveItem={removeItem}
            />
          ))}
        </div>
      )}

      {groups.length > 0 && (
        <StickyBar
          allSelected={allSelected}
          totalCount={totalSelectedCount}
          totalCents={totalSelectedCents}
          hasSelection={someSelected}
          onToggleAll={toggleAll}
          onRemoveSelected={removeSelected}
          onCheckout={goCheckout}
        />
      )}

      <ConfirmModal
        open={clearInvalidOpen}
        title="确认清空所有失效商品？"
        description="下架、库存不足的商品将从购物车移除，不可恢复。"
        confirmText="清空"
        danger
        loading={clearingInvalid}
        onConfirm={handleClearInvalid}
        onCancel={() => setClearInvalidOpen(false)}
      />
    </main>
  );
}

function ShopGroupCard({
  group,
  busyItemId,
  onToggleGroup,
  onToggleItem,
  onChangeQty,
  onRemoveItem,
}: {
  group: CartShopGroup;
  busyItemId: number | null;
  onToggleGroup: (next: boolean) => void;
  onToggleItem: (item: CartItem) => void;
  onChangeQty: (item: CartItem, qty: number) => void;
  onRemoveItem: (item: CartItem) => void;
}) {
  const validItems = group.items.filter((it) => it.status === "valid");
  const groupAllSelected =
    validItems.length > 0 && validItems.every((it) => it.selected);

  return (
    <section
      className="overflow-hidden rounded-lg border border-neutral-200 bg-white"
      data-testid={`shop-group-${group.shop.id}`}
    >
      <header className="flex items-center gap-3 border-b border-neutral-100 bg-neutral-50 px-4 py-2.5">
        <input
          type="checkbox"
          checked={groupAllSelected}
          onChange={(e) => onToggleGroup(e.target.checked)}
          aria-label={`全选 ${group.shop.name} 的商品`}
          disabled={validItems.length === 0}
          data-testid={`group-select-${group.shop.id}`}
        />
        <span className="text-sm font-medium text-neutral-800">
          {group.shop.name}
        </span>
        <span className="text-xs text-neutral-400">
          {group.items.length} 件
        </span>
      </header>
      <ul className="divide-y divide-neutral-100">
        {group.items.map((item) => (
          <CartItemRow
            key={item.id}
            item={item}
            busy={busyItemId === item.id}
            onToggle={() => onToggleItem(item)}
            onChangeQty={(q) => onChangeQty(item, q)}
            onRemove={() => onRemoveItem(item)}
          />
        ))}
      </ul>
    </section>
  );
}

function CartItemRow({
  item,
  busy,
  onToggle,
  onChangeQty,
  onRemove,
}: {
  item: CartItem;
  busy: boolean;
  onToggle: () => void;
  onChangeQty: (qty: number) => void;
  onRemove: () => void;
}) {
  const invalid = item.status !== "valid";
  const subtotal = item.sku.price_cents * item.quantity;
  const specText = Object.values(item.sku.specs ?? {}).join(" / ");

  return (
    <li
      className={cn(
        "flex items-start gap-3 px-4 py-4",
        invalid && "bg-neutral-50 opacity-70",
      )}
      data-testid={`cart-item-${item.id}`}
      data-invalid={invalid ? "true" : "false"}
    >
      <input
        type="checkbox"
        checked={item.selected && !invalid}
        onChange={onToggle}
        disabled={invalid || busy}
        aria-label="选择该商品"
        className="mt-4"
      />
      <Link
        href={`/products/${item.spu.id}`}
        className="h-20 w-20 shrink-0 overflow-hidden rounded border border-neutral-200 bg-neutral-50"
      >
        <ImageWithFallback
          objectKey={item.sku.image ?? item.spu.main_image}
          alt={item.spu.title}
          className="h-full w-full"
        />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Link
          href={`/products/${item.spu.id}`}
          className={cn(
            "line-clamp-2 text-sm text-neutral-900 hover:text-[color:var(--color-primary)]",
            invalid && "text-neutral-500",
          )}
        >
          {item.spu.title}
        </Link>
        {specText && (
          <span className="text-xs text-neutral-500">{specText}</span>
        )}
        {invalid && (
          <span className="inline-flex w-fit items-center rounded bg-neutral-200 px-2 py-0.5 text-xs text-neutral-700">
            {formatInvalidReason(item.invalid_reason)}
          </span>
        )}
        <div className="mt-1 text-sm">
          <Price cents={item.sku.price_cents} size="sm" />
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        <QuantityStepper
          value={item.quantity}
          onChange={onChangeQty}
          disabled={invalid || busy}
          max={Math.min(999, invalid ? item.quantity : item.sku.stock || 999)}
          size="sm"
        />
        <span className="text-sm font-semibold text-neutral-900 tabular-nums">
          {formatYuan(subtotal)}
        </span>
        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          className="text-xs text-neutral-500 hover:text-[color:var(--color-primary)]"
        >
          {invalid ? "移除" : "删除"}
        </button>
      </div>
    </li>
  );
}

function formatInvalidReason(reason: string | null): string {
  switch (reason) {
    case "spu_removed":
    case "sku_removed":
      return "已下架";
    case "spu_not_approved":
      return "审核中";
    case "sku_inactive":
      return "已停售";
    case "out_of_stock":
      return "库存不足";
    default:
      return "已失效";
  }
}

function StickyBar({
  allSelected,
  totalCount,
  totalCents,
  hasSelection,
  onToggleAll,
  onRemoveSelected,
  onCheckout,
}: {
  allSelected: boolean;
  totalCount: number;
  totalCents: number;
  hasSelection: boolean;
  onToggleAll: (next: boolean) => void;
  onRemoveSelected: () => void;
  onCheckout: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-neutral-200 bg-white shadow-[0_-4px_14px_rgba(0,0,0,0.06)]">
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-4 px-6">
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(e) => onToggleAll(e.target.checked)}
            data-testid="select-all"
          />
          全选
        </label>
        <button
          type="button"
          onClick={onRemoveSelected}
          disabled={!hasSelection}
          className="text-sm text-neutral-500 hover:text-[color:var(--color-primary)] disabled:opacity-40"
        >
          删除所选
        </button>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-neutral-600">
            已选 <b className="text-neutral-900">{totalCount}</b> 件
          </span>
          <span className="text-sm text-neutral-600">
            合计 <Price cents={totalCents} highlight />
          </span>
          <Button
            variant="primary"
            size="lg"
            disabled={!hasSelection}
            onClick={onCheckout}
            data-testid="checkout-btn"
          >
            结算
          </Button>
        </div>
      </div>
    </div>
  );
}

function CartSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
