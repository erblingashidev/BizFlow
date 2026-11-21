import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Archive, ArchiveRestore, Plus, Trash2, Truck, Users } from "lucide-react";
import { ActionButton } from "@/components/app/action-button";
import { EmptyState } from "@/components/app/empty-state";
import { FilterBar } from "@/components/app/filter-bar";
import { NativeSelect } from "@/components/app/native-select";
import { PageHeader } from "@/components/app/page-header";
import { Pagination } from "@/components/app/pagination";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePagePermission } from "@/lib/auth/session";
import { oneOf, pageRange, param, sanitizeSearch, uuidParam, type SearchParams } from "@/lib/list-params";
import { deletePartyAction, setPartyActiveAction } from "@/lib/parties/actions";
import { createClient } from "@/lib/supabase/server";
import type { PartyInput, PartyKind } from "@/lib/validation/party";
import { PartyForm } from "./party-form";

const META = {
  customer: { table: "customers", module: "customers", path: "/customers", icon: Users },
  supplier: { table: "suppliers", module: "suppliers", path: "/suppliers", icon: Truck },
} as const;

const STATUSES = ["active", "archived", "all"] as const;

type PartyRow = {
  id: string;
  name: string;
  contact_person: string | null;
  business_number: string | null;
  vat_number: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country_code: string;
  notes: string | null;
  is_active: boolean;
  customer_type?: string;
};

const COLUMNS = "id, name, contact_person, business_number, vat_number, email, phone, address, city, country_code, notes, is_active";

export async function PartyListPage({ kind, searchParams }: { kind: PartyKind; searchParams: Promise<SearchParams> }) {
  const meta = META[kind];
  const ctx = await requirePagePermission(`${meta.module}.view`);
  const params = await searchParams;
  const t = await getTranslations();
  const supabase = await createClient();

  const q = sanitizeSearch(param(params, "q"));
  const status = oneOf(param(params, "status"), STATUSES) ?? "active";
  const { page, pageSize, from, to } = pageRange(params);

  const columns = kind === "customer" ? `${COLUMNS}, customer_type` : COLUMNS;
  let query = supabase
    .from(meta.table)
    .select(columns, { count: "exact" })
    .eq("company_id", ctx.company.id)
    .is("deleted_at", null)
    .order("name")
    .range(from, to);
  if (status === "active") query = query.eq("is_active", true);
  if (status === "archived") query = query.eq("is_active", false);
  if (q) {
    query = query.or(
      `name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,business_number.ilike.%${q}%,contact_person.ilike.%${q}%,city.ilike.%${q}%`,
    );
  }
  const { data, count, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as unknown as PartyRow[];
  const filtered = Boolean(q || status !== "active");
  const canCreate = ctx.permissions.has(`${meta.module}.create`);
  const newButton = canCreate && (
    <Link href={`${meta.path}/new`} className={buttonVariants()}>
      <Plus aria-hidden />
      {t(`parties.${kind}.new`)}
    </Link>
  );

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <PageHeader title={t(`nav.${meta.module}`)} description={t(`parties.${kind}.subtitle`)} actions={newButton} />
      <FilterBar action={meta.path} query={q} searchPlaceholder={t("parties.searchPlaceholder")}>
        <NativeSelect name="status" defaultValue={status} aria-label={t("products.statusLabel")} className="sm:w-40">
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`parties.statusFilter.${s}`)}
            </option>
          ))}
        </NativeSelect>
      </FilterBar>

      <Card className="py-0">
        {rows.length > 0 ? (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">{t("parties.name")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("parties.contact")}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t("parties.businessNumber")}</TableHead>
                  <TableHead className="pr-4">{t("parties.city")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="pl-4">
                      <Link href={`${meta.path}/${r.id}`} className="grid min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="truncate font-medium hover:underline">{r.name}</span>
                          {!r.is_active && <Badge variant="secondary">{t("parties.archivedBadge")}</Badge>}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {r.customer_type ? t(`parties.types.${r.customer_type}`) : r.contact_person || ""}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="grid text-sm">
                        <span className="truncate">{r.phone || "—"}</span>
                        {r.email && <span className="truncate text-xs text-muted-foreground">{r.email}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="hidden tabular-nums text-muted-foreground lg:table-cell">{r.business_number || "—"}</TableCell>
                    <TableCell className="pr-4 text-muted-foreground">{r.city || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination pathname={meta.path} params={params} page={page} pageSize={pageSize} total={count ?? 0} />
          </>
        ) : (
          <EmptyState
            icon={meta.icon}
            title={filtered ? t("common.noResults") : t(`parties.${kind}.emptyTitle`)}
            description={filtered ? t("common.noResultsHint") : t(`parties.${kind}.emptyDescription`)}
            action={!filtered && newButton}
          />
        )}
      </Card>
    </div>
  );
}

export function emptyParty(): PartyInput {
  return {
    name: "",
    customerType: "business",
    contactPerson: "",
    businessNumber: "",
    vatNumber: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    countryCode: "XK",
    notes: "",
  };
}

export async function NewPartyPage({ kind }: { kind: PartyKind }) {
  const meta = META[kind];
  await requirePagePermission(`${meta.module}.create`);
  const t = await getTranslations();
  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <PageHeader title={t(`parties.${kind}.new`)} />
      <PartyForm kind={kind} partyId={null} defaults={emptyParty()} />
    </div>
  );
}

export async function EditPartyPage({ kind, params }: { kind: PartyKind; params: Promise<{ id: string }> }) {
  const meta = META[kind];
  const ctx = await requirePagePermission(`${meta.module}.view`);
  const id = uuidParam((await params).id);
  if (!id) notFound();
  const t = await getTranslations();
  const supabase = await createClient();
  const columns = kind === "customer" ? `${COLUMNS}, customer_type` : COLUMNS;
  const { data } = await supabase
    .from(meta.table)
    .select(columns)
    .eq("id", id)
    .eq("company_id", ctx.company.id)
    .is("deleted_at", null)
    .maybeSingle();
  const party = data as unknown as PartyRow | null;
  if (!party) notFound();

  const canUpdate = ctx.permissions.has(`${meta.module}.update`);
  const defaults: PartyInput = {
    name: party.name,
    customerType: (party.customer_type as PartyInput["customerType"]) ?? "business",
    contactPerson: party.contact_person ?? "",
    businessNumber: party.business_number ?? "",
    vatNumber: party.vat_number ?? "",
    email: party.email ?? "",
    phone: party.phone ?? "",
    address: party.address ?? "",
    city: party.city ?? "",
    countryCode: party.country_code,
    notes: party.notes ?? "",
  };

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {party.name}
            {!party.is_active && <Badge variant="secondary">{t("parties.archivedBadge")}</Badge>}
          </span>
        }
        description={t(`parties.${kind}.editSubtitle`)}
        actions={
          <>
            {canUpdate && (
              <ActionButton size="default" action={setPartyActiveAction.bind(null, kind, party.id, !party.is_active)}>
                {party.is_active ? <Archive aria-hidden /> : <ArchiveRestore aria-hidden />}
                {party.is_active ? t("parties.archive") : t("parties.restore")}
              </ActionButton>
            )}
            {ctx.permissions.has(`${meta.module}.delete`) && (
              <ActionButton
                size="default"
                variant="destructive"
                action={deletePartyAction.bind(null, kind, party.id)}
                redirectTo={meta.path}
                confirm={{
                  title: t("parties.deleteTitle", { name: party.name }),
                  description: t("parties.deleteDescription"),
                  confirmLabel: t("common.delete"),
                  destructive: true,
                }}
              >
                <Trash2 aria-hidden />
                {t("common.delete")}
              </ActionButton>
            )}
          </>
        }
      />
      {canUpdate ? (
        <PartyForm kind={kind} partyId={party.id} defaults={defaults} />
      ) : (
        <Card className="p-4 text-sm">
          <dl className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["parties.businessNumber", party.business_number],
                ["parties.vatNumber", party.vat_number],
                ["parties.contactPerson", party.contact_person],
                ["parties.email", party.email],
                ["parties.phone", party.phone],
                ["parties.address", [party.address, party.city].filter(Boolean).join(", ")],
                ["parties.notes", party.notes],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <dt className="text-muted-foreground">{t(label)}</dt>
                <dd className="font-medium">{value || "—"}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}
    </div>
  );
}
