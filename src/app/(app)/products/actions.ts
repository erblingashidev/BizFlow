"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { invalidInput, type ActionResult } from "@/lib/actions";
import { companyAction, failFromDb } from "@/lib/server-action";
import { detectImageType, isProductImagePath, MAX_PRODUCT_IMAGE_BYTES, productImagePath } from "@/lib/images";
import { sanitizeSearch } from "@/lib/list-params";
import { productSchema, type ProductInput } from "@/lib/validation/catalog";

const PRODUCT_IMAGES_BUCKET = "product-images";

function revalidateCatalog() {
  revalidatePath("/", "layout");
}

export async function saveProductAction(
  id: string | null,
  input: ProductInput,
): Promise<ActionResult<{ id: string; warning?: string }>> {
  return companyAction<{ id: string; warning?: string }>(id ? "products.update" : "products.create", async (ctx, supabase) => {
    const parsed = productSchema.safeParse(input);
    if (!parsed.success) return invalidInput(parsed.error);
    const data = parsed.data;

    const row = {
      name: data.name,
      sku: data.sku,
      barcode: data.barcode,
      category_id: data.categoryId,
      description: data.description,
      product_type: data.productType,
      unit: data.unit,
      purchase_price: data.purchasePrice,
      sale_price: data.salePrice,
      vat_rate: data.vatRate,
      min_stock: data.minStock,
      track_inventory: data.trackInventory,
      default_warehouse_id: data.defaultWarehouseId,
    };

    if (id) {
      const { data: updated, error } = await supabase
        .from("products")
        .update(row)
        .eq("id", id)
        .eq("company_id", ctx.company.id)
        .is("deleted_at", null)
        .select("id")
        .maybeSingle();
      if (error) return failFromDb(error, "update product");
      if (!updated) return { ok: false, error: "errors.notFound" };
      revalidateCatalog();
      return { ok: true, data: { id: updated.id } };
    }

    if (data.openingQuantity !== undefined && !ctx.permissions.has("inventory.adjust")) {
      return { ok: false, error: "errors.invalidInput", fieldErrors: { openingQuantity: "products.errors.openingForbidden" } };
    }

    const { data: created, error } = await supabase
      .from("products")
      .insert({ ...row, company_id: ctx.company.id })
      .select("id")
      .single();
    if (error) return failFromDb(error, "create product");

    let warning: string | undefined;
    if (data.openingQuantity !== undefined && data.openingWarehouseId) {
      const { error: stockError } = await supabase.rpc("record_stock_movement", {
        p_company_id: ctx.company.id,
        p_product_id: created.id,
        p_warehouse_id: data.openingWarehouseId,
        p_movement_type: "in",
        p_quantity: data.openingQuantity,
        p_unit_cost: data.purchasePrice,
        p_note: (await getTranslations("inventory"))("openingNote"),
      });
      if (stockError) {
        console.error("opening stock failed", stockError.code, stockError.message);
        warning = "products.errors.openingFailed";
      }
    }

    revalidateCatalog();
    return { ok: true, data: { id: created.id, warning } };
  });
}

export async function setProductActiveAction(id: string, active: boolean): Promise<ActionResult> {
  return companyAction("products.update", async (ctx, supabase) => {
    const { data, error } = await supabase
      .from("products")
      .update({ is_active: active })
      .eq("id", id)
      .eq("company_id", ctx.company.id)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error) return failFromDb(error, "archive product");
    if (!data) return { ok: false, error: "errors.notFound" };
    revalidateCatalog();
    return { ok: true, message: active ? "products.restored" : "products.archived" };
  });
}

export async function deleteProductAction(id: string): Promise<ActionResult> {
  return companyAction("products.delete", async (ctx, supabase) => {
    const { data, error } = await supabase
      .from("products")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("company_id", ctx.company.id)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error) return failFromDb(error, "delete product");
    if (!data) return { ok: false, error: "errors.notFound" };
    revalidateCatalog();
    return { ok: true, message: "products.deleted" };
  });
}

/**
 * Stores an uploaded image at {company}/products/{product}/{random}.{ext}. The path is built
 * here from the server-resolved company and a verified product id; the file type comes from
 * its bytes. Storage RLS and the products_image_path_scoped check enforce the same scope.
 */
export async function uploadProductImageAction(productId: string, formData: FormData): Promise<ActionResult<{ path: string }>> {
  return companyAction("products.update", async (ctx, supabase) => {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "products.errors.imageMissing" };
    if (file.size > MAX_PRODUCT_IMAGE_BYTES) return { ok: false, error: "products.errors.imageTooLarge" };

    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = detectImageType(bytes);
    if (!type) return { ok: false, error: "products.errors.imageType" };

    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, image_path")
      .eq("id", productId)
      .eq("company_id", ctx.company.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (productError) return failFromDb(productError, "load product for image");
    if (!product) return { ok: false, error: "errors.notFound" };

    const path = productImagePath(ctx.company.id, product.id, randomUUID(), type.ext);
    const storage = supabase.storage.from(PRODUCT_IMAGES_BUCKET);
    const { error: uploadError } = await storage.upload(path, bytes, {
      contentType: type.mime,
      upsert: false,
      cacheControl: "3600",
    });
    if (uploadError) {
      console.error("product image upload failed", uploadError.message);
      return { ok: false, error: "products.errors.imageUpload" };
    }

    const { error: updateError } = await supabase
      .from("products")
      .update({ image_path: path })
      .eq("id", product.id)
      .eq("company_id", ctx.company.id);
    if (updateError) {
      await storage.remove([path]);
      return failFromDb(updateError, "set product image");
    }

    if (product.image_path && isProductImagePath(product.image_path, ctx.company.id, product.id)) {
      await storage.remove([product.image_path]);
    }

    revalidateCatalog();
    return { ok: true, data: { path } };
  });
}

export async function removeProductImageAction(productId: string): Promise<ActionResult> {
  return companyAction("products.update", async (ctx, supabase) => {
    const { data: product, error } = await supabase
      .from("products")
      .select("id, image_path")
      .eq("id", productId)
      .eq("company_id", ctx.company.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) return failFromDb(error, "load product for image removal");
    if (!product) return { ok: false, error: "errors.notFound" };
    if (!product.image_path) return { ok: true };

    const { error: updateError } = await supabase
      .from("products")
      .update({ image_path: null })
      .eq("id", product.id)
      .eq("company_id", ctx.company.id);
    if (updateError) return failFromDb(updateError, "clear product image");

    if (isProductImagePath(product.image_path, ctx.company.id, product.id)) {
      await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([product.image_path]);
    }
    revalidateCatalog();
    return { ok: true };
  });
}

export type ProductOption = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  defaultWarehouseId: string | null;
  purchasePrice: number;
};

/** Typeahead for stock operations: active, stock-tracked products of the active company. */
export async function searchProductsAction(query: string): Promise<ActionResult<ProductOption[]>> {
  return companyAction("inventory.view", async (ctx, supabase) => {
    const q = sanitizeSearch(query);
    let request = supabase
      .from("products")
      .select("id, name, sku, unit, default_warehouse_id, purchase_price")
      .eq("company_id", ctx.company.id)
      .is("deleted_at", null)
      .eq("is_active", true)
      .eq("track_inventory", true)
      .order("name")
      .limit(20);
    if (q) request = request.or(`name.ilike.%${q}%,sku.ilike.%${q}%,barcode.eq.${q}`);
    const { data, error } = await request;
    if (error) return failFromDb(error, "search products");
    return {
      ok: true,
      data: (data ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        unit: p.unit,
        defaultWarehouseId: p.default_warehouse_id,
        purchasePrice: Number(p.purchase_price),
      })),
    };
  });
}
