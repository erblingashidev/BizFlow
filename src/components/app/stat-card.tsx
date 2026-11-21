import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type StatTone = "primary" | "success" | "warning" | "destructive" | "muted";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "muted",
  href,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon: LucideIcon;
  tone?: StatTone;
  href?: string;
}) {
  const card = (
    <Card size="sm" className={cn("h-full", href && "transition-shadow hover:ring-primary/30")}>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardDescription className="font-medium">{label}</CardDescription>
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-lg",
            tone === "primary" && "bg-primary/10 text-primary",
            tone === "success" && "bg-success/10 text-success",
            tone === "warning" && "bg-warning/15 text-warning-foreground",
            tone === "destructive" && "bg-destructive/10 text-destructive",
            tone === "muted" && "bg-muted text-muted-foreground",
          )}
        >
          <Icon className="size-4" aria-hidden />
        </span>
      </CardHeader>
      <CardContent className="grid gap-0.5">
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
  return href ? (
    <Link href={href} className="rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
      {card}
    </Link>
  ) : (
    card
  );
}
