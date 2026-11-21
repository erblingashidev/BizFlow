import { z } from "zod";

/**
 * Parses a user-typed decimal. Accepts "1234.5", "1234,5", "1 234,50" and "1.234,50"
 * (when both separators appear, the last one is the decimal separator). Returns null for
 * anything that is not a plain decimal number.
 */
export function parseDecimal(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;
  let s = raw.replace(/[\s\u00a0\u202f]/g, "");
  if (s === "") return null;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma !== -1 && lastDot !== -1) {
    const decimal = lastComma > lastDot ? "," : ".";
    const group = decimal === "," ? "." : ",";
    s = s.split(group).join("").replace(decimal, ".");
  } else if (lastComma !== -1) {
    s = s.replace(",", ".");
  }

  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function fractionDigits(n: number): number {
  const text = String(n);
  if (text.includes("e-")) return Number(text.split("e-")[1]);
  return text.split(".")[1]?.length ?? 0;
}

type DecimalOptions = { scale: number; min?: number; max?: number; positive?: boolean; nonZero?: boolean };

const MAX_NUMERIC_14 = 999_999_999_999;

function decimal({ scale, min = 0, max = MAX_NUMERIC_14, positive, nonZero }: DecimalOptions) {
  return z
    .union([z.string(), z.number()])
    .transform((value, ctx) => {
      const n = parseDecimal(value);
      if (n === null) {
        ctx.addIssue({ code: "custom", message: value === "" ? "validation.required" : "validation.number" });
        return z.NEVER;
      }
      if (fractionDigits(n) > scale) {
        ctx.addIssue({ code: "custom", message: scale === 2 ? "validation.decimals2" : "validation.decimals3" });
        return z.NEVER;
      }
      if (positive && n <= 0) {
        ctx.addIssue({ code: "custom", message: "validation.positive" });
        return z.NEVER;
      }
      if (nonZero && n === 0) {
        ctx.addIssue({ code: "custom", message: "validation.nonZero" });
        return z.NEVER;
      }
      if (n < min) {
        ctx.addIssue({ code: "custom", message: "validation.nonNegative" });
        return z.NEVER;
      }
      if (n > max) {
        ctx.addIssue({ code: "custom", message: "validation.tooLarge" });
        return z.NEVER;
      }
      return n;
    });
}

/** Money: up to 2 decimals, non-negative unless `min` says otherwise. */
export const money = (opts: Partial<DecimalOptions> = {}) => decimal({ scale: 2, ...opts });
/** Stock quantities: up to 3 decimals. */
export const quantity = (opts: Partial<DecimalOptions> = {}) => decimal({ scale: 3, ...opts });

/** Optional decimal: empty input becomes undefined. */
export function optionalDecimal(schema: ReturnType<typeof decimal>) {
  return z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((v) => (v === "" || v === null || v === undefined ? undefined : v))
    .pipe(z.union([z.undefined(), schema]));
}

export const requiredText = (max: number, min = 1) =>
  z
    .string({ error: "validation.required" })
    .trim()
    .min(min, min > 1 ? "validation.nameMin" : "validation.required")
    .max(max, "validation.tooLong");

export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "validation.tooLong")
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const uuid = () => z.uuid({ error: "validation.required" });

export const optionalUuid = () =>
  z
    .union([z.uuid(), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v ? v : null));

export const optionalEmail = () =>
  z
    .string()
    .trim()
    .max(254, "validation.tooLong")
    .optional()
    .nullable()
    .transform((v) => (v ? v.toLowerCase() : null))
    .refine((v) => v === null || z.email().safeParse(v).success, "validation.email");

export const optionalPhone = () =>
  z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^\+?[0-9\s()-]{6,20}$/.test(v), "validation.phone");

/** NUI / fiscal number: 6–12 digits, spaces ignored. */
export const optionalBusinessNumber = () =>
  z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v ? v.replace(/\s+/g, "") : null))
    .refine((v) => v === null || /^\d{6,12}$/.test(v), "validation.businessNumber");
