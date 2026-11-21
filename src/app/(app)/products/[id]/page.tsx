import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Archive, ArchiveRestore, History, Pencil, Trash2 } from "lucide-react";
import { ActionButton } from "@/components/app/action-button";
import { PageHeader } from "@/components/app/page-header";
import { ProductThumb } from "@/components/app/product-thumb";
import { StockStatusBadge } from "@/components/app/stock-status-badge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePagePermission } from "@/lib/auth/session";
import { listWarehouses } from "@/lib/data/catalog";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { uuidParam } from "@/lib/list-params";
import { signedProductImageUrls } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { stockKindsFor } from "../../inventory/kinds";
import { MovementsTable } from "../../inventory/movements-table";
import { StockOperationDialog } from "../../inventory/stock-operation-dialog";
import { deleteProductAction, setProductActiveAction } from "../actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("products") };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePagePermission("products.view");
  const id = uuidParam((await params).id);
  if (!id) notFound();
  const t = await getTranslations();
  const locale = await getLocale();
  const supabase = await createClient();
  const can = (p: Parameters<typeof ctx.permissions.has>[0]) => ctx.permissions.has(p);
  const canSeeStock = can("inventory.view");

  const { data: product } = await supabase
    .from("product_stock_overview")
    .select("*")
    .eq("id", id)
    .eq("company_id", ctx.company.id)
    .maybeSingle();
  if (!product) notFound();

  const [{ data: details }, warehouses, { data: levels }, { data: movements }, images] = await Promise.all([
    supabase
      .from("products")
      .select("description, product_categories(name)")
      .eq("id", id)
      .eq("company_id", ctx.company.id)
      .single(),
    listWarehouses(supabase, ctx.company.id),
    canSeeStock
      ? supabase.from("stock_levels").select("warehouse_id, quantity").eq("company_id", ctx.company.id).eq("product_id", id)
      : Promise.resolve({ data: [] as { warehouse_id: string; quantity: number }[] }),
    canSeeStock
      ? supabase
          .from("stock_movements")
          .select("id, created_at, movement_type, quantity, balance_after, note, warehouse_id, creator:profiles(full_name, email)")
          .eq("company_id", ctx.company.id)
          .eq("product_id", id)
          .order("created_at", { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] }),
    signedProductImageUrls(supabase, [product.image_path]),
  ]);

  const warehouseNames = new Map(warehouses.map((w) => [w.id, w.name]));
  const levelMap = new Map((levels ?? []).map((l) => [l.warehouse_id, Number(l.quantity)]));
  const sale = Number(product.sale_price);
  const purchase = Number(product.purchase_price);
  const margin = sale > 0 ? Math.round(((sale - purchase) / sale) * 1000) / 10 : null;
  const unit = t(`units.${product.unit}`);
  const activeWarehouses = warehouses.filter((w) => w.isActive);
  const kinds = stockKindsFor(ctx.permissions, activeWarehouses.length);
  const productOption = {
    id: product.id,
    name: product.name,
    sku: product.sku,
    unit: product.unit,
    defaultWarehouseId: product.default_warehouse_id,
    purchasePrice: purchase,
  };

  const facts: [string, React.ReactNode][] = [
    [t("products.sku"), product.sku],
    [t("products.barcode"), product.barcode || "—"],
    [t("products.category"), details?.product_categories?.name ?? "—"],
    [t("products.type"), t(`products.types.${product.product_type}`)],
    [t("products.purchasePrice"), formatCurrency(purchase, locale)],
    [t("products.salePrice"), formatCurrency(sale, locale)],
    [t("products.vatRate"), formatPercent(product.vat_rate, locale)],
    [t("products.marginLabel"), margin !== null ? formatPercent(margin, locale) : "—"],
  ];
  if (product.track_inventory) {
    facts.push(
      [t("products.minStock"), `${formatNumber(product.min_stock, locale)} ${unit}`],
      [t("products.defaultWarehouse"), (product.default_warehouse_id && warehouseNames.get(product.default_warehouse_id)) || "—"],
    );
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {product.name}
            {!product.is_active && <Badge variant="secondary">{t("products.archivedBadge")}</Badge>}
          </span>
        }
        description={product.sku}
        actions={
          <>
            {product.track_inventory && product.is_active && kinds.length > 0 && activeWarehouses.length > 0 && (
              <StockOperationDialog
                warehouses={activeWarehouses}
                kinds={kinds}
                product={productOption}
                triggerLabel={t("inventory.recordMovement")}
              />
            )}
            {can("products.update") && (
              <Link href={`/products/${product.id}/edit`} className={buttonVariants({ variant: "outline" })}>
                <Pencil aria-hidden />
                {t("common.edit")}
              </Link>
            )}
            {can("products.update") && (
              <ActionButton
                size="default"
                action={setProductActiveAction.bind(null, product.id, !product.is_active)}
                confirm={
                  product.is_active
                    ? { title: t("products.archiveTitle"), description: t("products.archiveDescription"), confirmLabel: t("products.archive") }
                    : undefined
                }
              >
                {product.is_active ? <Archive aria-hidden /> : <ArchiveRestore aria-hidden />}
                {product.is_active ? t("products.archive") : t("products.restore")}
              </ActionButton>
            )}
            {can("products.delete") && (
              <ActionButton
                size="default"
                variant="destructive"
                action={deleteProductAction.bind(null, product.id)}
                redirectTo="/products"
                confirm={{
                  title: t("products.deleteTitle"),
                  description: t("products.deleteDescription"),
                  confirmLabel: t("common.delete"),
                  destructive: true,
                }}
              >
                <Trash2 aria-hidden />
                {t("common.delete")}
              </ActionButton>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardContent className="grid gap-4">
            <ProductThumb
              url={product.image_path ? images.get(product.image_path) : null}
              alt={product.name}
              className="aspect-square size-auto w-full rounded-xl [&_svg]:size-10"
            />
            {canSeeStock && product.track_inventory && (
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">{t("inventory.onHand")}</p>
                  <p className="text-2xl font-semibold tabular-nums">
                    {formatNumber(product.quantity, locale)} <span className="text-base font-normal text-muted-foreground">{unit}</span>
                  </p>
                </div>
                <StockStatusBadge status={product.stock_status} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("products.details")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              {facts.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 border-b pb-2 sm:block sm:border-0 sm:pb-0">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-medium tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
            {details?.description && <p className="whitespace-pre-line text-sm text-muted-foreground">{details.description}</p>}
          </CardContent>
        </Card>
      </div>

      {canSeeStock && product.track_inventory && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="py-0">
            <CardHeader className="pt-4">
              <CardTitle>{t("inventory.byWarehouse")}</CardTitle>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">{t("inventory.warehouse")}</TableHead>
                  <TableHead className="pr-4 text-right">{t("inventory.quantity")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {warehouses
                  .filter((w) => w.isActive || levelMap.has(w.id))
                  .map((w) => (
                    <TableRow key={w.id}>
                      <TableCell className="pl-4">{w.name}</TableCell>
                      <TableCell className="pr-4 text-right tabular-nums">{formatNumber(levelMap.get(w.id) ?? 0, locale)}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="pl-4">{t("common.total")}</TableCell>
                  <TableCell className="pr-4 text-right tabular-nums">{formatNumber(product.quantity, locale)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </Card>

          <Card className="py-0 lg:col-span-2">
            <CardHeader className="pt-4">
              <CardTitle>{t("inventory.recentMovements")}</CardTitle>
              <CardAction>
                <Link href={`/inventory/movements?product=${product.id}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                  <History aria-hidden />
                  {t("inventory.fullHistory")}
                </Link>
              </CardAction>
            </CardHeader>
            {movements && movements.length > 0 ? (
              <MovementsTable rows={movements} warehouseNames={warehouseNames} showProduct={false} />
            ) : (
              <p className="px-4 pb-6 text-sm text-muted-foreground">{t("inventory.noMovements")}</p>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
