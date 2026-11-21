import { z } from "zod";
import {
  optionalBusinessNumber,
  optionalEmail,
  optionalPhone,
  optionalText,
  requiredText,
} from "./common";

export const PARTY_KINDS = ["customer", "supplier"] as const;
export type PartyKind = (typeof PARTY_KINDS)[number];

export const partySchema = z.object({
  name: requiredText(200),
  customerType: z.enum(["business", "individual"]).default("business"),
  contactPerson: optionalText(120),
  businessNumber: optionalBusinessNumber(),
  vatNumber: optionalText(32),
  email: optionalEmail(),
  phone: optionalPhone(),
  address: optionalText(300),
  city: optionalText(100),
  countryCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "validation.countryCode")
    .default("XK"),
  notes: optionalText(2000),
});

export type PartyInput = z.input<typeof partySchema>;
export type PartyData = z.output<typeof partySchema>;
