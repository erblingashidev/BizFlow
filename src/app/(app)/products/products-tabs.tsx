import { getTranslations } from "next-intl/server";
import { SectionTabs } from "@/components/app/section-tabs";

export async function ProductsTabs() {
  const t = await getTranslations();
  return (
    <SectionTabs
      label={t("nav.products")}
      tabs={[
        { href: "/products", label: t("nav.products"), exact: true },
        { href: "/products/categories", label: t("categories.title") },
      ]}
    />
  );
}
