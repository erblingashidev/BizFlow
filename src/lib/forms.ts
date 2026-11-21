import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import type { ActionResult } from "@/lib/actions";

/** Copies server-side field errors onto a react-hook-form instance; returns the form-level error. */
export function applyActionErrors<T extends FieldValues>(
  result: ActionResult<unknown> | undefined,
  setError: UseFormSetError<T>,
): string | null {
  if (!result || result.ok) return null;
  for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
    setError(field as Path<T>, { type: "server", message });
  }
  return result.error;
}
