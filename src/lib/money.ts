/**
 * Cent-based money arithmetic for line and document totals. Mirrors the database
 * check constraints (line_total = subtotal - discount + tax, all rounded to 2 decimals).
 */

export function toCents(value: number | string): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) throw new Error(`Invalid amount: ${value}`);
  return Math.round((n + Number.EPSILON * Math.sign(n)) * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export type LineInput = {
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
  vatRate?: number;
};

export type LineTotals = {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
};

/** Prices are VAT-exclusive; VAT applies after the discount. */
export function calculateLine({ quantity, unitPrice, discountPercent = 0, vatRate = 0 }: LineInput): LineTotals {
  if (quantity < 0 || unitPrice < 0) throw new Error("Quantity and price must be non-negative");
  if (discountPercent < 0 || discountPercent > 100) throw new Error("Discount must be 0-100%");
  if (vatRate < 0 || vatRate > 100) throw new Error("VAT rate must be 0-100%");

  const subtotalCents = Math.round(toCents(unitPrice) * quantity);
  const discountCents = Math.round((subtotalCents * discountPercent) / 100);
  const taxCents = Math.round(((subtotalCents - discountCents) * vatRate) / 100);
  return {
    subtotal: fromCents(subtotalCents),
    discount: fromCents(discountCents),
    tax: fromCents(taxCents),
    total: fromCents(subtotalCents - discountCents + taxCents),
  };
}

export function sumLines(lines: LineTotals[]): LineTotals {
  const sum = (pick: (l: LineTotals) => number) => fromCents(lines.reduce((acc, l) => acc + toCents(pick(l)), 0));
  return {
    subtotal: sum((l) => l.subtotal),
    discount: sum((l) => l.discount),
    tax: sum((l) => l.tax),
    total: sum((l) => l.total),
  };
}
