import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicSupabaseEnv } from "@/lib/env";
import {
  DEFAULT_AUTHENTICATED_PATH,
  LOGIN_PATH,
  isGuestOnlyPath,
  isPublicPath,
} from "@/lib/auth/routes";
import type { Database } from "@/types/database";

/**
 * Refreshes the Supabase session cookie on every request and gates protected routes.
 * Page-level checks (requireUser / requireCompanyContext) remain the real authorization;
 * this only provides fast redirects.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = getPublicSupabaseEnv();
  if (!env) return response;

  const supabase = createServerClient<Database>(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() validates the JWT with Supabase Auth; do not replace with getSession().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  const redirectTo = (path: string, params?: Record<string, string>) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    for (const [key, value] of Object.entries(params ?? {})) url.searchParams.set(key, value);
    const redirect = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  };

  if (!user && !isPublicPath(pathname)) {
    return redirectTo(LOGIN_PATH, { next: `${pathname}${search}` });
  }

  if (user && isGuestOnlyPath(pathname)) {
    return redirectTo(DEFAULT_AUTHENTICATED_PATH);
  }

  return response;
}
