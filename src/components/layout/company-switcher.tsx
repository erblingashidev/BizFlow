"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Building2, Check, ChevronsUpDown, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setActiveCompanyAction } from "@/lib/preferences/actions";

type CompanyOption = { id: string; name: string; roleKey: string };

export function CompanySwitcher({ current, companies }: { current: CompanyOption; companies: CompanyOption[] }) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const choose = (id: string) => {
    if (id === current.id) return;
    startTransition(async () => {
      const result = await setActiveCompanyAction(id);
      if (result.ok) router.refresh();
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={pending}
        className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground">
          <Building2 className="size-4" aria-hidden />
        </span>
        <span className="grid min-w-0">
          <span className="truncate font-medium">{current.name}</span>
          <span className="truncate text-xs text-muted-foreground">{t(`roles.${current.roleKey}`)}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("topbar.switchCompany")}</DropdownMenuLabel>
          {companies.map((company) => (
            <DropdownMenuItem key={company.id} onClick={() => choose(company.id)}>
              <span className="flex-1 truncate">{company.name}</span>
              {company.id === current.id && <Check aria-hidden />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/onboarding?new=1")}>
          <Plus aria-hidden />
          {t("topbar.addCompany")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
