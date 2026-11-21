import type { ActionFailure } from "@/lib/actions";

type DbError = { code?: string; message?: string; hint?: string | null; details?: string | null };

/** Unique indexes → the form field they belong to and its message key. */
const UNIQUE_FIELDS: Record<string, { field: string; message: string }> = {
  products_company_sku_unique: { field: "sku", message: "validation.skuTaken" },
  products_company_barcode_unique: { field: "barcode", message: "validation.barcodeTaken" },
  warehouses_company_code_unique: { field: "code", message: "validation.codeTaken" },
  product_categories_company_name_unique: { field: "name", message: "validation.nameTaken" },
  customers_company_business_number_unique: { field: "businessNumber", message: "validation.businessNumberTaken" },
  suppliers_company_business_number_unique: { field: "businessNumber", message: "validation.businessNumberTaken" },
};

/** Business-rule hints raised by triggers/RPCs → i18n keys. */
const HINT_MESSAGES: Record<string, string> = {
  insufficient_stock: "inventory.errors.insufficientStock",
  no_change: "inventory.errors.noChange",
  product_has_stock: "products.errors.hasStock",
  warehouse_has_stock: "warehouses.errors.hasStock",
  warehouse_is_default: "warehouses.errors.isDefault",
  category_in_use: "categories.errors.inUse",
  category_depth: "categories.errors.depth",
};

/**
 * Maps a PostgREST/Postgres error to a user-safe ActionResult. Raw database messages are
 * never returned; unknown errors become `errors.generic` (and should be logged by the caller).
 */
export function dbErrorResult(error: DbError): ActionFailure {
  if (error.hint && HINT_MESSAGES[error.hint]) {
    return { ok: false, error: HINT_MESSAGES[error.hint] };
  }
  switch (error.code) {
    case "23505": {
      const constraint = /"([^"]+)"/.exec(error.message ?? "")?.[1];
      const mapped = constraint ? UNIQUE_FIELDS[constraint] : undefined;
      return mapped
        ? { ok: false, error: "errors.invalidInput", fieldErrors: { [mapped.field]: mapped.message } }
        : { ok: false, error: "errors.duplicate" };
    }
    case "42501":
      return { ok: false, error: "errors.forbidden" };
    case "23503":
    case "P0002":
      return { ok: false, error: "errors.notFound" };
    case "23514":
    case "22023":
    case "22P02":
      return { ok: false, error: "errors.invalidInput" };
    default:
      return { ok: false, error: "errors.generic" };
  }
}

export function isKnownDbError(error: DbError): boolean {
  return dbErrorResult(error).error !== "errors.generic";
}
