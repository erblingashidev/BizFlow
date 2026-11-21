/**
 * Tenant isolation through the real HTTP API (Supabase Auth JWTs + PostgREST + RLS).
 * Opt-in: requires a running backend seeded with `npm run seed:demo`, e.g.
 *
 *   scripts/local-stack.sh setup && scripts/local-stack.sh start && npm run seed:demo
 *   npm run test:integration
 */
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/types/database";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const password = process.env.SEED_DEMO_PASSWORD ?? "BizFlowDemo2026";
const enabled = process.env.INTEGRATION === "1" && Boolean(url && anonKey);

type Client = SupabaseClient<Database>;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };

async function signIn(email: string, pass = password): Promise<Client> {
  const client = createClient<Database>(url, anonKey, opts);
  const { error } = await client.auth.signInWithPassword({ email, password: pass });
  if (error) throw error;
  return client;
}

describe.skipIf(!enabled)("API tenant isolation", () => {
  let owner: Client;
  let employee: Client;
  let outsider: Client;
  let companyId: string;
  let outsiderCompanyId: string;

  beforeAll(async () => {
    owner = await signIn("pronari@bizflow.demo");
    employee = await signIn("punonjesi@bizflow.demo");

    const email = `outsider-${randomUUID()}@example.com`;
    const anon = createClient<Database>(url, anonKey, opts);
    const { error } = await anon.auth.signUp({ email, password: "Outsider123", options: { data: { full_name: "Out Sider" } } });
    if (error) throw error;
    outsider = await signIn(email, "Outsider123");
    const created = await outsider.rpc("create_company", { p_name: "Outsider Co" });
    if (created.error) throw created.error;
    outsiderCompanyId = created.data;

    const company = await owner.from("companies").select("id").single();
    if (company.error) throw company.error;
    companyId = company.data.id;
  });

  it("anonymous visitors can read plans but not tenant data", async () => {
    const anon = createClient<Database>(url, anonKey, opts);
    const plans = await anon.from("subscription_plans").select("code");
    expect(plans.data?.map((p) => p.code).sort()).toEqual(["business", "professional", "starter"]);
    const companies = await anon.from("companies").select("id");
    expect(companies.error?.code).toBe("42501");
  });

  it("an outsider sees none of the demo company's rows", async () => {
    const products = await outsider.from("products").select("id").eq("company_id", companyId);
    expect(products.data).toEqual([]);
    const companies = await outsider.from("companies").select("id");
    expect(companies.data?.map((c) => c.id)).toEqual([outsiderCompanyId]);
  });

  it("an outsider cannot write into the demo company", async () => {
    const insert = await outsider.from("products").insert({ company_id: companyId, sku: "X", name: "X" });
    expect(insert.error?.code).toBe("42501");

    const product = await owner.from("products").select("id").limit(1).single();
    const warehouse = await owner.from("warehouses").select("id").eq("is_default", true).single();
    const move = await outsider.rpc("record_stock_movement", {
      p_company_id: companyId,
      p_product_id: product.data!.id,
      p_warehouse_id: warehouse.data!.id,
      p_movement_type: "out",
      p_quantity: 1,
    });
    expect(move.error?.code).toBe("42501");
  });

  it("an employee can read the catalog but not change stock or prices", async () => {
    const products = await employee.from("products").select("id, sale_price");
    expect(products.data?.length).toBeGreaterThan(0);

    const update = await employee.from("products").update({ sale_price: 0 }).eq("id", products.data![0].id).select("id");
    expect(update.data).toEqual([]);

    const levels = await employee.from("stock_levels").update({ quantity: 9999 }).eq("company_id", companyId);
    expect(levels.error?.code).toBe("42501");

    const expenses = await employee.from("expenses").select("id");
    expect(expenses.data).toEqual([]);
  });

  it("the owner records stock through the RPC and cannot overdraw", async () => {
    const product = await owner.from("products").select("id").eq("sku", "PIJ-002").single();
    const warehouse = await owner.from("warehouses").select("id").eq("is_default", true).single();
    const args = { p_company_id: companyId, p_product_id: product.data!.id, p_warehouse_id: warehouse.data!.id };

    const before = await owner.from("stock_levels").select("quantity").match({ product_id: args.p_product_id, warehouse_id: args.p_warehouse_id }).single();
    const moved = await owner.rpc("record_stock_movement", { ...args, p_movement_type: "in", p_quantity: 2 });
    expect(moved.error).toBeNull();
    expect(Number(moved.data!.balance_after)).toBe(Number(before.data!.quantity) + 2);

    const overdraw = await owner.rpc("record_stock_movement", { ...args, p_movement_type: "out", p_quantity: 100000 });
    expect(overdraw.error?.hint).toBe("insufficient_stock");
  });

  it("the server-side permission list matches the role", async () => {
    const ownerPerms = await owner.rpc("my_permissions", { p_company_id: companyId });
    const employeePerms = await employee.rpc("my_permissions", { p_company_id: companyId });
    expect(ownerPerms.data).toContain("billing.manage");
    expect(employeePerms.data).not.toContain("inventory.adjust");
    const forged = await employee.rpc("my_permissions", { p_company_id: outsiderCompanyId });
    expect(forged.data).toEqual([]);
  });
});
