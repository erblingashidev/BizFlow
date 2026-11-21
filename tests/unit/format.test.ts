import { describe, expect, it } from "vitest";
import {
  formatCalendarDate,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercent,
  localDateTimeToUtcIso,
  timeZoneOffsetMinutes,
  todayInDisplayZone,
  toNumber,
} from "@/lib/format";

// Intl may use narrow no-break spaces; normalise for stable assertions.
const norm = (s: string) => s.replace(/[\u00a0\u202f]/g, " ");

describe("currency", () => {
  it("formats EUR in Albanian (default) and English", () => {
    expect(norm(formatCurrency(1234.5))).toBe("1 234,50 €");
    expect(norm(formatCurrency("1234.5", "sq"))).toBe("1 234,50 €");
    expect(formatCurrency(1234.5, "en")).toBe("€1,234.50");
    expect(norm(formatCurrency(-5))).toBe("-5,00 €");
    expect(formatCurrency(-0.001, "en")).toBe("€0.00");
    expect(norm(formatCurrency(1234567.891, "sq"))).toBe("1 234 567,89 €");
  });

  it("treats Postgres numeric strings and null safely", () => {
    expect(toNumber("19.00")).toBe(19);
    expect(toNumber(null)).toBe(0);
    expect(toNumber("abc")).toBe(0);
  });
});

describe("numbers", () => {
  it("formats quantities and VAT percentages per locale", () => {
    expect(norm(formatNumber(12345.678, "sq"))).toBe("12 345,678");
    expect(formatNumber(12345.678, "en")).toBe("12,345.678");
    expect(formatPercent(18, "sq")).toBe("18%");
    expect(formatPercent(8.5, "sq")).toBe("8,5%");
  });
});

describe("Europe/Belgrade display timezone", () => {
  it("shows UTC instants in local time (CET winter, CEST summer)", () => {
    expect(formatDateTime("2026-01-15T23:30:00Z", "sq")).toBe("16.01.2026, 00:30");
    expect(formatDateTime("2026-07-15T22:30:00Z", "en")).toBe("16/07/2026, 00:30");
    expect(formatDate("2026-07-15T22:30:00Z", "sq")).toBe("16.07.2026");
  });

  it("knows the offset on both sides of DST", () => {
    expect(timeZoneOffsetMinutes(new Date("2026-01-01T12:00:00Z"))).toBe(60);
    expect(timeZoneOffsetMinutes(new Date("2026-07-01T12:00:00Z"))).toBe(120);
  });

  it("converts local wall-clock input to UTC for storage", () => {
    expect(localDateTimeToUtcIso("2026-01-15T09:00")).toBe("2026-01-15T08:00:00.000Z");
    expect(localDateTimeToUtcIso("2026-07-15T09:00")).toBe("2026-07-15T07:00:00.000Z");
    expect(localDateTimeToUtcIso("2026-03-29T03:30")).toBe("2026-03-29T01:30:00.000Z");
    expect(() => localDateTimeToUtcIso("15/01/2026")).toThrow();
  });

  it("computes today's local date near midnight", () => {
    expect(todayInDisplayZone(new Date("2026-05-31T22:30:00Z"))).toBe("2026-06-01");
    expect(todayInDisplayZone(new Date("2026-05-31T21:30:00Z"))).toBe("2026-05-31");
  });

  it("formats calendar dates without timezone drift", () => {
    expect(formatCalendarDate("2026-12-31", "sq")).toBe("31.12.2026");
  });
});
