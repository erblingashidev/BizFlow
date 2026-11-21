import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StockStatus = "ok" | "low" | "out" | "untracked";

export function StockStatusBadge({ status, className }: { status: StockStatus | string | null; className?: string }) {
  const t = useTranslations("inventory.status");
  const s = (status ?? "ok") as StockStatus;
  return (
    <Badge
      variant="outline"
      className={cn(
        s === "ok" && "border-success/30 bg-success/10 text-success",
        s === "low" && "border-warning/40 bg-warning/15 text-warning-foreground",
        s === "out" && "border-destructive/30 bg-destructive/10 text-destructive",
        s === "untracked" && "text-muted-foreground",
        className,
      )}
    >
      {t(s)}
    </Badge>
  );
}
