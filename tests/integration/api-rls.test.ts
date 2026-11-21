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

  it("members cannot forge activity rows or log logins", async () => {
    const forged = await owner.rpc("log_activity" as never, {
      p_company_id: companyId,
      p_action: "product.deleted",
      p_entity_type: "product",
      p_entity_id: randomUUID(),
      p_metadata: {},
    } as never);
    expect((forged as { error: { code: string } | null }).error?.code).toBe("42501");
    const login = await owner.rpc("log_login", { p_user_id: randomUUID() });
    expect(login.error?.code).toBe("42501");
    const insert = await owner.from("activity_logs").insert({ company_id: companyId, action: "x.y" });
    expect(insert.error?.code).toBe("42501");
  });

  it("catalog writes are audited by the database with the real author", async () => {
    const sku = `IT-${randomUUID().slice(0, 8)}`;
    const meId = (await owner.auth.getUser()).data.user!.id;
    const created = await owner
      .from("products")
      .insert({ company_id: companyId, sku, name: "Integration item", created_by: randomUUID() })
      .select("id, created_by")
      .single();
    expect(created.error).toBeNull();
    expect(created.data!.created_by).toBe(meId);

    await owner.from("products").update({ is_active: false }).eq("id", created.data!.id);
    const logs = await owner
      .from("activity_logs")
      .select("action, user_id, metadata")
      .eq("entity_id", created.data!.id)
      .order("created_at");
    expect(logs.data?.map((l) => l.action)).toEqual(["product.created", "product.archived"]);
    expect(logs.data?.every((l) => l.user_id === meId)).toBe(true);
    expect((logs.data![0].metadata as { label?: string }).label).toBe("Integration item");
  });

  it("dashboard and stock reports respect permissions and tenants", async () => {
    const summary = await owner.rpc("dashboard_summary", { p_company_id: companyId });
    expect(summary.error).toBeNull();
    const s = summary.data as { products: number; monthly: unknown[]; low_stock: number; sales_month: number };
    expect(s.products).toBeGreaterThanOrEqual(8);
    expect(s.monthly).toHaveLength(12);
    expect(s.low_stock).toBeGreaterThan(0);

    const foreign = await outsider.rpc("dashboard_summary", { p_company_id: companyId });
    expect(foreign.error?.code).toBe("42501");

    const report = await owner.rpc("inventory_report", { p_company_id: companyId });
    expect(report.data?.length).toBeGreaterThanOrEqual(8);
    const foreignReport = await outsider.rpc("inventory_report", { p_company_id: companyId });
    expect(foreignReport.error?.code).toBe("42501");

    const overview = await outsider.from("product_stock_overview").select("id").eq("company_id", companyId);
    expect(overview.data).toEqual([]);
  });

  it("the stock-count RPC records only the difference and the employee cannot use it", async () => {
    const product = await owner.from("products").select("id").eq("sku", "SHT-001").single();
    const warehouse = await owner.from("warehouses").select("id").eq("is_default", true).single();
    const args = { p_company_id: companyId, p_product_id: product.data!.id, p_warehouse_id: warehouse.data!.id };
    const level = await owner.from("stock_levels").select("quantity").match({ product_id: args.p_product_id, warehouse_id: args.p_warehouse_id }).single();
    const target = Number(level.data!.quantity) + 3;

    const counted = await owner.rpc("record_stock_count", { ...args, p_counted: target });
    expect(counted.error).toBeNull();
    expect(Number(counted.data!.quantity)).toBe(3);
    expect(Number(counted.data!.balance_after)).toBe(target);

    const again = await owner.rpc("record_stock_count", { ...args, p_counted: target });
    expect(again.error?.hint).toBe("no_change");

    const denied = await employee.rpc("record_stock_count", { ...args, p_counted: 0 });
    expect(denied.error?.code).toBe("42501");
  });

  it.skipIf(process.env.INTEGRATION_STORAGE !== "1")("product images are private and company-scoped in Storage", async () => {
    const product = await owner.from("products").select("id").eq("sku", "HIG-001").single();
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const path = `${companyId}/products/${product.data!.id}/${randomUUID()}.png`;
    const bucket = (c: Client) => c.storage.from("product-images");

    const upload = await bucket(owner).upload(path, png, { contentType: "image/png" });
    expect(upload.error).toBeNull();

    const signed = await bucket(employee).createSignedUrl(path, 60);
    expect(signed.error).toBeNull();
    const fetched = await fetch(signed.data!.signedUrl);
    expect(fetched.status).toBe(200);

    const publicUrl = bucket(owner).getPublicUrl(path).data.publicUrl;
    expect((await fetch(publicUrl)).status).toBeGreaterThanOrEqual(400);

    const employeeUpload = await bucket(employee).upload(
      `${companyId}/products/${product.data!.id}/${randomUUID()}.png`,
      png,
      { contentType: "image/png" },
    );
    expect(employeeUpload.error).not.toBeNull();

    const outsiderRead = await bucket(outsider).download(path);
    expect(outsiderRead.error).not.toBeNull();
    const outsiderUpload = await bucket(outsider).upload(`${companyId}/products/${product.data!.id}/${randomUUID()}.png`, png, {
      contentType: "image/png",
    });
    expect(outsiderUpload.error).not.toBeNull();

    const wrongFolder = await bucket(owner).upload(`${companyId}/avatars/${randomUUID()}.png`, png, { contentType: "image/png" });
    expect(wrongFolder.error).not.toBeNull();
    const wrongType = await bucket(owner).upload(`${companyId}/products/${product.data!.id}/${randomUUID()}.html`, "<script>", {
      contentType: "text/html",
    });
    expect(wrongType.error).not.toBeNull();

    const removed = await bucket(owner).remove([path]);
    expect(removed.error).toBeNull();
    expect(removed.data).toHaveLength(1);
  });

  it("guards block deleting stocked products and the default warehouse", async () => {
    const product = await owner.from("products").select("id").eq("sku", "UHQ-001").single();
    const del = await owner.from("products").update({ deleted_at: new Date().toISOString() }).eq("id", product.data!.id);
    expect(del.error?.hint).toBe("product_has_stock");

    const warehouse = await owner.from("warehouses").select("id").eq("is_default", true).single();
    const retire = await owner.from("warehouses").update({ is_active: false }).eq("id", warehouse.data!.id);
    expect(["warehouse_has_stock", "warehouse_is_default"]).toContain(retire.error?.hint);
  });
});
