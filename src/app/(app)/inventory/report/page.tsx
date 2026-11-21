import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { AlertTriangle, Coins, Download, FileBarChart, TrendingUp } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { FilterBar } from "@/components/app/filter-bar";
import { NativeSelect } from "@/components/app/native-select";
import { PageHeader } from "@/components/app/page-header";
import { Pagination } from "@/components/app/pagination";
import { StatCard } from "@/components/app/stat-card";
import { StockStatusBadge } from "@/components/app/stock-status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePagePermission } from "@/lib/auth/session";
import { listCategories, listWarehouses, sortCategoryTree } from "@/lib/data/catalog";
import { fetchInventoryReport, summarizeReport } from "@/lib/data/inventory-report";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format";
import { listHref, pageRange, param, uuidParam, type SearchParams } from "@/lib/list-params";
import { createClient } from "@/lib/supabase/server";
import { InventoryTabs } from "../inventory-tabs";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("inventory.tabs");
  return { title: t("report") };
}

export default async function InventoryReportPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requirePagePermission("inventory.view");
  const params = await searchParams;
  const t = await getTranslations();
  const locale = await getLocale();
  const supabase = await createClient();
  const company = ctx.company.id;

  const warehouseId = uuidParam(param(params, "warehouse"));
  const categoryId = uuidParam(param(params, "category"));
  const { page, pageSize, from } = pageRange(params, 50);

  const [warehouses, categories, rows] = await Promise.all([
    listWarehouses(supabase, company),
    listCategories(supabase, company),
    fetchInventoryReport(supabase, company, { warehouseId, categoryId }),
  ]);
  const totals = summarizeReport(rows);
  const pageRows = rows.slice(from, from + pageSize);
  const canExport = ctx.permissions.has("reports.export");
  const exportHref = listHref("/inventory/report/export", params, { page: undefined });

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <PageHeader
        title={t("inventory.title")}
        description={t("inventory.reportSubtitle", { date: formatDateTime(new Date(), locale) })}
        actions={
          canExport && (
            <a href={exportHref} className={buttonVariants({ variant: "outline" })} download>
              <Download aria-hidden />
              {t("inventory.exportCsv")}
            </a>
          )
        }
      />
      <InventoryTabs />

      <FilterBar action="/inventory/report">
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
      </FilterBar>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("inventory.costValue")} value={formatCurrency(totals.costValue, locale)} icon={Coins} tone="primary" />
        <StatCard label={t("inventory.retailValue")} value={formatCurrency(totals.retailValue, locale)} icon={FileBarChart} tone="muted" />
        <StatCard label={t("inventory.potentialMargin")} value={formatCurrency(totals.potentialMargin, locale)} icon={TrendingUp} tone="success" />
        <StatCard
          label={t("inventory.needsAttention")}
          value={formatNumber(totals.low + totals.out, locale)}
          hint={t("inventory.lowAndOut", { low: totals.low, out: totals.out })}
          icon={AlertTriangle}
          tone={totals.low + totals.out > 0 ? "warning" : "muted"}
        />
      </div>

      <Card className="py-0">
        {rows.length === 0 ? (
          <EmptyState icon={FileBarChart} title={t("inventory.reportEmpty")} />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">{t("inventory.product")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("products.category")}</TableHead>
                  <TableHead className="text-right">{t("inventory.quantity")}</TableHead>
                  <TableHead className="hidden text-right lg:table-cell">{t("products.purchasePrice")}</TableHead>
                  <TableHead className="text-right">{t("inventory.costValue")}</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">{t("inventory.retailValue")}</TableHead>
                  <TableHead className="pr-4">{t("inventory.statusLabel")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((r) => (
                  <TableRow key={r.product_id}>
                    <TableCell className="pl-4">
                      <Link href={`/products/${r.product_id}`} className="grid min-w-0 hover:underline">
                        <span className="truncate font-medium">{r.name}</span>
                        <span className="truncate text-xs text-muted-foreground">{r.sku}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">{r.category_name ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(r.quantity, locale)} {t(`units.${r.unit}`)}
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums lg:table-cell">{formatCurrency(r.purchase_price, locale)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(r.cost_value, locale)}</TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatCurrency(r.retail_value, locale)}</TableCell>
                    <TableCell className="pr-4">
                      <StockStatusBadge status={r.stock_status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="pl-4" colSpan={2}>
                    {t("inventory.reportTotal", { count: totals.products })}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell" />
                  <TableCell />
                  <TableCell className="text-right tabular-nums">{formatCurrency(totals.costValue, locale)}</TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatCurrency(totals.retailValue, locale)}</TableCell>
                  <TableCell className="pr-4" />
                </TableRow>
              </TableFooter>
            </Table>
            <Pagination pathname="/inventory/report" params={params} page={page} pageSize={pageSize} total={rows.length} />
          </>
        )}
      </Card>
    </div>
  );
}
