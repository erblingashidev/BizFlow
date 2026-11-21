import { z } from "zod";
import { money, optionalDecimal, optionalText, quantity, uuid } from "./common";

export const MOVEMENT_KINDS = ["in", "out", "count", "transfer"] as const;
export type MovementKind = (typeof MOVEMENT_KINDS)[number];

const base = {
  productId: uuid(),
  note: optionalText(500),
};

/**
 * One form, four operations. `count` sets the counted quantity (the database computes the
 * correction under lock); `transfer` moves stock between two warehouses.
 */
export const stockOperationSchema = z.discriminatedUnion("kind", [
  z.object({
    ...base,
    kind: z.literal("in"),
    warehouseId: uuid(),
    quantity: quantity({ positive: true }),
    unitCost: optionalDecimal(money()),
  }),
  z.object({
    ...base,
    kind: z.literal("out"),
    warehouseId: uuid(),
    quantity: quantity({ positive: true }),
  }),
  z.object({
    ...base,
    kind: z.literal("count"),
    warehouseId: uuid(),
    quantity: quantity(),
  }),
  z
    .object({
      ...base,
      kind: z.literal("transfer"),
      warehouseId: uuid(),
      toWarehouseId: uuid(),
      quantity: quantity({ positive: true }),
    })
    .refine((v) => v.warehouseId !== v.toWarehouseId, {
      path: ["toWarehouseId"],
      message: "validation.sameWarehouse",
    }),
]);

export type StockOperationInput = z.input<typeof stockOperationSchema>;
export type StockOperation = z.output<typeof stockOperationSchema>;

export const MOVEMENT_TYPES = [
  "in", "out", "adjustment", "transfer_in", "transfer_out",
  "sale", "sale_return", "purchase", "purchase_return",
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];
