"use client";

import { useLocale } from "next-intl";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency, formatNumber } from "@/lib/format";

export type MonthlyPoint = { label: string; sales: number; purchases: number };

export function MonthlyChart({
  data,
  salesLabel,
  purchasesLabel,
  showPurchases,
}: {
  data: MonthlyPoint[];
  salesLabel: string;
  purchasesLabel: string;
  showPurchases: boolean;
}) {
  const locale = useLocale();
  return (
    <div className="h-72 w-full" role="img" aria-label={salesLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" />
          <YAxis
            tickLine={false}
            axisLine={false}
            fontSize={12}
            width={56}
            stroke="var(--muted-foreground)"
            tickFormatter={(v: number) => (v >= 1000 ? `${formatNumber(Math.round(v / 100) / 10, locale, 1)}k` : formatNumber(v, locale, 0))}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            formatter={(value) => formatCurrency(Number(value), locale)}
            contentStyle={{
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--popover)",
              color: "var(--popover-foreground)",
              fontSize: 12,
            }}
          />
          {showPurchases && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />}
          <Bar dataKey="sales" name={salesLabel} fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
          {showPurchases && (
            <Bar dataKey="purchases" name={purchasesLabel} fill="var(--chart-3)" radius={[4, 4, 0, 0]} maxBarSize={28} />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
