import "server-only";

import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { LOGIN_PATH, ONBOARDING_PATH } from "@/lib/auth/routes";
import {
  AuthorizationError,
  isUsableMembership,
  resolveActiveCompanyId,
  type CompanyRoleKey,
  type MembershipSummary,
  type Permission,
} from "@/lib/auth/permissions";

export const ACTIVE_COMPANY_COOKIE = "bf_company";

export type Membership = MembershipSummary & {
  membershipId: string;
  companyName: string;
  companySlug: string;
  roleKey: string;
  roleName: string;
};

export type Subscription = {
  status: string;
  planCode: string;
  planName: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  maxEmployees: number | null;
};

export type CompanyContext = {
  user: User;
  company: { id: string; name: string; slug: string };
  membership: Membership;
  role: CompanyRoleKey | string;
  permissions: ReadonlySet<Permission | string>;
  memberships: Membership[];
  subscription: Subscription | null;
};

/** The authenticated user, validated against Supabase Auth (not just the cookie). */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
});

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(LOGIN_PATH);
  return user;
}

/** Memberships of the current user, read through RLS (only their own rows are visible). */
export const getMemberships = cache(async (): Promise<Membership[]> => {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("company_members")
    .select("id, company_id, status, deleted_at, companies!inner(name, slug, status, deleted_at), roles!inner(key, name)")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    membershipId: row.id,
    companyId: row.company_id,
    status: row.status as Membership["status"],
    companyStatus: row.companies.status as Membership["companyStatus"],
    companyDeleted: row.companies.deleted_at !== null,
    companyName: row.companies.name,
    companySlug: row.companies.slug,
    roleKey: row.roles.key,
    roleName: row.roles.name,
  }));
});

/**
 * Resolves the company the request acts on and the caller's permissions there.
 * The active-company cookie is a hint only; membership and permissions always come from
 * the database for the authenticated user.
 */
export const getCompanyContext = cache(async (): Promise<CompanyContext | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const memberships = await getMemberships();
  const cookieStore = await cookies();
  const companyId = resolveActiveCompanyId(memberships, cookieStore.get(ACTIVE_COMPANY_COOKIE)?.value);
  if (!companyId) return null;

  const membership = memberships.find((m) => m.companyId === companyId)!;
  const supabase = await createClient();

  const [permissionsResult, subscriptionResult] = await Promise.all([
    supabase.rpc("my_permissions", { p_company_id: companyId }),
    supabase
      .from("subscriptions")
      .select("status, trial_ends_at, current_period_end, subscription_plans!inner(code, name, max_employees)")
      .eq("company_id", companyId)
      .in("status", ["trialing", "active", "past_due"])
      .maybeSingle(),
  ]);

  if (permissionsResult.error) throw permissionsResult.error;
  if (subscriptionResult.error) throw subscriptionResult.error;

  const sub = subscriptionResult.data;

  return {
    user,
    company: { id: companyId, name: membership.companyName, slug: membership.companySlug },
    membership,
    role: membership.roleKey,
    permissions: new Set((permissionsResult.data ?? []) as string[]),
    memberships: memberships.filter(isUsableMembership),
    subscription: sub
      ? {
          status: sub.status,
          planCode: sub.subscription_plans.code,
          planName: sub.subscription_plans.name,
          trialEndsAt: sub.trial_ends_at,
          currentPeriodEnd: sub.current_period_end,
          maxEmployees: sub.subscription_plans.max_employees,
        }
      : null,
  };
});

/** For pages: redirects to login / onboarding instead of throwing. */
export async function requireCompanyContext(): Promise<CompanyContext> {
  await requireUser();
  const context = await getCompanyContext();
  if (!context) redirect(ONBOARDING_PATH);
  return context;
}

/** For pages: responds 404 when the permission is missing, so pages don't reveal what exists. */
export async function requirePagePermission(permission: Permission): Promise<CompanyContext> {
  const context = await requireCompanyContext();
  if (!context.permissions.has(permission)) notFound();
  return context;
}

/** For server actions: throws AuthorizationError so the action can return a typed error. */
export async function authorizeAction(permission?: Permission): Promise<CompanyContext> {
  const user = await getCurrentUser();
  if (!user) throw new AuthorizationError("unauthenticated");
  const context = await getCompanyContext();
  if (!context) throw new AuthorizationError("no_company");
  if (permission && !context.permissions.has(permission)) {
    throw new AuthorizationError("forbidden", `Missing permission: ${permission}`);
  }
  return context;
}
