import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/forms/auth-card";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.login");
  return { title: t("title") };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const t = await getTranslations("auth.login");

  return (
    <AuthCard
      title={t("title")}
      description={t("subtitle")}
      footer={
        <span>
          {t("noAccount")}{" "}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            {t("signupLink")}
          </Link>
        </span>
      }
    >
      <LoginForm next={next} initialError={error === "link_invalid" ? "auth.login.linkInvalid" : null} />
    </AuthCard>
  );
}
