import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/app/page-header";
import { requirePagePermission } from "@/lib/auth/session";
import { listCategories, listWarehouses, sortCategoryTree } from "@/lib/data/catalog";
import { uuidParam } from "@/lib/list-params";
import { signedProductImageUrls } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { productToInput } from "../../product-defaults";
import { ProductForm } from "../../product-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("products");
  return { title: t("edit") };
}

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePagePermission("products.update");
  const id = uuidParam((await params).id);
  if (!id) notFound();
  const t = await getTranslations("products");
  const supabase = await createClient();

  const [{ data: product }, categories, warehouses] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, sku, barcode, category_id, description, product_type, unit, purchase_price, sale_price, vat_rate, min_stock, track_inventory, default_warehouse_id, image_path")
      .eq("id", id)
      .eq("company_id", ctx.company.id)
      .is("deleted_at", null)
      .maybeSingle(),
    listCategories(supabase, ctx.company.id),
    listWarehouses(supabase, ctx.company.id, { activeOnly: true }),
  ]);
  if (!product) notFound();
  const images = await signedProductImageUrls(supabase, [product.image_path]);

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <PageHeader title={t("edit")} description={`${product.name} · ${product.sku}`} />
      <ProductForm
        productId={product.id}
        defaults={productToInput(product)}
        categories={sortCategoryTree(categories)}
        warehouses={warehouses}
        imageUrl={product.image_path ? (images.get(product.image_path) ?? null) : null}
        canAdjustStock={false}
      />
    </div>
  );
}
