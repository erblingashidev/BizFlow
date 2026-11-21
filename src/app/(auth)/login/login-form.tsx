"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, FormMessage } from "@/components/forms/form-field";
import { signInAction } from "@/lib/auth/actions";
import { applyActionErrors } from "@/lib/forms";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";

export function LoginForm({ next, initialError }: { next?: string; initialError?: string | null }) {
  const t = useTranslations("auth");
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(initialError ?? null);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", next },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await signInAction(values);
      setFormError(applyActionErrors(result, form.setError));
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <FormMessage tone="error" message={formError} />
      <FormField label={t("email")} error={errors.email?.message}>
        {(field) => <Input {...field} type="email" autoComplete="email" inputMode="email" {...form.register("email")} />}
      </FormField>
      <FormField label={t("password")} error={errors.password?.message}>
        {(field) => <Input {...field} type="password" autoComplete="current-password" {...form.register("password")} />}
      </FormField>
      <div className="-mt-1 text-right text-sm">
        <Link href="/forgot-password" className="text-primary hover:underline">
          {t("login.forgot")}
        </Link>
      </div>
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {t("login.submit")}
      </Button>
    </form>
  );
}
