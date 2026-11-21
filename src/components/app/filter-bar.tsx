"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * GET form for list filters: state lives in the URL, so filtered views are shareable and
 * work without client state. Select changes submit immediately; text search on Enter.
 */
export function FilterBar({
  action,
  query,
  searchPlaceholder,
  children,
}: {
  action: string;
  query?: string;
  searchPlaceholder?: string;
  children?: ReactNode;
}) {
  const t = useTranslations("common");
  return (
    <form
      action={action}
      method="get"
      role="search"
      className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center"
      onChange={(event) => {
        if (event.target instanceof HTMLSelectElement || (event.target instanceof HTMLInputElement && event.target.type === "date")) {
          event.currentTarget.requestSubmit();
        }
      }}
    >
      {searchPlaceholder !== undefined && (
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            name="q"
            defaultValue={query}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="bg-card pl-8"
            maxLength={80}
          />
        </div>
      )}
      {children}
      <Button type="submit" variant="outline" className="sm:ml-0">
        {t("filter")}
      </Button>
    </form>
  );
}
