import "server-only";

import type { DbClient } from "@/lib/server-action";

export type CategoryRow = {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
};

export type WarehouseRow = {
  id: string;
  name: string;
  code: string;
  city: string | null;
  address: string | null;
  isDefault: boolean;
  isActive: boolean;
};

export async function listCategories(supabase: DbClient, companyId: string): Promise<CategoryRow[]> {
  const { data, error } = await supabase
    .from("product_categories")
    .select("id, name, description, parent_id")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("name");
  if (error) throw error;
  return (data ?? []).map((c) => ({ id: c.id, name: c.name, description: c.description, parentId: c.parent_id }));
}

/** Parents first, each followed by its children, for indented pickers. */
export function sortCategoryTree(categories: CategoryRow[]): (CategoryRow & { depth: number })[] {
  const out: (CategoryRow & { depth: number })[] = [];
  for (const parent of categories.filter((c) => !c.parentId)) {
    out.push({ ...parent, depth: 0 });
    for (const child of categories.filter((c) => c.parentId === parent.id)) out.push({ ...child, depth: 1 });
  }
  return out;
}

export function categoryWithChildren(categories: CategoryRow[], id: string): string[] {
  return [id, ...categories.filter((c) => c.parentId === id).map((c) => c.id)];
}

export async function listWarehouses(
  supabase: DbClient,
  companyId: string,
  { activeOnly = false }: { activeOnly?: boolean } = {},
): Promise<WarehouseRow[]> {
  let query = supabase
    .from("warehouses")
    .select("id, name, code, city, address, is_default, is_active")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("is_default", { ascending: false })
    .order("name");
  if (activeOnly) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((w) => ({
    id: w.id,
    name: w.name,
    code: w.code,
    city: w.city,
    address: w.address,
    isDefault: w.is_default,
    isActive: w.is_active,
  }));
}
