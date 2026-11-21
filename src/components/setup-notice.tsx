import { getTranslations } from "next-intl/server";
import { TriangleAlert } from "lucide-react";

export async function SetupNotice() {
  const t = await getTranslations("errors");
  return (
    <div className="rounded-xl border border-warning/50 bg-warning/10 p-4 text-sm text-warning-foreground">
      <p className="flex items-center gap-2 font-medium">
        <TriangleAlert className="size-4" aria-hidden />
        {t("notConfiguredTitle")}
      </p>
      <p className="mt-1 text-warning-foreground/80">{t("notConfigured")}</p>
    </div>
  );
}
