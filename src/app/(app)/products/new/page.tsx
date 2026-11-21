import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/app/page-header";
import { requirePagePermission } from "@/lib/auth/session";
import { listCategories, listWarehouses, sortCategoryTree } from "@/lib/data/catalog";
import { createClient } from "@/lib/supabase/server";
import { emptyProduct } from "../product-defaults";
import { ProductForm } from "../product-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("products");
  return { title: t("new") };
}

export default async function NewProductPage() {
  const ctx = await requirePagePermission("products.create");
  const t = await getTranslations("products");
  const supabase = await createClient();
  const [categories, warehouses] = await Promise.all([
    listCategories(supabase, ctx.company.id),
    listWarehouses(supabase, ctx.company.id, { activeOnly: true }),
  ]);
  const defaultWarehouse = warehouses.find((w) => w.isDefault) ?? warehouses[0];

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <PageHeader title={t("new")} description={t("newSubtitle")} />
      <ProductForm
        productId={null}
        defaults={emptyProduct(defaultWarehouse?.id ?? null)}
        categories={sortCategoryTree(categories)}
        warehouses={warehouses}
        imageUrl={null}
        canAdjustStock={ctx.permissions.has("inventory.adjust")}
      />
    </div>
  );
}
