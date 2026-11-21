"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Bell, CheckCircle2 } from "lucide-react";
import { StockStatusBadge } from "@/components/app/stock-status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export type LowStockItem = {
  id: string;
  name: string;
  quantity: number;
  minStock: number;
  unit: string;
  status: "out" | "low";
};

export function LowStockBell({ count, items }: { count: number; items: LowStockItem[] }) {
  const t = useTranslations();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const label = count > 0 ? t("notifications.lowStockCount", { count }) : t("notifications.title");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={label}
        className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "relative")}
      >
        <Bell aria-hidden />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 grid min-w-4.5 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4.5 text-white tabular-nums">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-4 py-3">
          <p className="text-sm font-semibold">{t("notifications.title")}</p>
          <p className="text-xs text-muted-foreground">{count > 0 ? label : t("notifications.allGood")}</p>
        </div>
        {items.length > 0 ? (
          <ul className="max-h-80 divide-y overflow-y-auto">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/products/${item.id}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-muted/60"
                >
                  <span className="grid min-w-0">
                    <span className="truncate font-medium">{item.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {t("dashboard.stockOfMin", {
                        qty: formatNumber(item.quantity, locale),
                        min: formatNumber(item.minStock, locale),
                        unit: t(`units.${item.unit}`),
                      })}
                    </span>
                  </span>
                  <StockStatusBadge status={item.status} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 text-success" aria-hidden />
            {t("dashboard.noLowStock")}
          </p>
        )}
        {count > 0 && (
          <div className="border-t p-2">
            <Link
              href="/inventory?stock=low"
              onClick={() => setOpen(false)}
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "w-full")}
            >
              {t("dashboard.viewAll")}
            </Link>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
