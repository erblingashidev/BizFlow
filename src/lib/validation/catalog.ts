import { z } from "zod";
import { money, optionalDecimal, optionalText, optionalUuid, quantity, requiredText } from "./common";

export const PRODUCT_UNITS = ["pcs", "kg", "g", "l", "ml", "m", "m2", "box", "pack", "set", "hour"] as const;
/** Kosovo VAT rates: standard 18%, reduced 8%, exempt 0%. */
export const VAT_RATES = [18, 8, 0] as const;

export const productSchema = z
  .object({
    name: requiredText(200),
    sku: z
      .string()
      .trim()
      .min(1, "validation.required")
      .max(64, "validation.tooLong")
      .regex(/^[A-Za-z0-9._/-]+$/, "validation.sku"),
    barcode: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((v) => (v ? v : null))
      .refine((v) => v === null || /^[0-9A-Za-z-]{4,64}$/.test(v), "validation.barcode"),
    categoryId: optionalUuid(),
    description: optionalText(2000),
    productType: z.enum(["goods", "service"]),
    unit: z.enum(PRODUCT_UNITS, { error: "validation.required" }),
    purchasePrice: money(),
    salePrice: money(),
    vatRate: z.coerce
      .number()
      .refine((v) => (VAT_RATES as readonly number[]).includes(v), "validation.vatRate"),
    minStock: quantity(),
    trackInventory: z.boolean(),
    defaultWarehouseId: optionalUuid(),
    /** Create only: opening stock booked as a stock-in movement. */
    openingQuantity: optionalDecimal(quantity({ positive: true })),
    openingWarehouseId: optionalUuid(),
  })
  .superRefine((value, ctx) => {
    if (value.productType === "service" && value.trackInventory) {
      ctx.addIssue({ code: "custom", path: ["trackInventory"], message: "validation.serviceNoStock" });
    }
    if (value.openingQuantity !== undefined) {
      if (!value.trackInventory) {
        ctx.addIssue({ code: "custom", path: ["openingQuantity"], message: "validation.openingNeedsTracking" });
      }
      if (!value.openingWarehouseId) {
        ctx.addIssue({ code: "custom", path: ["openingWarehouseId"], message: "validation.required" });
      }
    }
  });

export type ProductInput = z.input<typeof productSchema>;
export type ProductData = z.output<typeof productSchema>;

export const categorySchema = z.object({
  name: requiredText(120),
  description: optionalText(500),
  parentId: optionalUuid(),
});

export type CategoryInput = z.input<typeof categorySchema>;

export const warehouseSchema = z.object({
  name: requiredText(120),
  code: z
    .string()
    .trim()
    .min(1, "validation.required")
    .max(20, "validation.tooLong")
    .regex(/^[A-Za-z0-9_-]+$/, "validation.code")
    .transform((v) => v.toUpperCase()),
  city: optionalText(100),
  address: optionalText(300),
});

export type WarehouseInput = z.input<typeof warehouseSchema>;
