import type { ProductInput } from "@/lib/validation/catalog";

type ProductRow = {
  name: string;
  sku: string;
  barcode: string | null;
  category_id: string | null;
  description: string | null;
  product_type: string;
  unit: string;
  purchase_price: number | string;
  sale_price: number | string;
  vat_rate: number | string;
  min_stock: number | string;
  track_inventory: boolean;
  default_warehouse_id: string | null;
};

export function emptyProduct(defaultWarehouseId: string | null): ProductInput {
  return {
    name: "",
    sku: "",
    barcode: "",
    categoryId: "",
    description: "",
    productType: "goods",
    unit: "pcs",
    purchasePrice: "0",
    salePrice: "0",
    vatRate: 18,
    minStock: "0",
    trackInventory: true,
    defaultWarehouseId: defaultWarehouseId ?? "",
    openingQuantity: "",
    openingWarehouseId: defaultWarehouseId ?? "",
  };
}

export function productToInput(p: ProductRow): ProductInput {
  return {
    name: p.name,
    sku: p.sku,
    barcode: p.barcode ?? "",
    categoryId: p.category_id ?? "",
    description: p.description ?? "",
    productType: p.product_type as ProductInput["productType"],
    unit: p.unit as ProductInput["unit"],
    purchasePrice: String(p.purchase_price),
    salePrice: String(p.sale_price),
    vatRate: Number(p.vat_rate),
    minStock: String(p.min_stock),
    trackInventory: p.track_inventory,
    defaultWarehouseId: p.default_warehouse_id ?? "",
    openingQuantity: "",
    openingWarehouseId: "",
  };
}
