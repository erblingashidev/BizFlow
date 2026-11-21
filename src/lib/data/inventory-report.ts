import "server-only";

import { fromCents, toCents } from "@/lib/money";
import type { DbClient } from "@/lib/server-action";

export type InventoryReportRow = {
  product_id: string;
  sku: string;
  name: string;
  category_name: string | null;
  unit: string;
  is_active: boolean;
  quantity: number;
  total_quantity: number;
  min_stock: number;
  purchase_price: number;
  sale_price: number;
  cost_value: number;
  retail_value: number;
  stock_status: string;
};

const CHUNK = 1000;

/**
 * Reads the full report in chunks (PostgREST caps responses at max-rows). Archived products
 * are left out unless they still hold stock somewhere.
 */
export async function fetchInventoryReport(
  supabase: DbClient,
  companyId: string,
  filters: { warehouseId?: string; categoryId?: string },
): Promise<InventoryReportRow[]> {
  const rows: InventoryReportRow[] = [];
  for (let offset = 0; offset < 100_000; offset += CHUNK) {
    const { data, error } = await supabase
      .rpc("inventory_report", {
        p_company_id: companyId,
        p_warehouse_id: filters.warehouseId,
        p_category_id: filters.categoryId,
      })
      .or("is_active.eq.true,total_quantity.neq.0")
      .range(offset, offset + CHUNK - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as InventoryReportRow[]));
    if (!data || data.length < CHUNK) break;
  }
  return rows;
}

export function summarizeReport(rows: InventoryReportRow[]) {
  let cost = 0;
  let retail = 0;
  let low = 0;
  let out = 0;
  for (const r of rows) {
    cost += toCents(r.cost_value);
    retail += toCents(r.retail_value);
    if (r.stock_status === "low") low += 1;
    if (r.stock_status === "out") out += 1;
  }
  return {
    products: rows.length,
    costValue: fromCents(cost),
    retailValue: fromCents(retail),
    potentialMargin: fromCents(retail - cost),
    low,
    out,
  };
}
