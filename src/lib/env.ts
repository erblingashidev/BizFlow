export type PublicSupabaseEnv = {
  url: string;
  anonKey: string;
};

/** Returns null when Supabase is not configured so pages can render a setup notice. */
export function getPublicSupabaseEnv(): PublicSupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function requirePublicSupabaseEnv(): PublicSupabaseEnv {
  const env = getPublicSupabaseEnv();
  if (!env) {
    throw new Error(
      "Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see .env.example).",
    );
  }
  return env;
}

export function getSiteUrl(fallbackOrigin?: string | null): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  const url = configured || fallbackOrigin || "http://localhost:3000";
  return url.replace(/\/+$/, "");
}
