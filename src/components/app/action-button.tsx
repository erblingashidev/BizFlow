"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/actions";

type Variant = "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
type Size = "default" | "xs" | "sm" | "lg" | "icon" | "icon-sm";

/** Toasts the (translated) result of a server action and refreshes server data on success. */
export function useActionRunner() {
  const t = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const tr = (key: string) => (t.has(key) ? t(key) : t("errors.generic"));

  const run = (action: () => Promise<ActionResult<unknown>>, onSuccess?: () => void, redirectTo?: string) =>
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        if (result.message) toast.success(tr(result.message));
        onSuccess?.();
        if (redirectTo) router.push(redirectTo);
        router.refresh();
      } else {
        toast.error(tr(result.error));
      }
    });

  return { run, pending };
}

export function ActionButton({
  action,
  children,
  variant = "outline",
  size = "sm",
  confirm,
  redirectTo,
  className,
  "aria-label": ariaLabel,
}: {
  action: () => Promise<ActionResult<unknown>>;
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  /** When set, asks for confirmation first. */
  confirm?: { title: string; description?: string; confirmLabel: string; destructive?: boolean };
  /** Navigate here after success (e.g. leave a page whose record was deleted). */
  redirectTo?: string;
  className?: string;
  "aria-label"?: string;
}) {
  const t = useTranslations("common");
  const { run, pending } = useActionRunner();
  const [open, setOpen] = useState(false);

  if (!confirm) {
    return (
      <Button variant={variant} size={size} disabled={pending} className={className} aria-label={ariaLabel} onClick={() => run(action, undefined, redirectTo)}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {children}
      </Button>
    );
  }

  return (
    <>
      <Button variant={variant} size={size} disabled={pending} className={className} aria-label={ariaLabel} onClick={() => setOpen(true)}>
        {pending && <Loader2 className="animate-spin" aria-hidden />}
        {children}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm.title}</AlertDialogTitle>
            {confirm.description && <AlertDialogDescription>{confirm.description}</AlertDialogDescription>}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant={confirm.destructive ? "destructive" : "default"}
              disabled={pending}
              onClick={() => run(action, () => setOpen(false), redirectTo)}
            >
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              {confirm.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
