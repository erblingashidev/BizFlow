"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, FormMessage } from "@/components/forms/form-field";
import { applyActionErrors } from "@/lib/forms";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { companyOnboardingSchema, type CompanyOnboardingInput } from "@/lib/validation/company";
import { createCompanyAction } from "./actions";

export type PlanOption = {
  code: string;
  name: string;
  description: string | null;
  priceMonthly: number;
  currency: string;
  maxEmployees: number | null;
  trialDays: number;
};

export function OnboardingForm({ plans }: { plans: PlanOption[] }) {
  const t = useTranslations("onboarding");
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<CompanyOnboardingInput>({
    resolver: zodResolver(companyOnboardingSchema),
    defaultValues: { name: "", businessNumber: "", vatNumber: "", phone: "", city: "", address: "", planCode: "starter" },
  });
  const { errors } = form.formState;
  const selectedPlan = form.watch("planCode");
  const trialDays = plans.find((p) => p.code === selectedPlan)?.trialDays ?? 14;

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await createCompanyAction(values);
      setFormError(applyActionErrors(result, form.setError));
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6">
      <FormMessage tone="error" message={formError} />

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={t("companyName")} error={errors.name?.message} className="sm:col-span-2">
          {(field) => (
            <Input {...field} placeholder={t("companyNamePlaceholder")} autoComplete="organization" {...form.register("name")} />
          )}
        </FormField>
        <FormField label={t("businessNumber")} error={errors.businessNumber?.message} optional>
          {(field) => <Input {...field} inputMode="numeric" {...form.register("businessNumber")} />}
        </FormField>
        <FormField label={t("vatNumber")} error={errors.vatNumber?.message} optional>
          {(field) => <Input {...field} {...form.register("vatNumber")} />}
        </FormField>
        <FormField label={t("phone")} error={errors.phone?.message} optional>
          {(field) => <Input {...field} type="tel" autoComplete="tel" placeholder="+383 44 000 000" {...form.register("phone")} />}
        </FormField>
        <FormField label={t("city")} error={errors.city?.message} optional>
          {(field) => <Input {...field} autoComplete="address-level2" {...form.register("city")} />}
        </FormField>
        <FormField label={t("address")} error={errors.address?.message} optional className="sm:col-span-2">
          {(field) => <Input {...field} autoComplete="street-address" {...form.register("address")} />}
        </FormField>
      </div>

      <fieldset className="grid gap-3">
        <legend className="mb-2 text-sm font-medium">{t("plan")}</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {plans.map((plan) => {
            const selected = plan.code === selectedPlan;
            return (
              <label
                key={plan.code}
                className={cn(
                  "relative flex cursor-pointer flex-col gap-1 rounded-xl border bg-card p-4 transition-colors",
                  "has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                  selected ? "border-primary bg-accent/50" : "hover:border-primary/40",
                )}
              >
                <input type="radio" value={plan.code} className="sr-only" {...form.register("planCode")} />
                {selected && (
                  <span className="absolute right-3 top-3 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3" aria-hidden />
                  </span>
                )}
                <span className="font-semibold">{plan.name}</span>
                <span className="text-2xl font-semibold tabular-nums">
                  {formatCurrency(plan.priceMonthly, locale, plan.currency)}
                  <span className="text-sm font-normal text-muted-foreground">{t("perMonth")}</span>
                </span>
                {plan.maxEmployees !== null && (
                  <span className="text-sm text-muted-foreground">{t("employees", { count: plan.maxEmployees })}</span>
                )}
              </label>
            );
          })}
        </div>
        {errors.planCode?.message && <FormMessage tone="error" message={errors.planCode.message} />}
        <p className="text-sm text-muted-foreground">{t("trialNote", { days: trialDays })}</p>
      </fieldset>

      <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto sm:justify-self-end">
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {t("submit")}
      </Button>
    </form>
  );
}
