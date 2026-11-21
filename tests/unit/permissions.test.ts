import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AuthorizationError,
  PERMISSIONS,
  assertPermission,
  hasAnyPermission,
  hasPermission,
  isPermission,
  resolveActiveCompanyId,
  type MembershipSummary,
} from "@/lib/auth/permissions";

const membership = (companyId: string, overrides: Partial<MembershipSummary> = {}): MembershipSummary => ({
  companyId,
  status: "active",
  companyStatus: "active",
  companyDeleted: false,
  ...overrides,
});

describe("resolveActiveCompanyId", () => {
  const memberships = [membership("a"), membership("b")];

  it("honours a hint only when it names an active membership", () => {
    expect(resolveActiveCompanyId(memberships, "b")).toBe("b");
  });

  it("ignores a forged hint for a company the user does not belong to", () => {
    expect(resolveActiveCompanyId(memberships, "someone-elses-company")).toBe("a");
  });

  it("skips suspended, invited, suspended-company and deleted-company memberships", () => {
    const list = [
      membership("invited", { status: "invited" }),
      membership("suspended", { status: "suspended" }),
      membership("company-suspended", { companyStatus: "suspended" }),
      membership("deleted", { companyDeleted: true }),
      membership("ok"),
    ];
    expect(resolveActiveCompanyId(list, "suspended")).toBe("ok");
    expect(resolveActiveCompanyId(list, null)).toBe("ok");
  });

  it("returns null without any usable membership", () => {
    expect(resolveActiveCompanyId([], "a")).toBeNull();
    expect(resolveActiveCompanyId([membership("x", { status: "suspended" })], "x")).toBeNull();
  });
});

describe("permission checks", () => {
  const granted = new Set(["products.view", "sales.create"]);

  it("checks single and any-of permissions", () => {
    expect(hasPermission(granted, "products.view")).toBe(true);
    expect(hasPermission(granted, "products.delete")).toBe(false);
    expect(hasPermission(["billing.view"], "billing.view")).toBe(true);
    expect(hasAnyPermission(granted, ["billing.manage", "sales.create"])).toBe(true);
    expect(hasAnyPermission(granted, ["billing.manage"])).toBe(false);
  });

  it("assertPermission throws a typed forbidden error", () => {
    expect(() => assertPermission(granted, "products.view")).not.toThrow();
    try {
      assertPermission(granted, "employees.manage");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(AuthorizationError);
      expect((error as AuthorizationError).code).toBe("forbidden");
    }
  });

  it("validates permission keys", () => {
    expect(isPermission("inventory.adjust")).toBe(true);
    expect(isPermission("inventory.steal")).toBe(false);
    expect(isPermission(42)).toBe(false);
  });
});

describe("permission catalog", () => {
  it("matches the permissions seeded by the database migration", () => {
    const sql = readFileSync("supabase/migrations/20261121000900_seed_reference_data.sql", "utf8");
    const block = sql.slice(sql.indexOf("insert into public.permissions"), sql.indexOf("on conflict (key)"));
    const seeded = [...block.matchAll(/\('([a-z_]+\.[a-z_]+)'/g)].map((m) => m[1]).sort();
    expect(seeded).toEqual([...PERMISSIONS].sort());
  });
});
