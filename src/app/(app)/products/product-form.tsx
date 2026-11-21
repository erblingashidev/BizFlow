"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { NativeSelect } from "@/components/app/native-select";
import { FormField, FormMessage } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { applyActionErrors } from "@/lib/forms";
import { formatPercent } from "@/lib/format";
import { MAX_PRODUCT_IMAGE_BYTES } from "@/lib/images";
import { parseDecimal } from "@/lib/validation/common";
import { PRODUCT_UNITS, productSchema, VAT_RATES, type ProductData, type ProductInput } from "@/lib/validation/catalog";
import { removeProductImageAction, saveProductAction, uploadProductImageAction } from "./actions";

type Option = { id: string; name: string; depth?: number };

export function ProductForm({
  productId,
  defaults,
  categories,
  warehouses,
  imageUrl,
  canAdjustStock,
}: {
  productId: string | null;
  defaults: ProductInput;
  categories: Option[];
  warehouses: Option[];
  imageUrl: string | null;
  canAdjustStock: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(imageUrl);
  const [removeImage, setRemoveImage] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const form = useForm<ProductInput, unknown, ProductData>({ resolver: zodResolver(productSchema), defaultValues: defaults });
  const { errors } = form.formState;
  const productType = form.watch("productType");
  const trackInventory = form.watch("trackInventory");
  const purchase = parseDecimal(form.watch("purchasePrice"));
  const sale = parseDecimal(form.watch("salePrice"));
  const margin = purchase !== null && sale !== null && sale > 0 ? ((sale - purchase) / sale) * 100 : null;

  const pickFile = (picked: File | undefined) => {
    if (!picked) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(picked.type)) {
      toast.error(t("products.errors.imageType"));
      return;
    }
    if (picked.size > MAX_PRODUCT_IMAGE_BYTES) {
      toast.error(t("products.errors.imageTooLarge"));
      return;
    }
    setFile(picked);
    setRemoveImage(false);
    setPreview(URL.createObjectURL(picked));
  };

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await saveProductAction(productId, values);
      const error = applyActionErrors(result, form.setError);
      if (!result.ok || !result.data) {
        setFormError(error);
        return;
      }
      const id = result.data.id;
      if (result.data.warning) toast.warning(t(result.data.warning));

      if (file) {
        const fd = new FormData();
        fd.set("file", file);
        const upload = await uploadProductImageAction(id, fd);
        if (!upload.ok) toast.error(t.has(upload.error) ? t(upload.error) : t("errors.generic"));
      } else if (removeImage && productId) {
        await removeProductImageAction(productId);
      }

      toast.success(t(productId ? "products.updated" : "products.created"));
      router.push(`/products/${id}`);
      router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6 lg:grid-cols-3">
      <div className="grid gap-6 lg:col-span-2">
        <FormMessage tone="error" message={formError} />
        <Card>
          <CardHeader>
            <CardTitle>{t("products.sectionBasics")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField label={t("products.name")} error={errors.name?.message} className="sm:col-span-2">
              {(f) => <Input {...f} {...form.register("name")} autoComplete="off" />}
            </FormField>
            <FormField label={t("products.sku")} error={errors.sku?.message} hint={t("products.skuHint")}>
              {(f) => <Input {...f} {...form.register("sku")} autoComplete="off" className="uppercase" />}
            </FormField>
            <FormField label={t("products.barcode")} error={errors.barcode?.message} optional>
              {(f) => <Input {...f} {...form.register("barcode")} inputMode="numeric" autoComplete="off" />}
            </FormField>
            <FormField label={t("products.category")} error={errors.categoryId?.message} optional>
              {(f) => (
                <NativeSelect {...f} {...form.register("categoryId")}>
                  <option value="">{t("products.noCategory")}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.depth ? `— ${c.name}` : c.name}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
            <FormField label={t("products.type")} error={errors.productType?.message}>
              {(f) => (
                <NativeSelect
                  {...f}
                  {...form.register("productType", {
                    onChange: (e) => {
                      if (e.target.value === "service") form.setValue("trackInventory", false);
                    },
                  })}
                >
                  <option value="goods">{t("products.types.goods")}</option>
                  <option value="service">{t("products.types.service")}</option>
                </NativeSelect>
              )}
            </FormField>
            <FormField label={t("products.description")} error={errors.description?.message} optional className="sm:col-span-2">
              {(f) => <Textarea {...f} {...form.register("description")} rows={3} />}
            </FormField>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("products.sectionPricing")}</CardTitle>
            <CardDescription>{t("products.pricingHint")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <FormField label={t("products.purchasePrice")} error={errors.purchasePrice?.message}>
              {(f) => <Input {...f} {...form.register("purchasePrice")} inputMode="decimal" />}
            </FormField>
            <FormField
              label={t("products.salePrice")}
              error={errors.salePrice?.message}
              hint={margin !== null ? t("products.margin", { value: formatPercent(Math.round(margin * 10) / 10, locale) }) : undefined}
            >
              {(f) => <Input {...f} {...form.register("salePrice")} inputMode="decimal" />}
            </FormField>
            <FormField label={t("products.vatRate")} error={errors.vatRate?.message}>
              {(f) => (
                <NativeSelect {...f} {...form.register("vatRate")}>
                  {VAT_RATES.map((rate) => (
                    <option key={rate} value={rate}>
                      {formatPercent(rate, locale)}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("products.sectionInventory")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start justify-between gap-4 rounded-lg border p-3 sm:col-span-2">
              <div className="grid gap-0.5">
                <label htmlFor="track-inventory" className="text-sm font-medium">
                  {t("products.trackInventory")}
                </label>
                <p className="text-xs text-muted-foreground">{t("products.trackInventoryHint")}</p>
                {errors.trackInventory?.message && (
                  <p className="text-xs text-destructive">{t(errors.trackInventory.message)}</p>
                )}
              </div>
              <Controller
                control={form.control}
                name="trackInventory"
                render={({ field }) => (
                  <Switch
                    id="track-inventory"
                    checked={field.value}
                    disabled={productType === "service"}
                    onCheckedChange={(checked) => field.onChange(checked)}
                  />
                )}
              />
            </div>
            {trackInventory && (
              <>
                <FormField label={t("products.unit")} error={errors.unit?.message}>
                  {(f) => (
                    <NativeSelect {...f} {...form.register("unit")}>
                      {PRODUCT_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {t(`units.${u}`)}
                        </option>
                      ))}
                    </NativeSelect>
                  )}
                </FormField>
                <FormField label={t("products.minStock")} error={errors.minStock?.message} hint={t("products.minStockHint")}>
                  {(f) => <Input {...f} {...form.register("minStock")} inputMode="decimal" />}
                </FormField>
                <FormField
                  label={t("products.defaultWarehouse")}
                  error={errors.defaultWarehouseId?.message}
                  hint={t("products.defaultWarehouseHint")}
                  optional
                  className="sm:col-span-2"
                >
                  {(f) => (
                    <NativeSelect {...f} {...form.register("defaultWarehouseId")}>
                      <option value="">{t("products.noDefaultWarehouse")}</option>
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </NativeSelect>
                  )}
                </FormField>
                {!productId && canAdjustStock && (
                  <>
                    <FormField label={t("products.openingQuantity")} error={errors.openingQuantity?.message} optional>
                      {(f) => <Input {...f} {...form.register("openingQuantity")} inputMode="decimal" />}
                    </FormField>
                    <FormField label={t("products.openingWarehouse")} error={errors.openingWarehouseId?.message}>
                      {(f) => (
                        <NativeSelect {...f} {...form.register("openingWarehouseId")}>
                          {warehouses.map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.name}
                            </option>
                          ))}
                        </NativeSelect>
                      )}
                    </FormField>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid content-start gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("products.image")}</CardTitle>
            <CardDescription>{t("products.imageHint")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                pickFile(e.dataTransfer.files[0]);
              }}
              className="grid aspect-square w-full place-items-center overflow-hidden rounded-xl border border-dashed bg-muted/40 text-sm text-muted-foreground outline-none transition-colors hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {preview && !removeImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt={t("products.imagePreview")} className="size-full object-cover" />
              ) : (
                <span className="grid place-items-center gap-2">
                  <ImagePlus className="size-6" aria-hidden />
                  {t("products.chooseImage")}
                </span>
              )}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              aria-label={t("products.chooseImage")}
              data-testid="product-image-input"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
            {preview && !removeImage && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFile(null);
                  setRemoveImage(true);
                  if (fileInput.current) fileInput.current.value = "";
                }}
              >
                <Trash2 aria-hidden />
                {t("products.removeImage")}
              </Button>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-2 lg:sticky lg:top-20">
          <Button type="button" variant="outline" className="flex-1" onClick={() => router.back()}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={pending} className="flex-1">
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {t("common.save")}
          </Button>
        </div>
      </div>
    </form>
  );
}
