import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { History, X } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { FilterBar } from "@/components/app/filter-bar";
import { NativeSelect } from "@/components/app/native-select";
import { PageHeader } from "@/components/app/page-header";
import { Pagination } from "@/components/app/pagination";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requirePagePermission } from "@/lib/auth/session";
import { listWarehouses } from "@/lib/data/catalog";
import { localDateTimeToUtcIso } from "@/lib/format";
import { dateParam, listHref, oneOf, pageRange, param, uuidParam, type SearchParams } from "@/lib/list-params";
import { createClient } from "@/lib/supabase/server";
import { MOVEMENT_TYPES } from "@/lib/validation/inventory";
import { InventoryTabs } from "../inventory-tabs";
import { MovementsTable } from "../movements-table";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("inventory.tabs");
  return { title: t("movements") };
}

function nextDay(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default async function MovementsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requirePagePermission("inventory.view");
  const params = await searchParams;
  const t = await getTranslations();
  const supabase = await createClient();
  const company = ctx.company.id;

  const productId = uuidParam(param(params, "product"));
  const warehouseId = uuidParam(param(params, "warehouse"));
  const type = oneOf(param(params, "type"), MOVEMENT_TYPES);
  const fromDate = dateParam(param(params, "from"));
  const toDate = dateParam(param(params, "to"));
  const { page, pageSize, from, to } = pageRange(params, 25);

  const [warehouses, { data: product }] = await Promise.all([
    listWarehouses(supabase, company),
    productId
      ? supabase.from("products").select("id, name, sku").eq("company_id", company).eq("id", productId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  let query = supabase
    .from("stock_movements")
    .select(
      "id, created_at, movement_type, quantity, balance_after, note, warehouse_id, product:products(id, name, sku, unit), creator:profiles(full_name, email)",
      { count: "exact" },
    )
    .eq("company_id", company)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (productId) query = query.eq("product_id", productId);
  if (warehouseId) query = query.eq("warehouse_id", warehouseId);
  if (type) query = query.eq("movement_type", type);
  // Date filters are Kosovo calendar days, converted to UTC instants.
  if (fromDate) query = query.gte("created_at", localDateTimeToUtcIso(fromDate));
  if (toDate) query = query.lt("created_at", localDateTimeToUtcIso(nextDay(toDate)));

  const { data: rows, count, error } = await query;
  if (error) throw error;
  const warehouseNames = new Map(warehouses.map((w) => [w.id, w.name]));
  const filtered = Boolean(productId || warehouseId || type || fromDate || toDate);

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <PageHeader title={t("inventory.title")} description={t("inventory.movementsSubtitle")} />
      <InventoryTabs />

      <FilterBar action="/inventory/movements">
        {productId && <input type="hidden" name="product" value={productId} />}
        <NativeSelect name="warehouse" defaultValue={warehouseId ?? ""} aria-label={t("inventory.warehouse")} className="sm:w-44">
          <option value="">{t("inventory.allWarehouses")}</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="type" defaultValue={type ?? ""} aria-label={t("inventory.movementType")} className="sm:w-44">
          <option value="">{t("inventory.allTypes")}</option>
          {MOVEMENT_TYPES.map((m) => (
            <option key={m} value={m}>
              {t(`inventory.types.${m}`)}
            </option>
          ))}
        </NativeSelect>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          {t("inventory.dateFrom")}
          <Input type="date" name="from" defaultValue={fromDate} className="w-auto bg-card" />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          {t("inventory.dateTo")}
          <Input type="date" name="to" defaultValue={toDate} className="w-auto bg-card" />
        </label>
      </FilterBar>

      {product && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{t("inventory.product")}:</span>
          <Badge variant="secondary" className="h-6 gap-1.5">
            {product.name} · {product.sku}
            <Link href={listHref("/inventory/movements", params, { product: undefined, page: undefined })} aria-label={t("common.clear")}>
              <X className="size-3" aria-hidden />
            </Link>
          </Badge>
        </div>
      )}

      <Card className="py-0">
        {rows && rows.length > 0 ? (
          <>
            <MovementsTable rows={rows} warehouseNames={warehouseNames} />
            <Pagination pathname="/inventory/movements" params={params} page={page} pageSize={pageSize} total={count ?? 0} />
          </>
        ) : (
          <EmptyState
            icon={History}
            title={filtered ? t("common.noResults") : t("inventory.noMovements")}
            description={filtered ? t("common.noResultsHint") : undefined}
          />
        )}
      </Card>
    </div>
  );
}
