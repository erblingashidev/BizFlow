import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { FolderTree, Trash2 } from "lucide-react";
import { ActionButton } from "@/components/app/action-button";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePagePermission } from "@/lib/auth/session";
import { listCategories, sortCategoryTree } from "@/lib/data/catalog";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { ProductsTabs } from "../products-tabs";
import { deleteCategoryAction } from "./actions";
import { CategoryDialog } from "./category-dialog";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("categories");
  return { title: t("title") };
}

export default async function CategoriesPage() {
  const ctx = await requirePagePermission("products.view");
  const t = await getTranslations();
  const supabase = await createClient();
  const categories = await listCategories(supabase, ctx.company.id);

  const { data: productRows } = await supabase
    .from("products")
    .select("category_id")
    .eq("company_id", ctx.company.id)
    .is("deleted_at", null)
    .not("category_id", "is", null);
  const counts = new Map<string, number>();
  for (const row of productRows ?? []) {
    if (row.category_id) counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1);
  }

  const tree = sortCategoryTree(categories);
  const parents = categories.filter((c) => !c.parentId);
  const hasChildren = (id: string) => categories.some((c) => c.parentId === id);
  const canEdit = ctx.permissions.has("products.update");

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <PageHeader
        title={t("categories.title")}
        description={t("categories.subtitle")}
        actions={ctx.permissions.has("products.create") && <CategoryDialog parents={parents} />}
      />
      <ProductsTabs />
      <Card className="py-0">
        {tree.length === 0 ? (
          <EmptyState icon={FolderTree} title={t("categories.emptyTitle")} description={t("categories.emptyDescription")} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">{t("categories.name")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("categories.description")}</TableHead>
                <TableHead className="text-right">{t("categories.products")}</TableHead>
                <TableHead className="w-24 pr-4">
                  <span className="sr-only">{t("common.actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tree.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className={cn("pl-4 font-medium", c.depth && "pl-10")}>
                    {c.depth ? <span className="mr-1 text-muted-foreground">↳</span> : null}
                    <Link href={`/products?category=${c.id}`} className="hover:underline">
                      {c.name}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden max-w-80 truncate text-muted-foreground md:table-cell">{c.description || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{counts.get(c.id) ?? 0}</TableCell>
                  <TableCell className="pr-4">
                    <div className="flex justify-end gap-1">
                      {canEdit && (
                        <CategoryDialog
                          category={{ id: c.id, name: c.name, description: c.description, parentId: c.parentId, hasChildren: hasChildren(c.id) }}
                          parents={parents}
                        />
                      )}
                      {ctx.permissions.has("products.delete") && (
                        <ActionButton
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("common.delete")}
                          action={deleteCategoryAction.bind(null, c.id)}
                          confirm={{
                            title: t("categories.deleteTitle", { name: c.name }),
                            description: t("categories.deleteDescription"),
                            confirmLabel: t("common.delete"),
                            destructive: true,
                          }}
                        >
                          <Trash2 className="text-destructive" aria-hidden />
                        </ActionButton>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
