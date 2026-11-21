"use server";

import { revalidatePath } from "next/cache";
import { invalidInput, type ActionResult } from "@/lib/actions";
import { companyAction, failFromDb } from "@/lib/server-action";
import { categorySchema, type CategoryInput } from "@/lib/validation/catalog";

export async function saveCategoryAction(id: string | null, input: CategoryInput): Promise<ActionResult<{ id: string }>> {
  return companyAction(id ? "products.update" : "products.create", async (ctx, supabase) => {
    const parsed = categorySchema.safeParse(input);
    if (!parsed.success) return invalidInput(parsed.error);
    const { name, description, parentId } = parsed.data;
    if (id && parentId === id) {
      return { ok: false, error: "errors.invalidInput", fieldErrors: { parentId: "categories.errors.depth" } };
    }

    const row = { name, description, parent_id: parentId };
    const query = id
      ? supabase.from("product_categories").update(row).eq("id", id).eq("company_id", ctx.company.id).is("deleted_at", null)
      : supabase.from("product_categories").insert({ ...row, company_id: ctx.company.id });
    const { data, error } = await query.select("id").maybeSingle();
    if (error) return failFromDb(error, "save category");
    if (!data) return { ok: false, error: "errors.notFound" };

    revalidatePath("/products", "layout");
    return { ok: true, data: { id: data.id } };
  });
}

export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  return companyAction("products.delete", async (ctx, supabase) => {
    const { data, error } = await supabase
      .from("product_categories")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("company_id", ctx.company.id)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error) return failFromDb(error, "delete category");
    if (!data) return { ok: false, error: "errors.notFound" };
    revalidatePath("/products", "layout");
    return { ok: true, message: "categories.deleted" };
  });
}
