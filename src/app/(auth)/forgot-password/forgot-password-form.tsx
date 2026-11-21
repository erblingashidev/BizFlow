"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, FormMessage } from "@/components/forms/form-field";
import { requestPasswordResetAction } from "@/lib/auth/actions";
import { applyActionErrors } from "@/lib/forms";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validation/auth";

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await requestPasswordResetAction(values);
      if (result.ok) {
        setSuccess(result.message ?? "auth.forgot.sent");
        return;
      }
      setFormError(applyActionErrors(result, form.setError));
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <FormMessage tone="error" message={formError} />
      <FormMessage tone="success" message={success} />
      <FormField label={t("email")} error={form.formState.errors.email?.message}>
        {(field) => <Input {...field} type="email" autoComplete="email" inputMode="email" {...form.register("email")} />}
      </FormField>
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {t("forgot.submit")}
      </Button>
    </form>
  );
}
