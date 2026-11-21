import { getTranslations } from "next-intl/server";
import { SectionTabs } from "@/components/app/section-tabs";

export async function InventoryTabs() {
  const t = await getTranslations("inventory");
  return (
    <SectionTabs
      label={t("title")}
      tabs={[
        { href: "/inventory", label: t("tabs.stock"), exact: true },
        { href: "/inventory/movements", label: t("tabs.movements") },
        { href: "/inventory/report", label: t("tabs.report") },
      ]}
    />
  );
}
