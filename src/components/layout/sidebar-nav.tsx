"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { NAV_SECTIONS } from "./nav-items";

/** Receives the keys of permitted items from the server, so icons stay client-side. */
export function SidebarNav({ allowedKeys, onNavigate }: { allowedKeys: string[]; onNavigate?: () => void }) {
  const t = useTranslations();
  const pathname = usePathname();
  const allowed = new Set(allowedKeys);

  const sections = NAV_SECTIONS.map((s) => ({ ...s, items: s.items.filter((i) => allowed.has(i.key)) })).filter(
    (s) => s.items.length > 0,
  );

  return (
    <nav className="grid gap-6" aria-label="Main">
      {sections.map((section) => (
        <div key={section.key} className="grid gap-1">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
            {t(`nav.${section.key}`)}
          </p>
          {section.items.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const classes = cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-muted hover:text-foreground",
              !item.available && "pointer-events-none opacity-60",
            );

            if (!item.available) {
              return (
                <span key={item.key} className={classes} aria-disabled>
                  <Icon className="size-4" aria-hidden />
                  <span className="flex-1">{t(`nav.${item.key}`)}</span>
                  <Badge variant="secondary" className="text-[10px] font-normal">
                    {t("common.comingSoon")}
                  </Badge>
                </span>
              );
            }

            return (
              <Link
                key={item.key}
                href={item.href}
                className={classes}
                aria-current={active ? "page" : undefined}
                onClick={onNavigate}
              >
                <Icon className="size-4" aria-hidden />
                {t(`nav.${item.key}`)}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
