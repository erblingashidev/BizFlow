import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCompanyContext, requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm, type PlanOption } from "./onboarding-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("onboarding");
  return { title: t("title") };
}

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const user = await requireUser();
  const { new: addAnother } = await searchParams;

  if (!addAnother && (await getCompanyContext())) redirect("/dashboard");

  const t = await getTranslations("onboarding");
  const supabase = await createClient();
  const { data: plans, error } = await supabase
    .from("subscription_plans")
    .select("code, name, description, price_monthly, currency, max_employees, trial_days")
    .eq("is_active", true)
    .eq("is_public", true)
    .order("sort_order");
  if (error) throw error;

  const planOptions: PlanOption[] = (plans ?? []).map((p) => ({
    code: p.code,
    name: p.name,
    description: p.description,
    priceMonthly: Number(p.price_monthly),
    currency: p.currency,
    maxEmployees: p.max_employees,
    trialDays: p.trial_days,
  }));

  return (
    <div className="min-h-dvh">
      <header className="flex items-center justify-between px-4 py-4 sm:px-8">
        <Logo />
        <LanguageSwitcher />
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 pb-16">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">{t("title")}</CardTitle>
            <CardDescription>
              {t("subtitle")} {t("signedInAs", { email: user.email ?? "" })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OnboardingForm plans={planOptions} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
