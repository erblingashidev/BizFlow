/**
 * Seeds a demo company with users, catalog, stock and expenses.
 *
 *   npm run seed:demo            (reads .env.local)
 *
 * Users are created with the service role; business data is written through a signed-in
 * owner session so it exercises the same RLS policies and RPCs as the app.
 * Re-running is safe: existing demo users and the demo company are reused.
 */
import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";

config({ path: ".env.local" });
config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.SEED_DEMO_PASSWORD ?? "BizFlowDemo2026";

if (!url || !anonKey || !serviceKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const isLocal = /localhost|127\.0\.0\.1/.test(url);
if (!isLocal && process.env.SEED_ALLOW_REMOTE !== "1") {
  console.error(`Refusing to seed non-local project ${url}. Set SEED_ALLOW_REMOTE=1 to override.`);
  process.exit(1);
}

type Client = SupabaseClient<Database>;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const admin: Client = createClient<Database>(url, serviceKey, clientOptions);

const COMPANY_NAME = "Market Dardania SH.P.K.";

const USERS = [
  { key: "owner", email: "pronari@bizflow.demo", fullName: "Arben Gashi" },
  { key: "manager", email: "menaxheri@bizflow.demo", fullName: "Drita Krasniqi" },
  { key: "employee", email: "punonjesi@bizflow.demo", fullName: "Blerim Hoxha" },
] as const;

function must<T>(result: { data: T; error: unknown }, label: string): NonNullable<T> {
  if (result.error || result.data === null || result.data === undefined) {
    throw new Error(`${label}: ${JSON.stringify(result.error)}`);
  }
  return result.data as NonNullable<T>;
}

async function ensureUser(email: string, fullName: string): Promise<string> {
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, locale: "sq" },
  });
  if (created.data.user) return created.data.user.id;

  for (let page = 1; page < 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email === email);
    if (found) return found.id;
    if (data.users.length < 200) break;
  }
  throw new Error(`Could not create or find ${email}: ${created.error?.message}`);
}

async function signIn(email: string): Promise<Client> {
  const client = createClient<Database>(url!, anonKey!, clientOptions);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign in ${email}: ${error.message}`);
  return client;
}

async function main() {
  const ids: Record<string, string> = {};
  for (const u of USERS) ids[u.key] = await ensureUser(u.email, u.fullName);
  console.log("✓ users ready");

  const owner = await signIn(USERS[0].email);

  const existing = await owner.from("companies").select("id").eq("name", COMPANY_NAME).maybeSingle();
  if (existing.data) {
    console.log(`Demo company already exists (${existing.data.id}); skipping. Delete it to re-seed.`);
    return;
  }

  const companyId = must(
    await owner.rpc("create_company", {
      p_name: COMPANY_NAME,
      p_plan_code: "professional",
      p_business_number: "811456789",
      p_vat_number: "330123456",
      p_phone: "+383 44 123 456",
      p_city: "Prishtinë",
      p_address: "Rr. Nëna Terezë 10",
    }),
    "create_company",
  );
  console.log(`✓ company ${companyId}`);

  // Team members are added directly with the service role (no invitation flow yet).
  const roles = must(await admin.from("roles").select("id, key").is("company_id", null), "roles");
  const roleId = (key: string) => roles.find((r) => r.key === key)!.id;
  must(
    await admin
      .from("company_members")
      .insert([
        { company_id: companyId, user_id: ids.manager, role_id: roleId("manager"), status: "active", joined_at: new Date().toISOString() },
        { company_id: companyId, user_id: ids.employee, role_id: roleId("employee"), status: "active", joined_at: new Date().toISOString() },
      ])
      .select("id"),
    "members",
  );
  console.log("✓ team members");

  const mainWarehouse = must(
    await owner.from("warehouses").select("id").eq("company_id", companyId).eq("is_default", true).single(),
    "default warehouse",
  );
  const branch = must(
    await owner
      .from("warehouses")
      .insert({ company_id: companyId, name: "Depoja Prizren", code: "PZ", city: "Prizren" })
      .select("id")
      .single(),
    "branch warehouse",
  );

  const topCategories = must(
    await owner
      .from("product_categories")
      .insert(["Ushqimore", "Pije", "Higjienë", "Shtëpiake"].map((name) => ({ company_id: companyId, name })))
      .select("id, name"),
    "categories",
  );
  const drinks = topCategories.find((c) => c.name === "Pije")!;
  const coffee = must(
    await owner
      .from("product_categories")
      .insert({ company_id: companyId, name: "Kafe", parent_id: drinks.id })
      .select("id, name")
      .single(),
    "sub-category",
  );
  const categories = [...topCategories, coffee];
  const cat = (name: string) => categories.find((c) => c.name === name)!.id;

  const productRows = [
    { sku: "UHQ-001", name: "Miell T-500 1kg", category: "Ushqimore", purchase: 0.62, sale: 0.89, vat: 8, min: 40, stock: 120 },
    { sku: "UHQ-002", name: "Vaj luledielli 1L", category: "Ushqimore", purchase: 1.45, sale: 1.99, vat: 8, min: 30, stock: 18 },
    { sku: "UHQ-003", name: "Sheqer 1kg", category: "Ushqimore", purchase: 0.78, sale: 1.05, vat: 8, min: 25, stock: 60 },
    { sku: "PIJ-001", name: "Ujë mineral 1.5L (6 copë)", category: "Pije", purchase: 1.8, sale: 2.6, vat: 18, min: 20, stock: 45 },
    { sku: "PIJ-002", name: "Kafe turke 500g", category: "Kafe", purchase: 3.1, sale: 4.5, vat: 18, min: 10, stock: 6 },
    { sku: "HIG-001", name: "Detergjent rrobash 3kg", category: "Higjienë", purchase: 5.2, sale: 7.49, vat: 18, min: 8, stock: 15 },
    { sku: "HIG-002", name: "Letër higjienike (10 copë)", category: "Higjienë", purchase: 2.4, sale: 3.49, vat: 18, min: 15, stock: 9 },
    { sku: "SHT-001", name: "Qese mbeturinash 60L", category: "Shtëpiake", purchase: 0.9, sale: 1.5, vat: 18, min: 10, stock: 30 },
  ];

  const products = must(
    await owner
      .from("products")
      .insert(
        productRows.map((p) => ({
          company_id: companyId,
          category_id: cat(p.category),
          sku: p.sku,
          name: p.name,
          purchase_price: p.purchase,
          sale_price: p.sale,
          vat_rate: p.vat,
          min_stock: p.min,
          default_warehouse_id: mainWarehouse.id,
        })),
      )
      .select("id, sku"),
    "products",
  );
  console.log(`✓ ${products.length} products`);

  for (const row of productRows) {
    const product = products.find((p) => p.sku === row.sku)!;
    must(
      await owner.rpc("record_stock_movement", {
        p_company_id: companyId,
        p_product_id: product.id,
        p_warehouse_id: mainWarehouse.id,
        p_movement_type: "in",
        p_quantity: row.stock,
        p_unit_cost: row.purchase,
        p_note: "Stoku fillestar",
      }),
      `stock in ${row.sku}`,
    );
  }
  const flour = products.find((p) => p.sku === "UHQ-001")!;
  must(
    await owner.rpc("transfer_stock", {
      p_company_id: companyId,
      p_product_id: flour.id,
      p_from_warehouse_id: mainWarehouse.id,
      p_to_warehouse_id: branch.id,
      p_quantity: 20,
      p_note: "Furnizim i degës",
    }),
    "transfer",
  );
  console.log("✓ opening stock and one transfer");

  const customers = must(
    await owner
      .from("customers")
      .insert([
        { company_id: companyId, name: "Restorant Te Ura", customer_type: "business", business_number: "810998877", city: "Prishtinë", phone: "+383 49 555 111" },
        { company_id: companyId, name: "Kafe Bar Rinia", customer_type: "business", city: "Ferizaj" },
        { company_id: companyId, name: "Valon Berisha", customer_type: "individual", city: "Gjilan" },
      ], { defaultToNull: false })
      .select("id"),
    "customers",
  );
  const suppliers = must(
    await owner
      .from("suppliers")
      .insert([
        { company_id: companyId, name: "Agro Kosova SH.P.K.", business_number: "811000111", city: "Fushë Kosovë" },
        { company_id: companyId, name: "Distributori Illyria", city: "Pejë" },
      ], { defaultToNull: false })
      .select("id, name"),
    "suppliers",
  );
  console.log("✓ customers and suppliers");

  // Order headers only (line items and stock effects arrive with the sales/purchases module),
  // spread over the last six months so the dashboard chart has history.
  const today = new Date();
  const isoDay = (monthsAgo: number, day: number) => {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - monthsAgo, day));
    return d > today ? today.toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
  };
  const split = (gross: number, vat = 18) => {
    const subtotal = Math.round((gross / (1 + vat / 100)) * 100) / 100;
    return { subtotal, tax_total: Math.round((gross - subtotal) * 100) / 100, total: gross };
  };
  // next_document_number is internal to the database, so the seed numbers its orders in the
  // same format and then advances the sequences past them.
  const year = today.getUTCFullYear();
  const docNumber = (prefix: "SO" | "PO", n: number) => `${prefix}-${year}-${String(n).padStart(5, "0")}`;

  const salesPlan: { monthsAgo: number; day: number; gross: number; status: string }[] = [];
  const salesByMonth = [1180, 1460, 1325, 1710, 1895, 1240];
  salesByMonth.forEach((gross, i) => {
    const monthsAgo = 5 - i;
    salesPlan.push({ monthsAgo, day: 6, gross: Math.round(gross * 0.55 * 100) / 100, status: "fulfilled" });
    salesPlan.push({ monthsAgo, day: 18, gross: Math.round(gross * 0.45 * 100) / 100, status: monthsAgo === 0 ? "confirmed" : "fulfilled" });
  });
  salesPlan.push({ monthsAgo: 0, day: today.getUTCDate(), gross: 86.4, status: "draft" });
  for (const [i, o] of salesPlan.entries()) {
    must(
      await owner
        .from("sales_orders")
        .insert({
          company_id: companyId,
          order_number: docNumber("SO", i + 1),
          customer_id: customers[i % customers.length].id,
          warehouse_id: i % 3 === 2 ? branch.id : mainWarehouse.id,
          status: o.status,
          order_date: isoDay(o.monthsAgo, o.day),
          ...split(o.gross),
          payment_status: o.status === "fulfilled" ? "paid" : "unpaid",
          amount_paid: o.status === "fulfilled" ? o.gross : 0,
        })
        .select("id")
        .single(),
      "sales order",
    );
  }

  const purchasePlan = [
    { monthsAgo: 5, day: 3, gross: 820, status: "received" },
    { monthsAgo: 4, day: 4, gross: 610, status: "received" },
    { monthsAgo: 3, day: 2, gross: 935, status: "received" },
    { monthsAgo: 2, day: 5, gross: 780, status: "received" },
    { monthsAgo: 1, day: 3, gross: 1040, status: "received" },
    { monthsAgo: 0, day: 2, gross: 690, status: "ordered" },
    { monthsAgo: 0, day: today.getUTCDate(), gross: 312.5, status: "draft" },
  ];
  for (const [i, o] of purchasePlan.entries()) {
    must(
      await owner
        .from("purchase_orders")
        .insert({
          company_id: companyId,
          order_number: docNumber("PO", i + 1),
          supplier_id: suppliers[i % suppliers.length].id,
          warehouse_id: mainWarehouse.id,
          status: o.status,
          order_date: isoDay(o.monthsAgo, o.day),
          ...split(o.gross),
        })
        .select("id")
        .single(),
      "purchase order",
    );
  }
  for (const [docType, next] of [["sales_order", salesPlan.length + 1], ["purchase_order", purchasePlan.length + 1]] as const) {
    must(
      await admin
        .from("document_sequences")
        .update({ next_value: next })
        .eq("company_id", companyId)
        .eq("doc_type", docType)
        .select("doc_type"),
      `sequence ${docType}`,
    );
  }
  console.log(`✓ ${salesPlan.length} sales orders and ${purchasePlan.length} purchase orders`);

  const expenseCategories = must(
    await owner.from("expense_categories").select("id, name").eq("company_id", companyId),
    "expense categories",
  );
  const expenseCat = (name: string) => expenseCategories.find((c) => c.name === name)?.id ?? null;
  must(
    await owner
      .from("expenses")
      .insert([
        { company_id: companyId, category_id: expenseCat("Qiraja"), description: "Qiraja e lokalit", amount: 650, payment_method: "bank_transfer" },
        { company_id: companyId, category_id: expenseCat("Shërbimet komunale"), description: "Rryma (KESCO)", amount: 142.37, vat_amount: 11.47, payment_method: "bank_transfer" },
        { company_id: companyId, category_id: expenseCat("Transporti"), supplier_id: suppliers[0].id, description: "Transport malli", amount: 45, payment_method: "cash" },
      ], { defaultToNull: false })
      .select("id"),
    "expenses",
  );
  console.log("✓ expenses");

  console.log("\nDemo logins (password: %s)", password);
  for (const u of USERS) console.log(`  ${u.key.padEnd(9)} ${u.email}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
