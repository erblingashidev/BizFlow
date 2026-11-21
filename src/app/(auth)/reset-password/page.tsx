import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/forms/auth-card";
import { getPublicSupabaseEnv } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth/session";
import { ResetPasswordForm } from "./reset-password-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.reset");
  return { title: t("title") };
}

/** Reached from the recovery email via /auth/confirm, which establishes the session. */
export default async function ResetPasswordPage() {
  const t = await getTranslations("auth.reset");
  const user = getPublicSupabaseEnv() ? await getCurrentUser() : null;

  if (!user) {
    return (
      <AuthCard title={t("title")}>
        <div className="grid gap-4 text-sm">
          <p className="text-muted-foreground">{t("expired")}</p>
          <Link href="/forgot-password" className="font-medium text-primary hover:underline">
            {t("requestNew")}
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t("title")} description={t("subtitle")}>
      <ResetPasswordForm />
    </AuthCard>
  );
}
