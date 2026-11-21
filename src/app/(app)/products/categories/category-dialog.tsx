"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { NativeSelect } from "@/components/app/native-select";
import { FormField, FormMessage } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { applyActionErrors } from "@/lib/forms";
import { categorySchema, type CategoryInput } from "@/lib/validation/catalog";
import { saveCategoryAction } from "./actions";

export function CategoryDialog({
  category,
  parents,
}: {
  category?: { id: string; name: string; description: string | null; parentId: string | null; hasChildren: boolean };
  parents: { id: string; name: string }[];
}) {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const defaults: CategoryInput = {
    name: category?.name ?? "",
    description: category?.description ?? "",
    parentId: category?.parentId ?? "",
  };
  const form = useForm<CategoryInput>({ resolver: zodResolver(categorySchema), defaultValues: defaults });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await saveCategoryAction(category?.id ?? null, values);
      const error = applyActionErrors(result, form.setError);
      if (!result.ok) {
        setFormError(error);
        return;
      }
      toast.success(t(category ? "categories.updated" : "categories.created"));
      setOpen(false);
      form.reset(category ? values : defaults);
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
        render={
          category ? (
            <Button variant="ghost" size="icon-sm" aria-label={t("common.edit")} />
          ) : (
            <Button />
          )
        }
      >
        {category ? (
          <Pencil aria-hidden />
        ) : (
          <>
            <Plus aria-hidden />
            {t("categories.new")}
          </>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{category ? t("categories.edit") : t("categories.new")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <FormMessage tone="error" message={formError} />
          <FormField label={t("categories.name")} error={errors.name?.message}>
            {(f) => <Input {...f} {...form.register("name")} autoComplete="off" />}
          </FormField>
          {!category?.hasChildren && (
            <FormField label={t("categories.parent")} error={errors.parentId?.message} optional>
              {(f) => (
                <NativeSelect {...f} {...form.register("parentId")}>
                  <option value="">{t("categories.noParent")}</option>
                  {parents
                    .filter((p) => p.id !== category?.id)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </NativeSelect>
              )}
            </FormField>
          )}
          <FormField label={t("categories.description")} error={errors.description?.message} optional>
            {(f) => <Textarea {...f} {...form.register("description")} rows={2} />}
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
