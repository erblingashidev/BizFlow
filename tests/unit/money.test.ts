import { describe, expect, it } from "vitest";
import { calculateLine, sumLines, toCents } from "@/lib/money";

describe("money", () => {
  it("rounds to cents without float drift", () => {
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents("19.99")).toBe(1999);
    expect(toCents(1.005)).toBe(101);
    expect(() => toCents("x")).toThrow();
  });

  it("calculates a line with discount then 18% VAT", () => {
    expect(calculateLine({ quantity: 3, unitPrice: 4.5, discountPercent: 10, vatRate: 18 })).toEqual({
      subtotal: 13.5,
      discount: 1.35,
      tax: 2.19,
      total: 14.34,
    });
  });

  it("keeps total = subtotal - discount + tax (matches DB check constraint)", () => {
    const line = calculateLine({ quantity: 1.333, unitPrice: 7.77, discountPercent: 3.5, vatRate: 8 });
    expect(toCents(line.total)).toBe(toCents(line.subtotal) - toCents(line.discount) + toCents(line.tax));
  });

  it("sums lines exactly", () => {
    const lines = Array.from({ length: 10 }, () => calculateLine({ quantity: 1, unitPrice: 0.1 }));
    expect(sumLines(lines).total).toBe(1);
  });

  it("rejects invalid inputs", () => {
    expect(() => calculateLine({ quantity: -1, unitPrice: 1 })).toThrow();
    expect(() => calculateLine({ quantity: 1, unitPrice: 1, discountPercent: 101 })).toThrow();
    expect(() => calculateLine({ quantity: 1, unitPrice: 1, vatRate: -1 })).toThrow();
  });
});
