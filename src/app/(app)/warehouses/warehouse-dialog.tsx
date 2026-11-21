"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { FormField, FormMessage } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { applyActionErrors } from "@/lib/forms";
import { warehouseSchema, type WarehouseInput } from "@/lib/validation/catalog";
import { saveWarehouseAction } from "./actions";

export function WarehouseDialog({
  warehouse,
}: {
  warehouse?: { id: string; name: string; code: string; city: string | null; address: string | null };
}) {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const defaults: WarehouseInput = {
    name: warehouse?.name ?? "",
    code: warehouse?.code ?? "",
    city: warehouse?.city ?? "",
    address: warehouse?.address ?? "",
  };
  const form = useForm<WarehouseInput>({ resolver: zodResolver(warehouseSchema), defaultValues: defaults });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await saveWarehouseAction(warehouse?.id ?? null, values);
      const error = applyActionErrors(result, form.setError);
      if (!result.ok) {
        setFormError(error);
        return;
      }
      toast.success(t(warehouse ? "warehouses.updated" : "warehouses.created"));
      setOpen(false);
      router.refresh();
    });
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) form.reset(defaults);
        setFormError(null);
      }}
    >
      <DialogTrigger
        render={warehouse ? <Button variant="ghost" size="icon-sm" aria-label={t("common.edit")} /> : <Button />}
      >
        {warehouse ? (
          <Pencil aria-hidden />
        ) : (
          <>
            <Plus aria-hidden />
            {t("warehouses.new")}
          </>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{warehouse ? t("warehouses.edit") : t("warehouses.new")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <FormMessage tone="error" message={formError} />
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label={t("warehouses.name")} error={errors.name?.message} className="sm:col-span-2">
              {(f) => <Input {...f} {...form.register("name")} autoComplete="off" />}
            </FormField>
            <FormField label={t("warehouses.code")} error={errors.code?.message} hint={t("warehouses.codeHint")}>
              {(f) => <Input {...f} {...form.register("code")} autoComplete="off" className="uppercase" maxLength={20} />}
            </FormField>
          </div>
          <FormField label={t("warehouses.city")} error={errors.city?.message} optional>
            {(f) => <Input {...f} {...form.register("city")} autoComplete="address-level2" />}
          </FormField>
          <FormField label={t("warehouses.address")} error={errors.address?.message} optional>
            {(f) => <Input {...f} {...form.register("address")} autoComplete="street-address" />}
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
