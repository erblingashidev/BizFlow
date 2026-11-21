"use server";

import { revalidatePath } from "next/cache";
import { invalidInput, type ActionResult } from "@/lib/actions";
import { companyAction, failFromDb } from "@/lib/server-action";
import { stockOperationSchema, type StockOperationInput } from "@/lib/validation/inventory";

/** Current quantity per warehouse for one product (shown while recording a movement). */
export async function getProductStockAction(productId: string): Promise<ActionResult<Record<string, number>>> {
  return companyAction("inventory.view", async (ctx, supabase) => {
    const { data, error } = await supabase
      .from("stock_levels")
      .select("warehouse_id, quantity")
      .eq("company_id", ctx.company.id)
      .eq("product_id", productId);
    if (error) return failFromDb(error, "load product stock");
    return { ok: true, data: Object.fromEntries((data ?? []).map((r) => [r.warehouse_id, Number(r.quantity)])) };
  });
}

/**
 * Every stock change goes through a transactional RPC (record_stock_movement,
 * record_stock_count, transfer_stock); stock tables are not writable directly.
 */
export async function recordStockOperationAction(input: StockOperationInput): Promise<ActionResult> {
  const kind = input?.kind;
  const permission = kind === "transfer" ? "inventory.transfer" : "inventory.adjust";

  return companyAction(permission, async (ctx, supabase) => {
    const parsed = stockOperationSchema.safeParse(input);
    if (!parsed.success) return invalidInput(parsed.error);
    const op = parsed.data;
    const company = ctx.company.id;

    let error;
    switch (op.kind) {
      case "in":
      case "out":
        ({ error } = await supabase.rpc("record_stock_movement", {
          p_company_id: company,
          p_product_id: op.productId,
          p_warehouse_id: op.warehouseId,
          p_movement_type: op.kind,
          p_quantity: op.quantity,
          p_unit_cost: op.kind === "in" ? op.unitCost : undefined,
          p_note: op.note ?? undefined,
        }));
        break;
      case "count":
        ({ error } = await supabase.rpc("record_stock_count", {
          p_company_id: company,
          p_product_id: op.productId,
          p_warehouse_id: op.warehouseId,
          p_counted: op.quantity,
          p_note: op.note ?? undefined,
        }));
        break;
      case "transfer":
        ({ error } = await supabase.rpc("transfer_stock", {
          p_company_id: company,
          p_product_id: op.productId,
          p_from_warehouse_id: op.warehouseId,
          p_to_warehouse_id: op.toWarehouseId,
          p_quantity: op.quantity,
          p_note: op.note ?? undefined,
        }));
        break;
    }

    if (error) return failFromDb(error, `stock ${op.kind}`);
    revalidatePath("/", "layout");
    return { ok: true, message: `inventory.saved.${op.kind}` };
  });
}
