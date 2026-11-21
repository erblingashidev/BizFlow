import {
  Activity,
  BarChart3,
  Boxes,
  CreditCard,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Truck,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/lib/auth/permissions";

export type NavItem = {
  key: string;
  href: string;
  icon: LucideIcon;
  permission: Permission;
  /** False until the module ships; rendered as a disabled "soon" entry. */
  available: boolean;
};

export type NavSection = { key: "main" | "operations" | "management"; items: NavItem[] };

export const NAV_SECTIONS: NavSection[] = [
  {
    key: "main",
    items: [
      { key: "dashboard", href: "/dashboard", icon: LayoutDashboard, permission: "dashboard.view", available: true },
    ],
  },
  {
    key: "operations",
    items: [
      { key: "products", href: "/products", icon: Package, permission: "products.view", available: false },
      { key: "inventory", href: "/inventory", icon: Boxes, permission: "inventory.view", available: false },
      { key: "sales", href: "/sales", icon: ShoppingCart, permission: "sales.view", available: false },
      { key: "purchases", href: "/purchases", icon: Truck, permission: "purchases.view", available: false },
      { key: "expenses", href: "/expenses", icon: Wallet, permission: "expenses.view", available: false },
      { key: "customers", href: "/customers", icon: Users, permission: "customers.view", available: false },
      { key: "suppliers", href: "/suppliers", icon: Receipt, permission: "suppliers.view", available: false },
    ],
  },
  {
    key: "management",
    items: [
      { key: "reports", href: "/reports", icon: BarChart3, permission: "reports.view", available: false },
      { key: "employees", href: "/employees", icon: UserCog, permission: "employees.view", available: false },
      { key: "activity", href: "/activity", icon: Activity, permission: "activity_logs.view", available: false },
      { key: "billing", href: "/billing", icon: CreditCard, permission: "billing.view", available: false },
      { key: "settings", href: "/settings", icon: Settings, permission: "company.settings", available: false },
    ],
  },
];

/** Sections filtered to what the current member may see; empty sections are dropped. */
export function visibleNavSections(permissions: ReadonlySet<string>): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => permissions.has(item.permission)),
  })).filter((section) => section.items.length > 0);
}
