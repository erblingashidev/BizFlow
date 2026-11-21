import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import sq from "../../messages/sq.json";
import { NAV_SECTIONS, visibleNavSections } from "@/components/layout/nav-items";
import { COMPANY_ROLES } from "@/lib/auth/permissions";
import { defaultLocale, resolveLocale } from "@/i18n/config";

function keys(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe("translations", () => {
  it("Albanian is the default locale", () => {
    expect(defaultLocale).toBe("sq");
    expect(resolveLocale("de")).toBe("sq");
    expect(resolveLocale("en")).toBe("en");
  });

  it("sq and en define exactly the same keys", () => {
    expect(keys(sq).sort()).toEqual(keys(en).sort());
  });

  it("has labels for every nav item and company role", () => {
    for (const section of NAV_SECTIONS) {
      expect(sq.nav).toHaveProperty(section.key);
      for (const item of section.items) expect(sq.nav).toHaveProperty(item.key);
    }
    for (const role of COMPANY_ROLES) expect(sq.roles).toHaveProperty(role);
  });
});

describe("navigation filtering", () => {
  it("hides modules the member cannot view and drops empty sections", () => {
    const employee = new Set(["dashboard.view", "products.view", "sales.view"]);
    const sections = visibleNavSections(employee);
    expect(sections.map((s) => s.key)).toEqual(["main", "operations"]);
    expect(sections.flatMap((s) => s.items.map((i) => i.key))).toEqual(["dashboard", "products", "sales"]);
  });
});
