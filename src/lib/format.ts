import { DEFAULT_CURRENCY, DISPLAY_TIME_ZONE, resolveLocale, type Locale } from "@/i18n/config";

type Numeric = number | string | null | undefined;

/** Postgres numeric values may arrive as strings; never use parseFloat on user input elsewhere. */
export function toNumber(value: Numeric): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

// Built from locale-independent Intl parts instead of locale data: browsers ship uneven ICU
// coverage for Albanian, and server/client output must match exactly to avoid hydration errors.
const SEPARATORS: Record<Locale, { group: string; decimal: string }> = {
  sq: { group: "\u00a0", decimal: "," },
  en: { group: ",", decimal: "." },
};

function formatDecimal(value: number, locale: Locale, minFraction: number, maxFraction: number) {
  const digits = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: minFraction,
    maximumFractionDigits: maxFraction,
    useGrouping: true,
  }).format(Math.abs(value));
  const { group, decimal } = SEPARATORS[locale];
  const body = digits.replace(/[,.]/g, (c) => (c === "," ? group : decimal));
  const sign = value < 0 && /[1-9]/.test(digits) ? "-" : "";
  return { sign, body };
}

const CURRENCY_SYMBOLS: Record<string, string> = { EUR: "€" };

/** 1 234,50 € (sq) or €1,234.50 (en). */
export function formatCurrency(value: Numeric, locale?: string, currency = DEFAULT_CURRENCY): string {
  const loc = resolveLocale(locale);
  const { sign, body } = formatDecimal(toNumber(value), loc, 2, 2);
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  return loc === "sq" ? `${sign}${body}\u00a0${symbol}` : `${sign}${symbol}${body}`;
}

export function formatNumber(value: Numeric, locale?: string, maximumFractionDigits = 3): string {
  const { sign, body } = formatDecimal(toNumber(value), resolveLocale(locale), 0, maximumFractionDigits);
  return `${sign}${body}`;
}

/** `value` is a percentage (18 → "18%"), matching how VAT rates are stored. */
export function formatPercent(value: Numeric, locale?: string): string {
  const { sign, body } = formatDecimal(toNumber(value), resolveLocale(locale), 0, 2);
  return `${sign}${body}%`;
}

function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

const pad = (n: number) => String(n).padStart(2, "0");

function datePattern(locale: Locale, year: number, month: number, day: number) {
  return locale === "sq" ? `${pad(day)}.${pad(month)}.${year}` : `${pad(day)}/${pad(month)}/${year}`;
}

/** Formats a UTC instant as a Kosovo-local date: 16.01.2026 (sq) or 16/01/2026 (en). */
export function formatDate(value: Date | string | number, locale?: string): string {
  const p = zonedParts(toDate(value), DISPLAY_TIME_ZONE);
  return datePattern(resolveLocale(locale), p.year, p.month, p.day);
}

export function formatDateTime(value: Date | string | number, locale?: string): string {
  const p = zonedParts(toDate(value), DISPLAY_TIME_ZONE);
  return `${datePattern(resolveLocale(locale), p.year, p.month, p.day)}, ${pad(p.hour)}:${pad(p.minute)}`;
}

/** Formats a calendar `date` column (YYYY-MM-DD) without shifting it across timezones. */
export function formatCalendarDate(value: string, locale?: string): string {
  const [y, m, d] = value.split("-").map(Number);
  return datePattern(resolveLocale(locale), y, m, d);
}

/** Offset of `timeZone` from UTC at `date`, in minutes (e.g. +60 in winter, +120 in summer). */
export function timeZoneOffsetMinutes(date: Date, timeZone = DISPLAY_TIME_ZONE): number {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/**
 * Converts a wall-clock time in the display timezone (e.g. from <input type="datetime-local">)
 * to a UTC ISO string for storage.
 */
export function localDateTimeToUtcIso(local: string, timeZone = DISPLAY_TIME_ZONE): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(local);
  if (!match) throw new Error(`Invalid local date-time: ${local}`);
  const [, y, mo, d, h = "0", mi = "0", s = "0"] = match;
  const wallAsUtc = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
  let offset = timeZoneOffsetMinutes(new Date(wallAsUtc), timeZone);
  let utc = wallAsUtc - offset * 60000;
  const corrected = timeZoneOffsetMinutes(new Date(utc), timeZone);
  if (corrected !== offset) {
    offset = corrected;
    utc = wallAsUtc - offset * 60000;
  }
  return new Date(utc).toISOString();
}

/** Today's calendar date in the display timezone, as YYYY-MM-DD. */
export function todayInDisplayZone(now: Date = new Date(), timeZone = DISPLAY_TIME_ZONE): string {
  const p = zonedParts(now, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}
