import type { MovementKind } from "@/lib/validation/inventory";

/** Stock operations the member may perform; transfers need at least two active warehouses. */
export function stockKindsFor(permissions: ReadonlySet<string>, activeWarehouseCount: number): MovementKind[] {
  const kinds: MovementKind[] = [];
  if (permissions.has("inventory.adjust")) kinds.push("in", "out", "count");
  if (permissions.has("inventory.transfer") && activeWarehouseCount > 1) kinds.push("transfer");
  return kinds;
}
