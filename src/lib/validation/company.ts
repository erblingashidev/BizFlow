import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "validation.tooLong")
    .optional()
    .transform((v) => (v ? v : undefined));

export const PLAN_CODES = ["starter", "professional", "business"] as const;

export const companyOnboardingSchema = z.object({
  name: z.string().trim().min(2, "validation.companyNameMin").max(120, "validation.tooLong"),
  // NUI (Numri Unik Identifikues) / fiscal number: digits only.
  businessNumber: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.replace(/\s+/g, "") : undefined))
    .refine((v) => v === undefined || /^\d{6,12}$/.test(v), "validation.businessNumber"),
  vatNumber: optionalText(32),
  phone: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined))
    .refine((v) => v === undefined || /^\+?[0-9\s()-]{6,20}$/.test(v), "validation.phone"),
  city: optionalText(100),
  address: optionalText(300),
  planCode: z.enum(PLAN_CODES, { error: "validation.plan" }),
});

export type CompanyOnboardingInput = z.input<typeof companyOnboardingSchema>;
export type CompanyOnboardingData = z.output<typeof companyOnboardingSchema>;
