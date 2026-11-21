import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { listHref, type SearchParams } from "@/lib/list-params";
import { cn } from "@/lib/utils";

export async function Pagination({
  pathname,
  params,
  page,
  pageSize,
  total,
}: {
  pathname: string;
  params: SearchParams;
  page: number;
  pageSize: number;
  total: number;
}) {
  const t = await getTranslations("common");
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);

  const link = (target: number, disabled: boolean, label: string, icon: React.ReactNode) =>
    disabled ? (
      <span aria-disabled className={cn(buttonVariants({ variant: "outline", size: "sm" }), "pointer-events-none opacity-50")}>
        {icon}
        <span className="sr-only sm:not-sr-only">{label}</span>
      </span>
    ) : (
      <Link href={listHref(pathname, params, { page: target === 1 ? undefined : target })} className={buttonVariants({ variant: "outline", size: "sm" })}>
        {icon}
        <span className="sr-only sm:not-sr-only">{label}</span>
      </Link>
    );

  return (
    <div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground">
      <p className="tabular-nums">{t("showing", { first, last, total })}</p>
      <div className="flex items-center gap-2">
        {link(page - 1, page <= 1, t("previous"), <ChevronLeft aria-hidden />)}
        <span className="tabular-nums">{t("pageOf", { page: Math.min(page, pages), pages })}</span>
        {link(page + 1, page >= pages, t("next"), <ChevronRight aria-hidden />)}
      </div>
    </div>
  );
}
