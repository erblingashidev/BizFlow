"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { NativeSelect } from "@/components/app/native-select";
import { FormField, FormMessage } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { applyActionErrors } from "@/lib/forms";
import { savePartyAction } from "@/lib/parties/actions";
import { partySchema, type PartyData, type PartyInput, type PartyKind } from "@/lib/validation/party";

export function PartyForm({ kind, partyId, defaults }: { kind: PartyKind; partyId: string | null; defaults: PartyInput }) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<PartyInput, unknown, PartyData>({ resolver: zodResolver(partySchema), defaultValues: defaults });
  const { errors } = form.formState;
  const isCustomer = kind === "customer";
  const customerType = form.watch("customerType");
  const listPath = isCustomer ? "/customers" : "/suppliers";

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await savePartyAction(kind, partyId, values);
      const error = applyActionErrors(result, form.setError);
      if (!result.ok) {
        setFormError(error);
        return;
      }
      toast.success(t(partyId ? "parties.updated" : "parties.created"));
      router.push(listPath);
      router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6">
      <FormMessage tone="error" message={formError} />
      <Card>
        <CardHeader>
          <CardTitle>{t("parties.sectionIdentity")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {isCustomer && (
            <FormField label={t("parties.customerType")} error={errors.customerType?.message} className="sm:col-span-2">
              {(f) => (
                <NativeSelect {...f} {...form.register("customerType")} className="sm:w-64">
                  <option value="business">{t("parties.types.business")}</option>
                  <option value="individual">{t("parties.types.individual")}</option>
                </NativeSelect>
              )}
            </FormField>
          )}
          <FormField
            label={isCustomer && customerType === "individual" ? t("parties.fullName") : t("parties.name")}
            error={errors.name?.message}
            className="sm:col-span-2"
          >
            {(f) => <Input {...f} {...form.register("name")} autoComplete="off" />}
          </FormField>
          {(!isCustomer || customerType === "business") && (
            <>
              <FormField label={t("parties.businessNumber")} error={errors.businessNumber?.message} optional>
                {(f) => <Input {...f} {...form.register("businessNumber")} inputMode="numeric" />}
              </FormField>
              <FormField label={t("parties.vatNumber")} error={errors.vatNumber?.message} optional>
                {(f) => <Input {...f} {...form.register("vatNumber")} />}
              </FormField>
              <FormField label={t("parties.contactPerson")} error={errors.contactPerson?.message} optional className="sm:col-span-2">
                {(f) => <Input {...f} {...form.register("contactPerson")} autoComplete="off" />}
              </FormField>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("parties.sectionContact")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label={t("parties.email")} error={errors.email?.message} optional>
            {(f) => <Input {...f} {...form.register("email")} type="email" autoComplete="off" />}
          </FormField>
          <FormField label={t("parties.phone")} error={errors.phone?.message} optional>
            {(f) => <Input {...f} {...form.register("phone")} type="tel" placeholder="+383 44 000 000" />}
          </FormField>
          <FormField label={t("parties.address")} error={errors.address?.message} optional className="sm:col-span-2">
            {(f) => <Input {...f} {...form.register("address")} />}
          </FormField>
          <FormField label={t("parties.city")} error={errors.city?.message} optional>
            {(f) => <Input {...f} {...form.register("city")} />}
          </FormField>
          <FormField label={t("parties.country")} error={errors.countryCode?.message}>
            {(f) => (
              <NativeSelect {...f} {...form.register("countryCode")}>
                {["XK", "AL", "MK", "ME", "RS", "DE", "CH", "AT", "IT", "TR"].map((code) => (
                  <option key={code} value={code}>
                    {t(`countries.${code}`)}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <FormField label={t("parties.notes")} error={errors.notes?.message} optional className="sm:col-span-2">
            {(f) => <Textarea {...f} {...form.register("notes")} rows={3} />}
          </FormField>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {t("common.save")}
        </Button>
      </div>
    </form>
  );
}
