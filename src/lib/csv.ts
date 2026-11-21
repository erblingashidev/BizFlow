import { resolveLocale } from "@/i18n/config";

export type CsvCell = string | number | null | undefined;

/**
 * Spreadsheet-safe CSV cell: quotes when needed and neutralises formula injection (cells
 * starting with = + - @ tab or CR are prefixed with an apostrophe). Numbers are passed as
 * numbers and are never prefixed.
 */
export function csvCell(value: CsvCell, delimiter: string, locale?: string): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    const text = Number.isFinite(value) ? String(value) : "";
    return resolveLocale(locale) === "sq" ? text.replace(".", ",") : text;
  }
  let text = value;
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (text.includes(delimiter) || /["\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

/**
 * UTF-8 CSV with BOM. Albanian uses `;` as delimiter and `,` as decimal separator so Excel
 * with Kosovo regional settings opens it correctly; English uses `,` and `.`.
 */
export function toCsv(rows: CsvCell[][], locale?: string): string {
  const delimiter = resolveLocale(locale) === "sq" ? ";" : ",";
  const body = rows.map((row) => row.map((cell) => csvCell(cell, delimiter, locale)).join(delimiter)).join("\r\n");
  return `\uFEFF${body}\r\n`;
}
