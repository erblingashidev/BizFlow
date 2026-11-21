"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { locales, type Locale } from "@/i18n/config";
import { setLocaleAction } from "@/lib/preferences/actions";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ className }: { className?: string }) {
  const t = useTranslations("common");
  const current = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const choose = (locale: Locale) => {
    if (locale === current) return;
    startTransition(async () => {
      await setLocaleAction(locale);
      router.refresh();
    });
  };

  return (
    <div
      role="group"
      aria-label={t("language")}
      className={cn("inline-flex items-center gap-1 rounded-lg border bg-card p-0.5 text-xs", className)}
    >
      <Languages className="ml-1.5 size-3.5 text-muted-foreground" aria-hidden />
      {locales.map((locale) => (
        <button
          key={locale}
          type="button"
          disabled={pending}
          onClick={() => choose(locale)}
          aria-pressed={locale === current}
          className={cn(
            "rounded-md px-2 py-1 font-medium uppercase transition-colors",
            locale === current
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <span className="sr-only">{t(`languages.${locale}`)}</span>
          <span aria-hidden>{locale}</span>
        </button>
      ))}
    </div>
  );
}
