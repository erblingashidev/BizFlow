import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Circle,
  ClipboardList,
  History,
  Package,
  Receipt,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { StatCard } from "@/components/app/stat-card";
import { StockStatusBadge } from "@/components/app/stock-status-badge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePagePermission } from "@/lib/auth/session";
import { formatCalendarDate, formatCurrency, formatDate, formatDateTime, formatNumber, toNumber } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { MonthlyChart, type MonthlyPoint } from "./monthly-chart";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("dashboard") };
}

type Summary = {
  products: number;
  customers: number;
  suppliers: number;
  stock_value: number | string;
  low_stock: number;
  sales_month: number | string;
  sales_orders_month: number;
  purchases_month: number | string;
  expenses_month: number | string;
  pending_sales: number;
  pending_purchases: number;
  monthly: { month: string; sales: number | string; purchases: number | string }[];
};

type Transaction = {
  id: string;
  kind: "sale" | "purchase";
  number: string;
  party: string | null;
  date: string;
  createdAt: string;
  status: string;
  total: number;
};

export default async function DashboardPage() {
  const ctx = await requirePagePermission("dashboard.view");
  const t = await getTranslations();
  const locale = await getLocale();
  const supabase = await createClient();
  const companyId = ctx.company.id;
  const can = (p: string) => ctx.permissions.has(p as never);
  const canSales = can("sales.view");
  const canPurchases = can("purchases.view");
  const canInventory = can("inventory.view");

  const [summaryRes, salesRes, purchasesRes, lowRes, activityRes, movementsRes, membersRes] = await Promise.all([
    supabase.rpc("dashboard_summary", { p_company_id: companyId }),
    canSales
      ? supabase
          .from("sales_orders")
          .select("id, order_number, order_date, created_at, status, total, customer:customers(name)")
          .eq("company_id", companyId)
          .is("deleted_at", null)
          .order("order_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(6)
      : null,
    canPurchases
      ? supabase
          .from("purchase_orders")
          .select("id, order_number, order_date, created_at, status, total, supplier:suppliers(name)")
          .eq("company_id", companyId)
          .is("deleted_at", null)
          .order("order_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(6)
      : null,
    canInventory
      ? supabase
          .from("product_stock_overview")
          .select("id, name, sku, unit, quantity, min_stock, stock_status")
          .eq("company_id", companyId)
          .eq("needs_reorder", true)
          .order("quantity")
          .limit(6)
      : null,
    supabase
      .from("activity_logs")
      .select("id, action, entity_type, entity_id, metadata, created_at, user:profiles(full_name, email)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(8),
    canInventory
      ? supabase.from("stock_movements").select("id", { count: "exact", head: true }).eq("company_id", companyId)
      : null,
    supabase.from("company_members").select("user_id", { count: "exact", head: true }).eq("company_id", companyId),
  ]);
  if (summaryRes.error) throw summaryRes.error;
  const s = summaryRes.data as unknown as Summary;

  const transactions: Transaction[] = [
    ...(salesRes?.data ?? []).map((o) => ({
      id: o.id,
      kind: "sale" as const,
      number: o.order_number,
      party: o.customer?.name ?? null,
      date: o.order_date,
      createdAt: o.created_at,
      status: o.status,
      total: toNumber(o.total),
    })),
    ...(purchasesRes?.data ?? []).map((o) => ({
      id: o.id,
      kind: "purchase" as const,
      number: o.order_number,
      party: o.supplier?.name ?? null,
      date: o.order_date,
      createdAt: o.created_at,
      status: o.status,
      total: toNumber(o.total),
    })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6);

  const monthly: MonthlyPoint[] = s.monthly.map((m) => ({
    label: t(`months.${m.month.slice(5)}`),
    sales: toNumber(m.sales),
    purchases: toNumber(m.purchases),
  }));
  const hasMonthlyData = monthly.some((m) => m.sales > 0 || m.purchases > 0);

  const firstName = (ctx.user.user_metadata?.full_name as string | undefined)?.split(" ")[0] ?? ctx.user.email ?? "";
  const sub = ctx.subscription;
  const steps = [
    { label: t("dashboard.stepCompany"), done: true, href: null },
    { label: t("dashboard.stepProducts"), done: s.products > 0, href: "/products/new" },
    {
      label: t("dashboard.stepInventory"),
      done: (movementsRes?.count ?? 0) > 0,
      href: "/inventory",
    },
    { label: t("dashboard.stepTeam"), done: (membersRes.count ?? 0) > 1, href: null },
  ];
  const showSteps = can("employees.manage") && steps.some((step) => !step.done);
  const lowStock = lowRes?.data ?? [];
  const activity = activityRes.data ?? [];
  const unlabeledProductIds = [
    ...new Set(
      activity
        .filter(
          (a) => a.entity_type === "product" && a.entity_id && !(a.metadata as Record<string, unknown> | null)?.label,
        )
        .map((a) => a.entity_id as string),
    ),
  ];
  const productNames = new Map<string, string>();
  if (unlabeledProductIds.length > 0) {
    const { data } = await supabase.from("products").select("id, name").in("id", unlabeledProductIds);
    for (const p of data ?? []) productNames.set(p.id, p.name);
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("dashboard.welcome", { name: firstName })}</h1>
          <p className="text-sm text-muted-foreground">{t("dashboard.subtitle", { company: ctx.company.name })}</p>
        </div>
        {sub && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant={sub.status === "past_due" ? "destructive" : "secondary"}>
              {t(`subscription.status.${sub.status}`)}
            </Badge>
            <span className="text-muted-foreground">
              {sub.status === "trialing" && sub.trialEndsAt
                ? t("subscription.trialEnds", { date: formatDate(sub.trialEndsAt, locale) })
                : t("subscription.plan", { name: sub.planName })}
            </span>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {canSales && (
          <StatCard
            label={t("dashboard.salesThisMonth")}
            value={formatCurrency(s.sales_month, locale)}
            hint={t("dashboard.ordersCount", { count: s.sales_orders_month })}
            icon={ShoppingCart}
            tone="success"
          />
        )}
        {canPurchases && (
          <StatCard
            label={t("dashboard.purchasesThisMonth")}
            value={formatCurrency(s.purchases_month, locale)}
            hint={
              can("expenses.view")
                ? t("dashboard.expensesHint", { amount: formatCurrency(s.expenses_month, locale) })
                : undefined
            }
            icon={Truck}
            tone="primary"
          />
        )}
        {canInventory && (
          <>
            <StatCard
              label={t("dashboard.stockValue")}
              value={formatCurrency(s.stock_value, locale)}
              hint={t("dashboard.atPurchasePrice")}
              icon={Boxes}
              tone="muted"
              href="/inventory/report"
            />
            <StatCard
              label={t("dashboard.lowStock")}
              value={formatNumber(s.low_stock, locale)}
              hint={t("dashboard.lowStockHint")}
              icon={AlertTriangle}
              tone={s.low_stock > 0 ? "destructive" : "muted"}
              href="/inventory?stock=low"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {canSales && (
          <MiniStat
            icon={ClipboardList}
            label={t("dashboard.pendingSales")}
            value={formatNumber(s.pending_sales, locale)}
          />
        )}
        {canPurchases && (
          <MiniStat
            icon={ClipboardList}
            label={t("dashboard.pendingPurchases")}
            value={formatNumber(s.pending_purchases, locale)}
          />
        )}
        <MiniStat
          icon={Package}
          label={t("dashboard.products")}
          value={formatNumber(s.products, locale)}
          href="/products"
        />
        {can("customers.view") && (
          <MiniStat
            icon={Users}
            label={t("nav.customers")}
            value={formatNumber(s.customers, locale)}
            href="/customers"
          />
        )}
        {can("suppliers.view") && (
          <MiniStat
            icon={Receipt}
            label={t("nav.suppliers")}
            value={formatNumber(s.suppliers, locale)}
            href="/suppliers"
          />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {(canSales || canPurchases) && (
          <Card className={cn(canInventory ? "lg:col-span-2" : "lg:col-span-3")}>
            <CardHeader>
              <CardTitle>{t("dashboard.monthlySales")}</CardTitle>
              <CardDescription>{t("dashboard.monthlySalesSubtitle")}</CardDescription>
            </CardHeader>
            <CardContent>
              {hasMonthlyData ? (
                <MonthlyChart
                  data={monthly}
                  salesLabel={t("dashboard.sales")}
                  purchasesLabel={t("dashboard.purchases")}
                  showPurchases={canPurchases}
                />
              ) : (
                <EmptyState
                  icon={ShoppingCart}
                  title={t("dashboard.noSalesYet")}
                  description={t("dashboard.noSalesYetHint")}
                />
              )}
            </CardContent>
          </Card>
        )}

        {canInventory && (
          <Card className={cn(!(canSales || canPurchases) && "lg:col-span-3")}>
            <CardHeader>
              <CardTitle>{t("dashboard.lowStockAlerts")}</CardTitle>
              <CardAction>
                <Link href="/inventory?stock=low" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                  {t("dashboard.viewAll")}
                  <ArrowRight aria-hidden />
                </Link>
              </CardAction>
            </CardHeader>
            <CardContent>
              {lowStock.length > 0 ? (
                <ul className="grid gap-3">
                  {lowStock.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                      <Link href={`/products/${p.id}`} className="grid min-w-0">
                        <span className="truncate font-medium hover:underline">{p.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {t("dashboard.stockOfMin", {
                            qty: formatNumber(p.quantity, locale),
                            min: formatNumber(p.min_stock, locale),
                            unit: t(`units.${p.unit}`),
                          })}
                        </span>
                      </Link>
                      <StockStatusBadge status={p.stock_status ?? "ok"} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="size-4 text-success" aria-hidden />
                  {t("dashboard.noLowStock")}
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("dashboard.recentTransactions")}</CardTitle>
          </CardHeader>
          <CardContent>
            {transactions.length > 0 ? (
              <ul className="divide-y">
                {transactions.map((tx) => (
                  <li
                    key={`${tx.kind}-${tx.id}`}
                    className="flex items-center gap-3 py-2.5 text-sm first:pt-0 last:pb-0"
                  >
                    <span
                      className={cn(
                        "grid size-8 shrink-0 place-items-center rounded-lg",
                        tx.kind === "sale" ? "bg-success/10 text-success" : "bg-primary/10 text-primary",
                      )}
                    >
                      {tx.kind === "sale" ? (
                        <ShoppingCart className="size-4" aria-hidden />
                      ) : (
                        <Truck className="size-4" aria-hidden />
                      )}
                    </span>
                    <div className="grid min-w-0 flex-1">
                      <span className="truncate font-medium">
                        {tx.number}
                        {tx.party && <span className="font-normal text-muted-foreground"> · {tx.party}</span>}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {t(tx.kind === "sale" ? "dashboard.sale" : "dashboard.purchase")} ·{" "}
                        {formatCalendarDate(tx.date, locale)}
                      </span>
                    </div>
                    <Badge variant="outline">{t(`orderStatus.${tx.status}`)}</Badge>
                    <span className="w-28 text-right font-medium tabular-nums">{formatCurrency(tx.total, locale)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={Wallet}
                title={t("dashboard.noTransactions")}
                description={t("dashboard.noTransactionsHint")}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.recentActivity")}</CardTitle>
          </CardHeader>
          <CardContent>
            {activity.length > 0 ? (
              <ol className="grid gap-3">
                {activity.map((a) => {
                  const meta = (a.metadata ?? {}) as Record<string, unknown>;
                  const label =
                    typeof meta.label === "string"
                      ? meta.label
                      : typeof meta.name === "string"
                        ? meta.name
                        : (a.entity_id && productNames.get(a.entity_id)) || null;
                  const key = `activity.actions.${a.action}`;
                  return (
                    <li key={a.id} className="grid gap-0.5 text-sm">
                      <span>
                        <span className="font-medium">
                          {a.user?.full_name || a.user?.email || t("dashboard.someone")}
                        </span>{" "}
                        <span className="text-muted-foreground">{t.has(key) ? t(key) : a.action}</span>
                        {label && <span className="font-medium"> {label}</span>}
                      </span>
                      <span className="text-xs text-muted-foreground">{formatDateTime(a.created_at, locale)}</span>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <History className="size-4" aria-hidden />
                {t("dashboard.noActivity")}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {showSteps && (
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.gettingStarted")}</CardTitle>
            <CardDescription>{t("dashboard.gettingStartedSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="grid gap-3 sm:grid-cols-2">
              {steps.map((step) => (
                <li key={step.label} className="flex items-center gap-3 text-sm">
                  {step.done ? (
                    <CheckCircle2 className="size-5 text-success" aria-hidden />
                  ) : (
                    <Circle className="size-5 text-muted-foreground/50" aria-hidden />
                  )}
                  {!step.done && step.href ? (
                    <Link href={step.href} className="font-medium text-primary hover:underline">
                      {step.label}
                    </Link>
                  ) : (
                    <span className={cn(step.done && "text-muted-foreground line-through")}>{step.label}</span>
                  )}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof Package;
  label: string;
  value: string;
  href?: string;
}) {
  const body = (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border bg-card px-4 py-3",
        href && "transition-colors hover:bg-muted/50",
      )}
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="grid min-w-0">
        <span className="line-clamp-2 text-xs leading-tight text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">{value}</span>
      </div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
