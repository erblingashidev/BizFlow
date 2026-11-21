"use server";

import { revalidatePath } from "next/cache";
import { invalidInput, type ActionResult } from "@/lib/actions";
import { companyAction, failFromDb } from "@/lib/server-action";
import { warehouseSchema, type WarehouseInput } from "@/lib/validation/catalog";

function revalidateWarehouses() {
  revalidatePath("/", "layout");
}

export async function saveWarehouseAction(id: string | null, input: WarehouseInput): Promise<ActionResult<{ id: string }>> {
  return companyAction(id ? "warehouses.update" : "warehouses.create", async (ctx, supabase) => {
    const parsed = warehouseSchema.safeParse(input);
    if (!parsed.success) return invalidInput(parsed.error);
    const row = parsed.data;

    const query = id
      ? supabase.from("warehouses").update(row).eq("id", id).eq("company_id", ctx.company.id).is("deleted_at", null)
      : supabase.from("warehouses").insert({ ...row, company_id: ctx.company.id });
    const { data, error } = await query.select("id").maybeSingle();
    if (error) return failFromDb(error, "save warehouse");
    if (!data) return { ok: false, error: "errors.notFound" };

    revalidateWarehouses();
    return { ok: true, data: { id: data.id } };
  });
}

export async function setWarehouseActiveAction(id: string, active: boolean): Promise<ActionResult> {
  return companyAction("warehouses.update", async (ctx, supabase) => {
    const { data, error } = await supabase
      .from("warehouses")
      .update({ is_active: active })
      .eq("id", id)
      .eq("company_id", ctx.company.id)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error) return failFromDb(error, "toggle warehouse");
    if (!data) return { ok: false, error: "errors.notFound" };
    revalidateWarehouses();
    return { ok: true, message: active ? "warehouses.activated" : "warehouses.deactivated" };
  });
}

export async function setDefaultWarehouseAction(id: string): Promise<ActionResult> {
  return companyAction("warehouses.update", async (ctx, supabase) => {
    const { error } = await supabase.rpc("set_default_warehouse", { p_company_id: ctx.company.id, p_warehouse_id: id });
    if (error) return failFromDb(error, "set default warehouse");
    revalidateWarehouses();
    return { ok: true, message: "warehouses.defaultChanged" };
  });
}

export async function deleteWarehouseAction(id: string): Promise<ActionResult> {
  return companyAction("warehouses.delete", async (ctx, supabase) => {
    const { data, error } = await supabase
      .from("warehouses")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("company_id", ctx.company.id)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error) return failFromDb(error, "delete warehouse");
    if (!data) return { ok: false, error: "errors.notFound" };
    revalidateWarehouses();
    return { ok: true, message: "warehouses.deleted" };
  });
}
