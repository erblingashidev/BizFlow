import type { z } from "zod";

/**
 * Result returned by server actions. `error` and field errors are i18n keys so the client
 * can translate them; never put raw database messages in front of users.
 */
export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | ActionFailure;

export type ActionFailure = { ok: false; error: string; fieldErrors?: Record<string, string> };

export function fieldErrorsFromZod(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

export function invalidInput(error: z.ZodError): ActionFailure {
  return { ok: false, error: "errors.invalidInput", fieldErrors: fieldErrorsFromZod(error) };
}
