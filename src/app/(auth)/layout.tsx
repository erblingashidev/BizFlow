import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { SetupNotice } from "@/components/setup-notice";
import { getPublicSupabaseEnv } from "@/lib/env";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("common");
  const configured = getPublicSupabaseEnv() !== null;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-4 py-4 sm:px-8">
        <Logo />
        <LanguageSwitcher />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-6 sm:items-center sm:pt-0">
        <div className="w-full max-w-md space-y-4">
          {!configured && <SetupNotice />}
          {children}
        </div>
      </main>
      <footer className="px-4 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} BizFlow · {t("tagline")}
      </footer>
    </div>
  );
}
