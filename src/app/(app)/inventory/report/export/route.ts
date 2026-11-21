import { NextResponse, type NextRequest } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { getCompanyContext } from "@/lib/auth/session";
import { toCsv } from "@/lib/csv";
import { fetchInventoryReport } from "@/lib/data/inventory-report";
import { todayInDisplayZone } from "@/lib/format";
import { uuidParam } from "@/lib/list-params";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const ctx = await getCompanyContext();
  if (!ctx) return new NextResponse("Unauthorized", { status: 401 });
  if (!ctx.permissions.has("inventory.view") || !ctx.permissions.has("reports.export")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const search = request.nextUrl.searchParams;
  const warehouseId = uuidParam(search.get("warehouse") ?? undefined);
  const categoryId = uuidParam(search.get("category") ?? undefined);
  const supabase = await createClient();
  const rows = await fetchInventoryReport(supabase, ctx.company.id, { warehouseId, categoryId });

  const locale = await getLocale();
  const t = await getTranslations();
  const header = [
    t("products.sku"),
    t("products.name"),
    t("products.category"),
    t("products.unit"),
    t("inventory.quantity"),
    t("inventory.totalOnHand"),
    t("products.minStock"),
    t("products.purchasePrice"),
    t("products.salePrice"),
    t("inventory.costValue"),
    t("inventory.retailValue"),
    t("inventory.statusLabel"),
  ];
  const body = rows.map((r) => [
    r.sku,
    r.name,
    r.category_name,
    t(`units.${r.unit}`),
    Number(r.quantity),
    Number(r.total_quantity),
    Number(r.min_stock),
    Number(r.purchase_price),
    Number(r.sale_price),
    Number(r.cost_value),
    Number(r.retail_value),
    t(`inventory.status.${r.stock_status}`),
  ]);

  const filename = `inventory-${todayInDisplayZone()}.csv`;
  return new NextResponse(toCsv([header, ...body], locale), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
