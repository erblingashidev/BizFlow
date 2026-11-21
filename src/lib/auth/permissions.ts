/**
 * Pure authorization logic shared by server code and tests. The database (RLS +
 * has_permission) is the source of truth; these helpers decide what the UI offers and
 * which company context a request runs in.
 */

export const PERMISSIONS = [
  "dashboard.view",
  "products.view", "products.create", "products.update", "products.delete",
  "inventory.view", "inventory.adjust", "inventory.transfer",
  "warehouses.view", "warehouses.create", "warehouses.update", "warehouses.delete",
  "customers.view", "customers.create", "customers.update", "customers.delete",
  "suppliers.view", "suppliers.create", "suppliers.update", "suppliers.delete",
  "sales.view", "sales.create", "sales.update", "sales.delete",
  "purchases.view", "purchases.create", "purchases.update", "purchases.delete", "purchases.receive",
  "expenses.view", "expenses.create", "expenses.update", "expenses.delete",
  "reports.view", "reports.export",
  "employees.view", "employees.manage",
  "roles.manage",
  "activity_logs.view",
  "company.settings",
  "billing.view", "billing.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const COMPANY_ROLES = ["owner", "admin", "manager", "employee"] as const;
export type CompanyRoleKey = (typeof COMPANY_ROLES)[number];

export function isPermission(value: unknown): value is Permission {
  return typeof value === "string" && (PERMISSIONS as readonly string[]).includes(value);
}

export function hasPermission(granted: ReadonlySet<string> | readonly string[], permission: Permission): boolean {
  return Array.isArray(granted) ? granted.includes(permission) : (granted as ReadonlySet<string>).has(permission);
}

export function hasAnyPermission(granted: ReadonlySet<string> | readonly string[], permissions: readonly Permission[]): boolean {
  return permissions.some((p) => hasPermission(granted, p));
}

export type MembershipSummary = {
  companyId: string;
  status: "invited" | "active" | "suspended";
  companyStatus: "active" | "suspended";
  companyDeleted: boolean;
};

export function isUsableMembership(m: MembershipSummary): boolean {
  return m.status === "active" && m.companyStatus === "active" && !m.companyDeleted;
}

/**
 * Picks the company a request operates on. The cookie value is only a hint: it is honoured
 * only if it names a company the user is an active member of, otherwise the first usable
 * membership wins. Returns null when the user has no usable membership.
 */
export function resolveActiveCompanyId<T extends MembershipSummary>(
  memberships: readonly T[],
  hint: string | null | undefined,
): string | null {
  const usable = memberships.filter(isUsableMembership);
  if (usable.length === 0) return null;
  if (hint) {
    const match = usable.find((m) => m.companyId === hint);
    if (match) return match.companyId;
  }
  return usable[0].companyId;
}

export class AuthorizationError extends Error {
  constructor(
    public readonly code: "unauthenticated" | "no_company" | "forbidden",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "AuthorizationError";
  }
}

export function assertPermission(granted: ReadonlySet<string>, permission: Permission): void {
  if (!granted.has(permission)) {
    throw new AuthorizationError("forbidden", `Missing permission: ${permission}`);
  }
}
