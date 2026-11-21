"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { AuthError } from "@supabase/supabase-js";
import { getSiteUrl } from "@/lib/env";
import { invalidInput, type ActionResult } from "@/lib/actions";
import { getSafeRedirectPath, LOGIN_PATH, ONBOARDING_PATH } from "@/lib/auth/routes";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
  type ForgotPasswordInput,
  type LoginInput,
  type ResetPasswordInput,
  type SignupInput,
} from "@/lib/validation/auth";
import { resolveLocale } from "@/i18n/config";
import { getLocale } from "next-intl/server";

function authErrorKey(error: AuthError): string {
  switch (error.code) {
    case "invalid_credentials":
      return "auth.errors.invalidCredentials";
    case "email_not_confirmed":
      return "auth.errors.emailNotConfirmed";
    case "user_already_exists":
    case "email_exists":
      return "auth.errors.userExists";
    case "weak_password":
      return "validation.passwordWeak";
    case "same_password":
      return "auth.errors.samePassword";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "errors.rateLimited";
    default:
      return "errors.generic";
  }
}

async function requestMeta() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    ip: forwarded || h.get("x-real-ip") || null,
    userAgent: h.get("user-agent"),
    origin: h.get("origin"),
  };
}

export async function signInAction(input: LoginInput): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error || !data.session) {
    return { ok: false, error: error ? authErrorKey(error) : "errors.generic" };
  }

  // Audit the login with the service role for the user Supabase Auth just authenticated;
  // members cannot write login rows themselves. Failure to log must not block signing in.
  try {
    const meta = await requestMeta();
    const { error: logError } = await createAdminClient().rpc("log_login", {
      p_user_id: data.user.id,
      p_ip: meta.ip ?? undefined,
      p_user_agent: meta.userAgent ?? undefined,
    });
    if (logError) throw logError;
  } catch (logError) {
    console.error("log_login failed", logError);
  }

  redirect(getSafeRedirectPath(parsed.data.next));
}

export async function signUpAction(input: SignupInput): Promise<ActionResult<{ needsConfirmation: boolean }>> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const meta = await requestMeta();
  const locale = resolveLocale(await getLocale());
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName, locale },
      emailRedirectTo: `${getSiteUrl(meta.origin)}/auth/confirm?next=${encodeURIComponent(ONBOARDING_PATH)}`,
    },
  });
  if (error) return { ok: false, error: authErrorKey(error) };

  // With email confirmation on, Supabase returns no session (and hides whether the email exists).
  if (!data.session) return { ok: true, data: { needsConfirmation: true } };

  redirect(ONBOARDING_PATH);
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(LOGIN_PATH);
}

export async function requestPasswordResetAction(input: ForgotPasswordInput): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const meta = await requestMeta();
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${getSiteUrl(meta.origin)}/auth/confirm?next=${encodeURIComponent("/reset-password")}`,
  });

  // Same response whether or not the account exists, to avoid account enumeration.
  if (error && authErrorKey(error) === "errors.rateLimited") {
    return { ok: false, error: "errors.rateLimited" };
  }
  if (error) console.error("resetPasswordForEmail failed", error.code);
  return { ok: true, message: "auth.forgot.sent" };
}

export async function updatePasswordAction(input: ResetPasswordInput): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "auth.reset.expired" };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, error: authErrorKey(error) };

  redirect("/dashboard");
}
