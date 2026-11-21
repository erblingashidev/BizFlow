import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations("errors");
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="grid max-w-md justify-items-center gap-4 text-center">
        <Logo />
        <p className="text-5xl font-semibold text-muted-foreground/40">404</p>
        <h1 className="text-xl font-semibold">{t("notFoundTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("notFound")}</p>
        <Link href="/dashboard" className={buttonVariants()}>
          {t("backHome")}
        </Link>
      </div>
    </div>
  );
}
