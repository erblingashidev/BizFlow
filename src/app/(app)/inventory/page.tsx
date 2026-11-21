import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { AlertTriangle, Boxes, CircleSlash, Coins } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { FilterBar } from "@/components/app/filter-bar";
import { NativeSelect } from "@/components/app/native-select";
import { PageHeader } from "@/components/app/page-header";
import { Pagination } from "@/components/app/pagination";
import { ProductThumb } from "@/components/app/product-thumb";
import { StatCard } from "@/components/app/stat-card";
import { StockStatusBadge } from "@/components/app/stock-status-badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePagePermission } from "@/lib/auth/session";
import { categoryWithChildren, listCategories, listWarehouses, sortCategoryTree } from "@/lib/data/catalog";
import { formatCurrency, formatNumber } from "@/lib/format";
import { fromCents, toCents } from "@/lib/money";
import { oneOf, pageRange, param, sanitizeSearch, uuidParam, type SearchParams } from "@/lib/list-params";
import { signedProductImageUrls } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { InventoryTabs } from "./inventory-tabs";
import { stockKindsFor } from "./kinds";
import { StockOperationDialog } from "./stock-operation-dialog";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("inventory") };
}

const STOCK = ["low", "out"] as const;

export default async function InventoryPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requirePagePermission("inventory.view");
  const params = await searchParams;
  const t = await getTranslations();
  const locale = await getLocale();
  const supabase = await createClient();
  const company = ctx.company.id;

  const q = sanitizeSearch(param(params, "q"));
  const categoryId = uuidParam(param(params, "category"));
  const warehouseId = uuidParam(param(params, "warehouse"));
  const stock = oneOf(param(params, "stock"), STOCK);
  const { page, pageSize, from, to } = pageRange(params);

  const [categories, warehouses] = await Promise.all([listCategories(supabase, company), listWarehouses(supabase, company)]);
  const activeWarehouses = warehouses.filter((w) => w.isActive);
  const kinds = stockKindsFor(ctx.permissions, activeWarehouses.length);
  const categoryNames = new Map(categories.map((c) => [c.id, c.name]));

  const base = () =>
    supabase.from("product_stock_overview").select("id", { count: "exact", head: true }).eq("company_id", company).eq("track_inventory", true).eq("is_active", true);

  let query = supabase
    .from("product_stock_overview")
    .select("id, name, sku, unit, category_id, image_path, quantity, min_stock, stock_value, stock_status, default_warehouse_id, purchase_price", {
      count: "exact",
    })
    .eq("company_id", company)
    .eq("track_inventory", true)
    .eq("is_active", true)
    .order("name")
    .range(from, to);
  if (q) query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%,barcode.ilike.%${q}%`);
  if (categoryId) query = query.in("category_id", categoryWithChildren(categories, categoryId));
  if (stock === "low") query = query.eq("needs_reorder", true);
  if (stock === "out") query = query.eq("stock_status", "out");

  const [{ data: rows, count, error }, summary, lowCount, outCount, trackedCount] = await Promise.all([
    query,
    supabase.rpc("warehouse_stock_summary", { p_company_id: company }),
    base().eq("needs_reorder", true),
    base().eq("stock_status", "out"),
    base(),
  ]);
  if (error) throw error;

  const ids = (rows ?? []).map((r) => r.id);
  const [images, { data: levels }] = await Promise.all([
    signedProductImageUrls(supabase, (rows ?? []).map((r) => r.image_path)),
    warehouseId && ids.length
      ? supabase.from("stock_levels").select("product_id, quantity").eq("company_id", company).eq("warehouse_id", warehouseId).in("product_id", ids)
      : Promise.resolve({ data: [] as { product_id: string; quantity: number }[] }),
  ]);
  const inWarehouse = new Map((levels ?? []).map((l) => [l.product_id, Number(l.quantity)]));
  const stockValue = fromCents((summary.data ?? []).reduce((sum, w) => sum + toCents(w.stock_value), 0));
  const filtered = Boolean(q || categoryId || stock);
  const warehouseName = warehouseId ? warehouses.find((w) => w.id === warehouseId)?.name : undefined;

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <PageHeader
        title={t("inventory.title")}
        description={t("inventory.subtitle")}
        actions={
          kinds.length > 0 &&
          activeWarehouses.length > 0 && (
            <StockOperationDialog warehouses={activeWarehouses} kinds={kinds} triggerLabel={t("inventory.recordMovement")} />
          )
        }
      />
      <InventoryTabs />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("inventory.stockValue")} value={formatCurrency(stockValue, locale)} icon={Coins} tone="primary" />
        <StatCard label={t("inventory.trackedProducts")} value={formatNumber(trackedCount.count ?? 0, locale)} icon={Boxes} tone="muted" />
        <StatCard
          label={t("inventory.lowStock")}
          value={formatNumber(lowCount.count ?? 0, locale)}
          icon={AlertTriangle}
          tone={(lowCount.count ?? 0) > 0 ? "warning" : "muted"}
          href="/inventory?stock=low"
        />
        <StatCard
          label={t("inventory.outOfStock")}
          value={formatNumber(outCount.count ?? 0, locale)}
          icon={CircleSlash}
          tone={(outCount.count ?? 0) > 0 ? "destructive" : "muted"}
          href="/inventory?stock=out"
        />
      </div>

      <FilterBar action="/inventory" query={q} searchPlaceholder={t("products.searchPlaceholder")}>
        <NativeSelect name="warehouse" defaultValue={warehouseId ?? ""} aria-label={t("inventory.warehouse")} className="sm:w-48">
          <option value="">{t("inventory.allWarehouses")}</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="category" defaultValue={categoryId ?? ""} aria-label={t("products.category")} className="sm:w-48">
          <option value="">{t("products.allCategories")}</option>
          {sortCategoryTree(categories).map((c) => (
            <option key={c.id} value={c.id}>
              {c.depth ? `— ${c.name}` : c.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="stock" defaultValue={stock ?? ""} aria-label={t("inventory.stockLabel")} className="sm:w-44">
          <option value="">{t("inventory.anyStock")}</option>
          <option value="low">{t("inventory.lowOnly")}</option>
          <option value="out">{t("inventory.outOnly")}</option>
        </NativeSelect>
      </FilterBar>

      <Card className="py-0">
        {rows && rows.length > 0 ? (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">{t("inventory.product")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("products.category")}</TableHead>
                  {warehouseName && <TableHead className="text-right">{warehouseName}</TableHead>}
                  <TableHead className="text-right">{warehouseName ? t("inventory.totalOnHand") : t("inventory.onHand")}</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">{t("products.minStock")}</TableHead>
                  <TableHead className="hidden text-right lg:table-cell">{t("inventory.value")}</TableHead>
                  <TableHead>{t("inventory.statusLabel")}</TableHead>
                  {kinds.length > 0 && (
                    <TableHead className="pr-4">
                      <span className="sr-only">{t("common.actions")}</span>
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const unit = t(`units.${r.unit}`);
                  return (
                    <TableRow key={r.id} className={cn(r.stock_status === "out" && "bg-destructive/[0.03]")}>
                      <TableCell className="pl-4">
                        <Link href={`/products/${r.id}`} className="flex items-center gap-3">
                          <ProductThumb url={r.image_path ? images.get(r.image_path) : null} alt="" className="size-9" />
                          <span className="grid min-w-0">
                            <span className="truncate font-medium hover:underline">{r.name}</span>
                            <span className="truncate text-xs text-muted-foreground">{r.sku}</span>
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">
                        {(r.category_id && categoryNames.get(r.category_id)) || "—"}
                      </TableCell>
                      {warehouseName && (
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatNumber(inWarehouse.get(r.id) ?? 0, locale)} {unit}
                        </TableCell>
                      )}
                      <TableCell className={cn("text-right tabular-nums", !warehouseName && "font-medium")}>
                        {formatNumber(r.quantity, locale)} {unit}
                      </TableCell>
                      <TableCell className="hidden text-right tabular-nums text-muted-foreground sm:table-cell">
                        {formatNumber(r.min_stock, locale)}
                      </TableCell>
                      <TableCell className="hidden text-right tabular-nums lg:table-cell">{formatCurrency(r.stock_value, locale)}</TableCell>
                      <TableCell>
                        <StockStatusBadge status={r.stock_status} />
                      </TableCell>
                      {kinds.length > 0 && (
                        <TableCell className="pr-4 text-right">
                          <StockOperationDialog
                            warehouses={activeWarehouses}
                            kinds={kinds}
                            product={{
                              id: r.id,
                              name: r.name,
                              sku: r.sku,
                              unit: r.unit,
                              defaultWarehouseId: warehouseId ?? r.default_warehouse_id,
                              purchasePrice: Number(r.purchase_price),
                            }}
                            triggerLabel={t("inventory.move")}
                            triggerVariant="ghost"
                            triggerSize="sm"
                          />
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <Pagination pathname="/inventory" params={params} page={page} pageSize={pageSize} total={count ?? 0} />
          </>
        ) : (
          <EmptyState
            icon={Boxes}
            title={filtered ? t("common.noResults") : t("inventory.emptyTitle")}
            description={filtered ? t("common.noResultsHint") : t("inventory.emptyDescription")}
          />
        )}
      </Card>
    </div>
  );
}
