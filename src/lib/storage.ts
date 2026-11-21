import "server-only";

import type { DbClient } from "@/lib/server-action";

/**
 * Short-lived signed URLs for private product images, keyed by path. Signing runs as the
 * user, so storage RLS decides which images can be shown.
 */
export async function signedProductImageUrls(supabase: DbClient, paths: (string | null | undefined)[], expiresIn = 3600) {
  const unique = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  const urls = new Map<string, string>();
  if (unique.length === 0) return urls;
  const { data, error } = await supabase.storage.from("product-images").createSignedUrls(unique, expiresIn);
  if (error) {
    console.error("sign product images failed", error.message);
    return urls;
  }
  for (const item of data ?? []) {
    if (item.signedUrl && item.path) urls.set(item.path, item.signedUrl);
  }
  return urls;
}
