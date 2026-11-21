import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export type MovementRow = {
  id: string;
  created_at: string;
  movement_type: string;
  quantity: number;
  balance_after: number;
  note: string | null;
  warehouse_id: string;
  product?: { id: string; name: string; sku: string; unit: string } | null;
  creator?: { full_name: string | null; email: string | null } | null;
};

export async function MovementsTable({
  rows,
  warehouseNames,
  showProduct = true,
}: {
  rows: MovementRow[];
  warehouseNames: Map<string, string>;
  showProduct?: boolean;
}) {
  const t = await getTranslations("inventory");
  const tu = await getTranslations("units");
  const locale = await getLocale();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-4">{t("date")}</TableHead>
          {showProduct && <TableHead>{t("product")}</TableHead>}
          <TableHead>{t("movementType")}</TableHead>
          <TableHead className="hidden md:table-cell">{t("warehouse")}</TableHead>
          <TableHead className="text-right">{t("quantity")}</TableHead>
          <TableHead className="hidden text-right sm:table-cell">{t("balanceAfter")}</TableHead>
          <TableHead className="hidden pr-4 lg:table-cell">{t("byUser")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((m) => {
          const qty = Number(m.quantity);
          const unit = m.product ? ` ${tu(m.product.unit)}` : "";
          return (
            <TableRow key={m.id}>
              <TableCell className="pl-4 whitespace-nowrap tabular-nums text-muted-foreground">{formatDateTime(m.created_at, locale)}</TableCell>
              {showProduct && (
                <TableCell className="max-w-56">
                  {m.product ? (
                    <Link href={`/products/${m.product.id}`} className="grid min-w-0 hover:underline">
                      <span className="truncate font-medium">{m.product.name}</span>
                      <span className="truncate text-xs text-muted-foreground">{m.product.sku}</span>
                    </Link>
                  ) : (
                    "—"
                  )}
                </TableCell>
              )}
              <TableCell>
                <div className="grid gap-0.5">
                  <Badge variant="secondary" className="w-fit">
                    {t(`types.${m.movement_type}`)}
                  </Badge>
                  {m.note && <span className="max-w-56 truncate text-xs text-muted-foreground" title={m.note}>{m.note}</span>}
                </div>
              </TableCell>
              <TableCell className="hidden text-muted-foreground md:table-cell">{warehouseNames.get(m.warehouse_id) ?? "—"}</TableCell>
              <TableCell className={cn("text-right font-medium tabular-nums", qty > 0 ? "text-success" : "text-destructive")}>
                {qty > 0 ? "+" : ""}
                {formatNumber(qty, locale)}
                {unit}
              </TableCell>
              <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatNumber(m.balance_after, locale)}</TableCell>
              <TableCell className="hidden max-w-40 truncate pr-4 text-muted-foreground lg:table-cell">
                {m.creator?.full_name || m.creator?.email || "—"}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
