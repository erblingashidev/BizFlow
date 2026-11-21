import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { MapPin, Power, PowerOff, Star, Trash2, Warehouse } from "lucide-react";
import { ActionButton } from "@/components/app/action-button";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePagePermission } from "@/lib/auth/session";
import { listWarehouses } from "@/lib/data/catalog";
import { formatCurrency, formatNumber } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { deleteWarehouseAction, setDefaultWarehouseAction, setWarehouseActiveAction } from "./actions";
import { WarehouseDialog } from "./warehouse-dialog";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("warehouses") };
}

export default async function WarehousesPage() {
  const ctx = await requirePagePermission("warehouses.view");
  const t = await getTranslations();
  const locale = await getLocale();
  const supabase = await createClient();
  const canSeeStock = ctx.permissions.has("inventory.view");
  const canUpdate = ctx.permissions.has("warehouses.update");

  const [warehouses, summary] = await Promise.all([
    listWarehouses(supabase, ctx.company.id),
    canSeeStock
      ? supabase.rpc("warehouse_stock_summary", { p_company_id: ctx.company.id }).then(({ data, error }) => {
          if (error) throw error;
          return data ?? [];
        })
      : Promise.resolve([]),
  ]);
  const totals = new Map(summary.map((s) => [s.warehouse_id, s]));

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <PageHeader
        title={t("nav.warehouses")}
        description={t("warehouses.subtitle")}
        actions={ctx.permissions.has("warehouses.create") && <WarehouseDialog />}
      />

      {warehouses.length === 0 ? (
        <Card>
          <EmptyState icon={Warehouse} title={t("warehouses.emptyTitle")} />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {warehouses.map((w) => {
            const s = totals.get(w.id);
            return (
              <Card key={w.id} className={w.isActive ? undefined : "opacity-70"}>
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2">
                    {w.name}
                    <Badge variant="outline" className="font-mono">
                      {w.code}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="flex items-center gap-1">
                    <MapPin className="size-3.5" aria-hidden />
                    {[w.address, w.city].filter(Boolean).join(", ") || t("warehouses.noAddress")}
                  </CardDescription>
                  {canUpdate && (
                    <CardAction>
                      <WarehouseDialog warehouse={w} />
                    </CardAction>
                  )}
                </CardHeader>
                <CardContent className="grid gap-3">
                  <div className="flex flex-wrap gap-2">
                    {w.isDefault && (
                      <Badge className="bg-primary/10 text-primary">
                        <Star aria-hidden />
                        {t("warehouses.default")}
                      </Badge>
                    )}
                    {!w.isActive && <Badge variant="secondary">{t("warehouses.inactive")}</Badge>}
                  </div>
                  {canSeeStock && (
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-muted-foreground">{t("warehouses.productsInStock")}</dt>
                        <dd className="text-lg font-semibold tabular-nums">{formatNumber(s?.product_count ?? 0, locale)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">{t("warehouses.stockValue")}</dt>
                        <dd className="text-lg font-semibold tabular-nums">{formatCurrency(s?.stock_value ?? 0, locale)}</dd>
                      </div>
                    </dl>
                  )}
                </CardContent>
                <CardFooter className="flex flex-wrap gap-2 border-t pt-3 pb-3">
                  {canSeeStock && (
                    <Link href={`/inventory?warehouse=${w.id}`} className="text-sm font-medium text-primary hover:underline">
                      {t("warehouses.viewStock")}
                    </Link>
                  )}
                  <div className="ml-auto flex gap-1">
                    {canUpdate && w.isActive && !w.isDefault && (
                      <ActionButton variant="ghost" action={setDefaultWarehouseAction.bind(null, w.id)}>
                        <Star aria-hidden />
                        {t("warehouses.makeDefault")}
                      </ActionButton>
                    )}
                    {canUpdate && !w.isDefault && (
                      <ActionButton
                        variant="ghost"
                        action={setWarehouseActiveAction.bind(null, w.id, !w.isActive)}
                        aria-label={w.isActive ? t("warehouses.deactivate") : t("warehouses.activate")}
                      >
                        {w.isActive ? <PowerOff aria-hidden /> : <Power aria-hidden />}
                        {w.isActive ? t("warehouses.deactivate") : t("warehouses.activate")}
                      </ActionButton>
                    )}
                    {ctx.permissions.has("warehouses.delete") && !w.isDefault && (
                      <ActionButton
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("common.delete")}
                        action={deleteWarehouseAction.bind(null, w.id)}
                        confirm={{
                          title: t("warehouses.deleteTitle", { name: w.name }),
                          description: t("warehouses.deleteDescription"),
                          confirmLabel: t("common.delete"),
                          destructive: true,
                        }}
                      >
                        <Trash2 className="text-destructive" aria-hidden />
                      </ActionButton>
                    )}
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
