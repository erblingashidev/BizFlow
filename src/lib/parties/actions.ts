"use server";

import { revalidatePath } from "next/cache";
import { invalidInput, type ActionResult } from "@/lib/actions";
import { companyAction, failFromDb } from "@/lib/server-action";
import { PARTY_KINDS, partySchema, type PartyInput, type PartyKind } from "@/lib/validation/party";

const CONFIG = {
  customer: { table: "customers", module: "customers", path: "/customers" },
  supplier: { table: "suppliers", module: "suppliers", path: "/suppliers" },
} as const;

function config(kind: PartyKind) {
  if (!(PARTY_KINDS as readonly string[]).includes(kind)) throw new Error("unknown party kind");
  return CONFIG[kind];
}

export async function savePartyAction(kind: PartyKind, id: string | null, input: PartyInput): Promise<ActionResult<{ id: string }>> {
  const c = config(kind);
  return companyAction(id ? `${c.module}.update` : `${c.module}.create`, async (ctx, supabase) => {
    const parsed = partySchema.safeParse(input);
    if (!parsed.success) return invalidInput(parsed.error);
    const d = parsed.data;
    const row = {
      name: d.name,
      contact_person: d.contactPerson,
      business_number: d.businessNumber,
      vat_number: d.vatNumber,
      email: d.email,
      phone: d.phone,
      address: d.address,
      city: d.city,
      country_code: d.countryCode,
      notes: d.notes,
    };

    let result;
    if (c.table === "customers") {
      const customerRow = { ...row, customer_type: d.customerType };
      result = id
        ? await supabase.from("customers").update(customerRow).eq("id", id).eq("company_id", ctx.company.id)
            .is("deleted_at", null).select("id").maybeSingle()
        : await supabase.from("customers").insert({ ...customerRow, company_id: ctx.company.id }).select("id").maybeSingle();
    } else {
      result = id
        ? await supabase.from("suppliers").update(row).eq("id", id).eq("company_id", ctx.company.id)
            .is("deleted_at", null).select("id").maybeSingle()
        : await supabase.from("suppliers").insert({ ...row, company_id: ctx.company.id }).select("id").maybeSingle();
    }

    if (result.error) return failFromDb(result.error, `save ${kind}`);
    if (!result.data) return { ok: false, error: "errors.notFound" };
    revalidatePath(c.path, "layout");
    return { ok: true, data: { id: result.data.id } };
  });
}

export async function setPartyActiveAction(kind: PartyKind, id: string, active: boolean): Promise<ActionResult> {
  const c = config(kind);
  return companyAction(`${c.module}.update`, async (ctx, supabase) => {
    const { data, error } = await supabase
      .from(c.table)
      .update({ is_active: active })
      .eq("id", id)
      .eq("company_id", ctx.company.id)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error) return failFromDb(error, `toggle ${kind}`);
    if (!data) return { ok: false, error: "errors.notFound" };
    revalidatePath(c.path, "layout");
    return { ok: true, message: active ? "parties.activated" : "parties.archived" };
  });
}

export async function deletePartyAction(kind: PartyKind, id: string): Promise<ActionResult> {
  const c = config(kind);
  return companyAction(`${c.module}.delete`, async (ctx, supabase) => {
    const { data, error } = await supabase
      .from(c.table)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("company_id", ctx.company.id)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error) return failFromDb(error, `delete ${kind}`);
    if (!data) return { ok: false, error: "errors.notFound" };
    revalidatePath(c.path, "layout");
    return { ok: true, message: "parties.deleted" };
  });
}
