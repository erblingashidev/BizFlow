"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ArrowDownToLine, ArrowRightLeft, ArrowUpFromLine, ClipboardCheck, Loader2, PackagePlus } from "lucide-react";
import { toast } from "sonner";
import { NativeSelect } from "@/components/app/native-select";
import { FormField, FormMessage } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fieldErrorsFromZod } from "@/lib/actions";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { stockOperationSchema, type MovementKind } from "@/lib/validation/inventory";
import type { ProductOption } from "../products/actions";
import { getProductStockAction, recordStockOperationAction } from "./actions";
import { ProductPicker } from "./product-picker";

const KIND_ICONS = { in: ArrowDownToLine, out: ArrowUpFromLine, count: ClipboardCheck, transfer: ArrowRightLeft };

type Warehouse = { id: string; name: string; isDefault?: boolean };

export function StockOperationDialog({
  warehouses,
  kinds,
  product: presetProduct,
  defaultKind,
  triggerLabel,
  triggerVariant = "default",
  triggerSize = "default",
}: {
  warehouses: Warehouse[];
  kinds: MovementKind[];
  product?: ProductOption;
  defaultKind?: MovementKind;
  triggerLabel: string;
  triggerVariant?: "default" | "outline" | "secondary" | "ghost";
  triggerSize?: "default" | "sm";
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const fallbackWarehouse = warehouses.find((w) => w.isDefault)?.id ?? warehouses[0]?.id ?? "";

  const [kind, setKind] = useState<MovementKind>(defaultKind ?? kinds[0]);
  const [product, setProduct] = useState<ProductOption | null>(presetProduct ?? null);
  const [warehouseId, setWarehouseId] = useState(presetProduct?.defaultWarehouseId ?? fallbackWarehouse);
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [stock, setStock] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    if (!open || !product) {
      setStock(null);
      return;
    }
    let cancelled = false;
    getProductStockAction(product.id).then((result) => {
      if (!cancelled) setStock(result.ok ? (result.data ?? {}) : null);
    });
    return () => {
      cancelled = true;
    };
  }, [open, product]);

  const reset = () => {
    setKind(defaultKind ?? kinds[0]);
    setProduct(presetProduct ?? null);
    setWarehouseId(presetProduct?.defaultWarehouseId ?? fallbackWarehouse);
    setToWarehouseId("");
    setQuantity("");
    setUnitCost("");
    setNote("");
    setErrors({});
    setFormError(null);
  };

  const chooseProduct = (option: ProductOption | null) => {
    setProduct(option);
    if (option) {
      if (option.defaultWarehouseId && warehouses.some((w) => w.id === option.defaultWarehouseId)) {
        setWarehouseId(option.defaultWarehouseId);
      }
      if (!unitCost && option.purchasePrice > 0) setUnitCost(String(option.purchasePrice));
    }
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const input = {
      kind,
      productId: product?.id ?? "",
      warehouseId,
      toWarehouseId,
      quantity,
      unitCost,
      note,
    };
    const parsed = stockOperationSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(fieldErrorsFromZod(parsed.error));
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await recordStockOperationAction(parsed.data);
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        setFormError(result.error);
        return;
      }
      toast.success(t(result.message ?? "inventory.saved.in"));
      setOpen(false);
      reset();
      router.refresh();
    });
  };

  const current = stock && warehouseId ? (stock[warehouseId] ?? 0) : null;
  const unit = product ? t(`units.${product.unit}`) : "";
  const TriggerIcon = defaultKind ? KIND_ICONS[defaultKind] : PackagePlus;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger render={<Button variant={triggerVariant} size={triggerSize} />}>
        <TriggerIcon aria-hidden />
        {triggerLabel}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("inventory.recordMovement")}</DialogTitle>
          <DialogDescription>{t(`inventory.kindHint.${kind}`)}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <FormMessage tone="error" message={formError} />
          {kinds.length > 1 && (
            <div role="radiogroup" aria-label={t("inventory.movementType")} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {kinds.map((k) => {
                const Icon = KIND_ICONS[k];
                return (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={kind === k}
                    onClick={() => {
                      setKind(k);
                      setErrors({});
                    }}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg border p-2 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      kind === k ? "border-primary bg-accent text-accent-foreground" : "hover:bg-muted",
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                    {t(`inventory.kinds.${k}`)}
                  </button>
                );
              })}
            </div>
          )}

          <FormField label={t("inventory.product")} error={errors.productId}>
            {(f) =>
              presetProduct ? (
                <div className="flex h-8 items-center rounded-lg border bg-muted/40 px-2.5 text-sm">
                  <span className="font-medium">{presetProduct.name}</span>
                  <span className="text-muted-foreground">&nbsp;· {presetProduct.sku}</span>
                </div>
              ) : (
                <ProductPicker id={f.id} value={product} onChange={chooseProduct} invalid={f["aria-invalid"]} />
              )
            }
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label={kind === "transfer" ? t("inventory.fromWarehouse") : t("inventory.warehouse")}
              error={errors.warehouseId}
              hint={current !== null ? t("inventory.currentStock", { quantity: formatNumber(current, locale), unit }) : undefined}
            >
              {(f) => (
                <NativeSelect {...f} value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
            {kind === "transfer" ? (
              <FormField
                label={t("inventory.toWarehouse")}
                error={errors.toWarehouseId}
                hint={
                  stock && toWarehouseId
                    ? t("inventory.currentStock", { quantity: formatNumber(stock[toWarehouseId] ?? 0, locale), unit })
                    : undefined
                }
              >
                {(f) => (
                  <NativeSelect {...f} value={toWarehouseId} onChange={(e) => setToWarehouseId(e.target.value)}>
                    <option value="">{t("inventory.chooseWarehouse")}</option>
                    {warehouses
                      .filter((w) => w.id !== warehouseId)
                      .map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                  </NativeSelect>
                )}
              </FormField>
            ) : (
              <FormField
                label={kind === "count" ? t("inventory.countedQuantity") : t("inventory.quantity")}
                error={errors.quantity}
              >
                {(f) => <Input {...f} value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="decimal" autoComplete="off" />}
              </FormField>
            )}
          </div>

          {kind === "transfer" && (
            <FormField label={t("inventory.quantity")} error={errors.quantity}>
              {(f) => <Input {...f} value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="decimal" autoComplete="off" />}
            </FormField>
          )}
          {kind === "in" && (
            <FormField label={t("inventory.unitCost")} error={errors.unitCost} optional>
              {(f) => <Input {...f} value={unitCost} onChange={(e) => setUnitCost(e.target.value)} inputMode="decimal" autoComplete="off" />}
            </FormField>
          )}
          <FormField label={t("inventory.note")} error={errors.note} optional>
            {(f) => <Textarea {...f} value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} />}
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              {t(`inventory.submit.${kind}`)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
