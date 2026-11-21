import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActionResult } from "@/lib/actions";
import { AuthorizationError, type Permission } from "@/lib/auth/permissions";
import { authorizeAction, type CompanyContext } from "@/lib/auth/session";
import { dbErrorResult, isKnownDbError } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type DbClient = SupabaseClient<Database>;

/**
 * Runs a server action body for the caller's active company after checking `permission`.
 * The company always comes from the server-resolved context, never from client input, and
 * every query runs as the signed-in user so RLS applies as a second line of defence.
 */
export async function companyAction<T>(
  permission: Permission | Permission[],
  body: (ctx: CompanyContext, supabase: DbClient) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  let ctx: CompanyContext;
  try {
    const required = Array.isArray(permission) ? permission : [permission];
    ctx = await authorizeAction(required[0]);
    if (required.some((p) => !ctx.permissions.has(p))) {
      return { ok: false, error: "errors.forbidden" };
    }
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return { ok: false, error: error.code === "unauthenticated" ? "errors.unauthenticated" : "errors.forbidden" };
    }
    throw error;
  }

  try {
    return await body(ctx, await createClient());
  } catch (error) {
    console.error("server action failed", error);
    return { ok: false, error: "errors.generic" };
  }
}

/** Converts a Supabase error into an ActionResult, logging the ones users can't act on. */
export function failFromDb(error: { code?: string; message?: string; hint?: string | null }, context: string) {
  if (!isKnownDbError(error)) console.error(context, error.code, error.message);
  return dbErrorResult(error);
}
