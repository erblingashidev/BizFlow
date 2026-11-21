export const PAGE_SIZE = 20;

export type SearchParams = Record<string, string | string[] | undefined>;

export function param(params: SearchParams, key: string): string | undefined {
  const value = params[key];
  const first = Array.isArray(value) ? value[0] : value;
  return first?.trim() || undefined;
}

export function oneOf<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function uuidParam(value: string | undefined): string | undefined {
  return value && UUID_RE.test(value) ? value.toLowerCase() : undefined;
}

/** YYYY-MM-DD only. */
export function dateParam(value: string | undefined): string | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value ? undefined : value;
}

export function pageRange(params: SearchParams, pageSize = PAGE_SIZE) {
  const raw = Number(param(params, "page") ?? "1");
  const page = Number.isInteger(raw) && raw > 0 && raw < 10_000 ? raw : 1;
  const from = (page - 1) * pageSize;
  return { page, pageSize, from, to: from + pageSize - 1 };
}

/**
 * Makes free text safe to embed in a PostgREST `or=(...)`/`ilike` filter: drops the filter
 * syntax characters (, ( ) : " \) and the % / * wildcards, collapses whitespace. `_` stays: as
 * a LIKE wildcard it only widens a match by one character.
 */
export function sanitizeSearch(value: string | undefined, max = 80): string | undefined {
  if (!value) return undefined;
  const cleaned = value
    .replace(/[,()":\\%*]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
  return cleaned || undefined;
}

/** Builds a URL for the same list with some params changed (undefined/"" removes a param). */
export function listHref(pathname: string, params: SearchParams, changes: Record<string, string | number | undefined>) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const v = Array.isArray(value) ? value[0] : value;
    if (v) next.set(key, v);
  }
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined || value === "") next.delete(key);
    else next.set(key, String(value));
  }
  const qs = next.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
