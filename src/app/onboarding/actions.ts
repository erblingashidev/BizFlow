"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { invalidInput, type ActionResult } from "@/lib/actions";
import { ACTIVE_COMPANY_COOKIE, getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { companyOnboardingSchema, type CompanyOnboardingInput } from "@/lib/validation/company";

/**
 * Creates the company, owner membership, trial subscription and defaults in one database
 * transaction (create_company RPC). The owner is always the authenticated caller.
 */
export async function createCompanyAction(input: CompanyOnboardingInput): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "errors.unauthenticated" };

  const parsed = companyOnboardingSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);
  const data = parsed.data;

  const supabase = await createClient();
  const { data: companyId, error } = await supabase.rpc("create_company", {
    p_name: data.name,
    p_plan_code: data.planCode,
    p_business_number: data.businessNumber,
    p_vat_number: data.vatNumber,
    p_phone: data.phone,
    p_city: data.city,
    p_address: data.address,
  });

  if (error || !companyId) {
    if (error?.hint === "company_limit") return { ok: false, error: "onboarding.errors.companyLimit" };
    if (error?.code === "23514") return { ok: false, error: "errors.invalidInput" };
    console.error("create_company failed", error?.code, error?.message);
    return { ok: false, error: "errors.generic" };
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_COMPANY_COOKIE, companyId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });

  redirect("/dashboard");
}
