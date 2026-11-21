export const locales = ["sq", "en"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "sq";
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** Display timezone for Kosovo. Values are stored in UTC (timestamptz). */
export const DISPLAY_TIME_ZONE = "Europe/Belgrade";
export const DEFAULT_CURRENCY = "EUR";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

export function resolveLocale(value: unknown): Locale {
  return isLocale(value) ? value : defaultLocale;
}
