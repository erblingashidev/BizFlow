import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { AlertTriangle, CheckCircle2, Circle, Package, TrendingDown, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePagePermission } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("dashboard") };
}

function StatCard({ label, icon: Icon, tone }: { label: string; icon: LucideIcon; tone: "primary" | "success" | "destructive" | "muted" }) {
  return (
    <Card size="sm">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardDescription className="font-medium">{label}</CardDescription>
        <span
          className={cn(
            "grid size-8 place-items-center rounded-lg",
            tone === "primary" && "bg-primary/10 text-primary",
            tone === "success" && "bg-success/10 text-success",
            tone === "destructive" && "bg-destructive/10 text-destructive",
            tone === "muted" && "bg-muted text-muted-foreground",
          )}
        >
          <Icon className="size-4" aria-hidden />
        </span>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums text-muted-foreground/60">—</p>
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const context = await requirePagePermission("dashboard.view");
  const t = await getTranslations();
  const locale = await getLocale();
  const firstName =
    (context.user.user_metadata?.full_name as string | undefined)?.split(" ")[0] ?? context.user.email ?? "";
  const sub = context.subscription;

  const steps = [
    { label: t("dashboard.stepCompany"), done: true },
    { label: t("dashboard.stepProducts"), done: false },
    { label: t("dashboard.stepInventory"), done: false },
    { label: t("dashboard.stepTeam"), done: false },
  ];

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("dashboard.welcome", { name: firstName })}</h1>
          <p className="text-sm text-muted-foreground">{t("dashboard.subtitle", { company: context.company.name })}</p>
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
        <StatCard label={t("dashboard.salesThisMonth")} icon={TrendingUp} tone="success" />
        <StatCard label={t("dashboard.expensesThisMonth")} icon={TrendingDown} tone="primary" />
        <StatCard label={t("dashboard.lowStock")} icon={AlertTriangle} tone="destructive" />
        <StatCard label={t("dashboard.products")} icon={Package} tone="muted" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("dashboard.gettingStarted")}</CardTitle>
            <CardDescription>{t("dashboard.gettingStartedSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="grid gap-3">
              {steps.map((step) => (
                <li key={step.label} className="flex items-center gap-3 text-sm">
                  {step.done ? (
                    <CheckCircle2 className="size-5 text-success" aria-hidden />
                  ) : (
                    <Circle className="size-5 text-muted-foreground/50" aria-hidden />
                  )}
                  <span className={cn(step.done && "text-muted-foreground line-through")}>{step.label}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.companyDetails")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{t("dashboard.yourRole")}</dt>
                <dd className="font-medium">{t(`roles.${context.role}`)}</dd>
              </div>
              {sub && (
                <>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{t("dashboard.planLabel")}</dt>
                    <dd className="font-medium">{sub.planName}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{t("dashboard.seats")}</dt>
                    <dd className="font-medium tabular-nums">{sub.maxEmployees ?? t("dashboard.unlimited")}</dd>
                  </div>
                </>
              )}
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
