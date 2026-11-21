"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, FormMessage } from "@/components/forms/form-field";
import { signUpAction } from "@/lib/auth/actions";
import { applyActionErrors } from "@/lib/forms";
import { signupSchema, type SignupInput } from "@/lib/validation/auth";

export function SignupForm() {
  const t = useTranslations("auth");
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: "", email: "", password: "", confirmPassword: "" },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await signUpAction(values);
      if (result?.ok && result.data?.needsConfirmation) {
        setSentTo(values.email);
        return;
      }
      setFormError(applyActionErrors(result, form.setError));
    });
  });

  if (sentTo) {
    return (
      <div className="grid justify-items-center gap-3 py-4 text-center" role="status">
        <span className="grid size-12 place-items-center rounded-full bg-success/10 text-success">
          <MailCheck className="size-6" aria-hidden />
        </span>
        <p className="font-medium">{t("signup.checkEmailTitle")}</p>
        <p className="text-sm text-muted-foreground">{t("signup.checkEmail")}</p>
        <p className="text-sm font-medium">{sentTo}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <FormMessage tone="error" message={formError} />
      <FormField label={t("fullName")} error={errors.fullName?.message}>
        {(field) => <Input {...field} autoComplete="name" {...form.register("fullName")} />}
      </FormField>
      <FormField label={t("email")} error={errors.email?.message}>
        {(field) => <Input {...field} type="email" autoComplete="email" inputMode="email" {...form.register("email")} />}
      </FormField>
      <FormField label={t("password")} error={errors.password?.message} hint={t("signup.passwordHint")}>
        {(field) => <Input {...field} type="password" autoComplete="new-password" {...form.register("password")} />}
      </FormField>
      <FormField label={t("confirmPassword")} error={errors.confirmPassword?.message}>
        {(field) => (
          <Input {...field} type="password" autoComplete="new-password" {...form.register("confirmPassword")} />
        )}
      </FormField>
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {t("signup.submit")}
      </Button>
    </form>
  );
}
