import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Package, Plus } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { FilterBar } from "@/components/app/filter-bar";
import { NativeSelect } from "@/components/app/native-select";
import { PageHeader } from "@/components/app/page-header";
import { Pagination } from "@/components/app/pagination";
import { ProductThumb } from "@/components/app/product-thumb";
import { StockStatusBadge } from "@/components/app/stock-status-badge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePagePermission } from "@/lib/auth/session";
import { categoryWithChildren, listCategories, sortCategoryTree } from "@/lib/data/catalog";
import { formatCurrency, formatNumber } from "@/lib/format";
import { oneOf, pageRange, param, sanitizeSearch, uuidParam, type SearchParams } from "@/lib/list-params";
import { signedProductImageUrls } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { ProductsTabs } from "./products-tabs";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("products") };
}

const STATUSES = ["active", "archived", "all"] as const;
const STOCK = ["low", "out"] as const;

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requirePagePermission("products.view");
  const params = await searchParams;
  const t = await getTranslations();
  const locale = await getLocale();
  const supabase = await createClient();
  const canSeeStock = ctx.permissions.has("inventory.view");

  const q = sanitizeSearch(param(params, "q"));
  const categoryId = uuidParam(param(params, "category"));
  const status = oneOf(param(params, "status"), STATUSES) ?? "active";
  const stock = canSeeStock ? oneOf(param(params, "stock"), STOCK) : undefined;
  const { page, pageSize, from, to } = pageRange(params);

  const categories = await listCategories(supabase, ctx.company.id);
  const categoryNames = new Map(categories.map((c) => [c.id, c.name]));

  let query = supabase
    .from("product_stock_overview")
    .select("id, name, sku, barcode, category_id, unit, sale_price, quantity, stock_status, is_active, image_path, track_inventory", {
      count: "exact",
    })
    .eq("company_id", ctx.company.id)
    .order("name")
    .range(from, to);
  if (status === "active") query = query.eq("is_active", true);
  if (status === "archived") query = query.eq("is_active", false);
  if (q) query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%,barcode.ilike.%${q}%`);
  if (categoryId) query = query.in("category_id", categoryWithChildren(categories, categoryId));
  if (stock === "low") query = query.eq("needs_reorder", true);
  if (stock === "out") query = query.eq("stock_status", "out");

  const { data: products, count, error } = await query;
  if (error) throw error;
  const images = await signedProductImageUrls(supabase, (products ?? []).map((p) => p.image_path));
  const filtered = Boolean(q || categoryId || stock || status !== "active");

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <PageHeader
        title={t("nav.products")}
        description={t("products.subtitle")}
        actions={
          ctx.permissions.has("products.create") && (
            <Link href="/products/new" className={buttonVariants()}>
              <Plus aria-hidden />
              {t("products.new")}
            </Link>
          )
        }
      />
      <ProductsTabs />

      <FilterBar action="/products" query={q} searchPlaceholder={t("products.searchPlaceholder")}>
        <NativeSelect name="category" defaultValue={categoryId ?? ""} aria-label={t("products.category")} className="sm:w-48">
          <option value="">{t("products.allCategories")}</option>
          {sortCategoryTree(categories).map((c) => (
            <option key={c.id} value={c.id}>
              {c.depth ? `— ${c.name}` : c.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="status" defaultValue={status} aria-label={t("products.statusLabel")} className="sm:w-40">
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`products.statusFilter.${s}`)}
            </option>
          ))}
        </NativeSelect>
        {canSeeStock && (
          <NativeSelect name="stock" defaultValue={stock ?? ""} aria-label={t("inventory.stockLabel")} className="sm:w-44">
            <option value="">{t("inventory.anyStock")}</option>
            <option value="low">{t("inventory.lowOnly")}</option>
            <option value="out">{t("inventory.outOnly")}</option>
          </NativeSelect>
        )}
      </FilterBar>

      <Card className="py-0">
        {products && products.length > 0 ? (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">{t("products.product")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("products.category")}</TableHead>
                  <TableHead className="text-right">{t("products.salePrice")}</TableHead>
                  {canSeeStock && <TableHead className="text-right">{t("inventory.onHand")}</TableHead>}
                  {canSeeStock && <TableHead className="hidden sm:table-cell pr-4">{t("inventory.statusLabel")}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="pl-4">
                      <Link href={`/products/${p.id}`} className="flex items-center gap-3 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                        <ProductThumb url={p.image_path ? images.get(p.image_path) : null} alt="" />
                        <span className="grid min-w-0">
                          <span className="truncate font-medium hover:underline">{p.name}</span>
                          <span className="truncate text-xs text-muted-foreground">
                            {p.sku}
                            {p.barcode ? ` · ${p.barcode}` : ""}
                          </span>
                        </span>
                        {!p.is_active && <Badge variant="secondary">{t("products.archivedBadge")}</Badge>}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {(p.category_id && categoryNames.get(p.category_id)) || "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(p.sale_price, locale)}</TableCell>
                    {canSeeStock && (
                      <TableCell className="text-right tabular-nums">
                        {p.track_inventory ? `${formatNumber(p.quantity, locale)} ${t(`units.${p.unit}`)}` : "—"}
                      </TableCell>
                    )}
                    {canSeeStock && (
                      <TableCell className="hidden pr-4 sm:table-cell">
                        <StockStatusBadge status={p.stock_status} />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination pathname="/products" params={params} page={page} pageSize={pageSize} total={count ?? 0} />
          </>
        ) : (
          <EmptyState
            icon={Package}
            title={filtered ? t("common.noResults") : t("products.emptyTitle")}
            description={filtered ? t("common.noResultsHint") : t("products.emptyDescription")}
            action={
              !filtered &&
              ctx.permissions.has("products.create") && (
                <Link href="/products/new" className={buttonVariants()}>
                  <Plus aria-hidden />
                  {t("products.new")}
                </Link>
              )
            }
          />
        )}
      </Card>
    </div>
  );
}
