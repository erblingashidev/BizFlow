import { describe, expect, it } from "vitest";
import { stockKindsFor } from "@/app/(app)/inventory/kinds";
import { csvCell, toCsv } from "@/lib/csv";
import { dbErrorResult, isKnownDbError } from "@/lib/db-errors";
import { detectImageType, isProductImagePath, productImagePath } from "@/lib/images";
import { dateParam, listHref, pageRange, sanitizeSearch, uuidParam } from "@/lib/list-params";
import { productSchema, warehouseSchema } from "@/lib/validation/catalog";
import { money, parseDecimal, quantity } from "@/lib/validation/common";
import { stockOperationSchema } from "@/lib/validation/inventory";
import { partySchema } from "@/lib/validation/party";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

function firstError(result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) {
  return result.error?.issues.map((i) => `${i.path.join(".")}:${i.message}`);
}

describe("parseDecimal", () => {
  it.each([
    ["1234.5", 1234.5],
    ["1234,5", 1234.5],
    ["1 234,50", 1234.5],
    ["1.234,50", 1234.5],
    ["1,234.50", 1234.5],
    ["-3", -3],
    [" 7 ", 7],
    [12.25, 12.25],
  ])("parses %j", (input, expected) => {
    expect(parseDecimal(input)).toBe(expected);
  });

  it.each(["", "abc", "1e5", "1..2", "12,3,4x", "0x10", Number.NaN, Infinity, null])("rejects %j", (input) => {
    expect(parseDecimal(input)).toBeNull();
  });
});

describe("money and quantity schemas", () => {
  it("enforces scale, sign and range with translatable messages", () => {
    expect(money().parse("12,50")).toBe(12.5);
    expect(money().safeParse("1.234").error?.issues[0].message).toBe("validation.decimals2");
    expect(money().safeParse("-1").error?.issues[0].message).toBe("validation.nonNegative");
    expect(money().safeParse("x").error?.issues[0].message).toBe("validation.number");
    expect(money().safeParse("").error?.issues[0].message).toBe("validation.required");
    expect(money().safeParse("1000000000000").error?.issues[0].message).toBe("validation.tooLarge");
    expect(quantity().parse("0,125")).toBe(0.125);
    expect(quantity().safeParse("0,1255").error?.issues[0].message).toBe("validation.decimals3");
    expect(quantity({ positive: true }).safeParse("0").error?.issues[0].message).toBe("validation.positive");
  });
});

const product = {
  name: "Kafe Espresso 1kg",
  sku: "KAF-001",
  barcode: "",
  categoryId: "",
  description: "",
  productType: "goods" as const,
  unit: "pcs" as const,
  purchasePrice: "8,50",
  salePrice: "12",
  vatRate: "18",
  minStock: "5",
  trackInventory: true,
  defaultWarehouseId: "",
};

describe("productSchema", () => {
  it("normalises a valid product", () => {
    const data = productSchema.parse(product);
    expect(data).toMatchObject({ purchasePrice: 8.5, salePrice: 12, vatRate: 18, minStock: 5, barcode: null, categoryId: null });
    expect(data.openingQuantity).toBeUndefined();
  });

  it("rejects bad SKUs, VAT rates and barcodes", () => {
    expect(firstError(productSchema.safeParse({ ...product, sku: "KAF 001" }))).toContain("sku:validation.sku");
    expect(firstError(productSchema.safeParse({ ...product, vatRate: "20" }))).toContain("vatRate:validation.vatRate");
    expect(firstError(productSchema.safeParse({ ...product, barcode: "12" }))).toContain("barcode:validation.barcode");
  });

  it("does not let services track stock", () => {
    expect(firstError(productSchema.safeParse({ ...product, productType: "service" }))).toContain(
      "trackInventory:validation.serviceNoStock",
    );
  });

  it("requires tracking and a warehouse for opening stock", () => {
    expect(firstError(productSchema.safeParse({ ...product, openingQuantity: "3" }))).toContain(
      "openingWarehouseId:validation.required",
    );
    expect(
      firstError(productSchema.safeParse({ ...product, trackInventory: false, openingQuantity: "3", openingWarehouseId: A })),
    ).toContain("openingQuantity:validation.openingNeedsTracking");
    expect(productSchema.parse({ ...product, openingQuantity: "3,5", openingWarehouseId: A }).openingQuantity).toBe(3.5);
  });
});

describe("warehouse and party schemas", () => {
  it("uppercases warehouse codes and rejects spaces", () => {
    expect(warehouseSchema.parse({ name: "Main", code: "pr-01" }).code).toBe("PR-01");
    expect(firstError(warehouseSchema.safeParse({ name: "Main", code: "P R" }))).toContain("code:validation.code");
  });

  it("normalises party contact details", () => {
    const data = partySchema.parse({ name: " Shpresa SH.P.K. ", businessNumber: "811 234 567", email: "Info@Shpresa.COM", countryCode: "xk" });
    expect(data).toMatchObject({ name: "Shpresa SH.P.K.", businessNumber: "811234567", email: "info@shpresa.com", countryCode: "XK", customerType: "business", phone: null });
    expect(firstError(partySchema.safeParse({ name: "X Ltd", businessNumber: "12ab" }))).toContain("businessNumber:validation.businessNumber");
    expect(firstError(partySchema.safeParse({ name: "X Ltd", countryCode: "Kosovo" }))).toContain("countryCode:validation.countryCode");
  });
});

describe("stockOperationSchema", () => {
  it("allows a zero count but not a zero stock-in", () => {
    expect(stockOperationSchema.safeParse({ kind: "count", productId: A, warehouseId: B, quantity: "0" }).success).toBe(true);
    expect(stockOperationSchema.safeParse({ kind: "in", productId: A, warehouseId: B, quantity: "0" }).success).toBe(false);
  });

  it("rejects a transfer to the same warehouse", () => {
    const result = stockOperationSchema.safeParse({ kind: "transfer", productId: A, warehouseId: B, toWarehouseId: B, quantity: "1" });
    expect(firstError(result)).toContain("toWarehouseId:validation.sameWarehouse");
  });
});

describe("stockKindsFor", () => {
  it("offers transfers only with permission and two active warehouses", () => {
    expect(stockKindsFor(new Set(["inventory.adjust", "inventory.transfer"]), 2)).toEqual(["in", "out", "count", "transfer"]);
    expect(stockKindsFor(new Set(["inventory.adjust", "inventory.transfer"]), 1)).toEqual(["in", "out", "count"]);
    expect(stockKindsFor(new Set(["inventory.transfer"]), 3)).toEqual(["transfer"]);
    expect(stockKindsFor(new Set(["inventory.view"]), 3)).toEqual([]);
  });
});

describe("dbErrorResult", () => {
  it("maps unique violations to the right field", () => {
    expect(
      dbErrorResult({ code: "23505", message: 'duplicate key value violates unique constraint "products_company_sku_unique"' }),
    ).toEqual({ ok: false, error: "errors.invalidInput", fieldErrors: { sku: "validation.skuTaken" } });
    expect(dbErrorResult({ code: "23505", message: 'violates unique constraint "something_else"' }).error).toBe("errors.duplicate");
  });

  it("maps trigger hints and never leaks raw messages", () => {
    expect(dbErrorResult({ code: "P0001", message: "secret detail", hint: "insufficient_stock" }).error).toBe(
      "inventory.errors.insufficientStock",
    );
    expect(dbErrorResult({ code: "42501", message: "permission denied for table x" }).error).toBe("errors.forbidden");
    const unknown = dbErrorResult({ code: "XX000", message: "internal: password=hunter2" });
    expect(unknown).toEqual({ ok: false, error: "errors.generic" });
    expect(isKnownDbError({ code: "XX000" })).toBe(false);
    expect(isKnownDbError({ code: "23503" })).toBe(true);
  });
});

describe("product images", () => {
  const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);

  it("detects images by signature, not by name", () => {
    expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0))?.ext).toBe("jpg");
    expect(detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))?.ext).toBe("png");
    expect(detectImageType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))?.ext).toBe("webp");
    expect(detectImageType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(detectImageType(new TextEncoder().encode("GIF89a........"))).toBeNull();
  });

  it("builds company-scoped paths and refuses traversal", () => {
    const path = productImagePath(A, B, "f", "png");
    expect(path).toBe(`${A}/products/${B}/f.png`);
    expect(isProductImagePath(path, A, B)).toBe(true);
    expect(isProductImagePath(`${B}/products/${B}/f.png`, A, B)).toBe(false);
    expect(isProductImagePath(`${A}/products/${B}/../../${B}/x.png`, A, B)).toBe(false);
  });
});

describe("list params", () => {
  it("strips PostgREST filter syntax from search text", () => {
    expect(sanitizeSearch("kafe),name.eq.x,(id")).toBe("kafe name.eq.x id");
    expect(sanitizeSearch('50% "off" \\*')).toBe("50 off");
    expect(sanitizeSearch("   ")).toBeUndefined();
    expect(sanitizeSearch("a".repeat(200))?.length).toBe(80);
  });

  it("validates ids, dates and pages", () => {
    expect(uuidParam(A.toUpperCase())).toBe(A);
    expect(uuidParam("1 or 1=1")).toBeUndefined();
    expect(dateParam("2026-02-30")).toBeUndefined();
    expect(dateParam("2026-02-28")).toBe("2026-02-28");
    expect(pageRange({ page: "3" })).toMatchObject({ page: 3, from: 40, to: 59 });
    expect(pageRange({ page: "-1" }).page).toBe(1);
    expect(pageRange({ page: "abc" }).page).toBe(1);
  });

  it("builds list links that keep filters", () => {
    expect(listHref("/products", { q: "kafe", page: "2" }, { page: 3 })).toBe("/products?q=kafe&page=3");
    expect(listHref("/products", { q: "kafe", page: "2" }, { page: undefined })).toBe("/products?q=kafe");
  });
});

describe("csv", () => {
  it("neutralises spreadsheet formulas", () => {
    expect(csvCell("=HYPERLINK(\"x\")", ",")).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell("+38344", ",")).toBe("'+38344");
    expect(csvCell("@SUM(A1)", ",")).toBe("'@SUM(A1)");
    expect(csvCell(-5, ",")).toBe("-5");
  });

  it("uses ; and decimal commas for Albanian", () => {
    expect(toCsv([["Kafe; 1kg", 12.5]], "sq")).toBe('\uFEFF"Kafe; 1kg";12,5\r\n');
    expect(toCsv([["Coffee", 12.5]], "en")).toBe("\uFEFFCoffee,12.5\r\n");
  });
});
