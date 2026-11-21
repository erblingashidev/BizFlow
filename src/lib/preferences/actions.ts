"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { LOCALE_COOKIE, isLocale } from "@/i18n/config";
import { ACTIVE_COMPANY_COOKIE, getCurrentUser, getMemberships } from "@/lib/auth/session";
import { isUsableMembership } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions";

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function setLocaleAction(locale: string): Promise<ActionResult> {
  if (!isLocale(locale)) return { ok: false, error: "errors.invalidInput" };

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });

  const user = await getCurrentUser();
  if (user) {
    const supabase = await createClient();
    await supabase.from("profiles").update({ locale }).eq("id", user.id);
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Switches the active company after verifying the user is an active member of it. */
export async function setActiveCompanyAction(companyId: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(companyId).success) return { ok: false, error: "errors.invalidInput" };

  const memberships = await getMemberships();
  const allowed = memberships.some((m) => m.companyId === companyId && isUsableMembership(m));
  if (!allowed) return { ok: false, error: "errors.forbidden" };

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_COMPANY_COOKIE, companyId, {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });

  revalidatePath("/", "layout");
  return { ok: true };
}
