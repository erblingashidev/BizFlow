"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, FormMessage } from "@/components/forms/form-field";
import { updatePasswordAction } from "@/lib/auth/actions";
import { applyActionErrors } from "@/lib/forms";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validation/auth";

export function ResetPasswordForm() {
  const t = useTranslations("auth");
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await updatePasswordAction(values);
      setFormError(applyActionErrors(result, form.setError));
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <FormMessage tone="error" message={formError} />
      <FormField label={t("reset.newPassword")} error={errors.password?.message} hint={t("signup.passwordHint")}>
        {(field) => <Input {...field} type="password" autoComplete="new-password" {...form.register("password")} />}
      </FormField>
      <FormField label={t("confirmPassword")} error={errors.confirmPassword?.message}>
        {(field) => (
          <Input {...field} type="password" autoComplete="new-password" {...form.register("confirmPassword")} />
        )}
      </FormField>
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {t("reset.submit")}
      </Button>
    </form>
  );
}
