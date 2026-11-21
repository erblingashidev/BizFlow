"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { searchProductsAction, type ProductOption } from "../products/actions";

/** Typeahead over the company's stock-tracked products (searched server-side). */
export function ProductPicker({
  value,
  onChange,
  invalid,
  id,
}: {
  value: ProductOption | null;
  onChange: (product: ProductOption | null) => void;
  invalid?: boolean;
  id?: string;
}) {
  const t = useTranslations("inventory");
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<ProductOption[]>([]);
  const [active, setActive] = useState(0);
  const requestId = useRef(0);

  useEffect(() => {
    if (!open) return;
    const current = ++requestId.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      const result = await searchProductsAction(query);
      if (current !== requestId.current) return;
      setOptions(result.ok ? (result.data ?? []) : []);
      setActive(0);
      setLoading(false);
    }, 200);
    return () => clearTimeout(timer);
  }, [query, open]);

  if (value) {
    return (
      <div className="flex h-8 items-center justify-between gap-2 rounded-lg border border-input bg-muted/40 px-2.5 text-sm">
        <span className="truncate">
          <span className="font-medium">{value.name}</span>
          <span className="text-muted-foreground"> · {value.sku}</span>
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={t("changeProduct")}
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    );
  }

  const choose = (option: ProductOption | undefined) => {
    if (!option) return;
    onChange(option);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-invalid={invalid}
        aria-autocomplete="list"
        autoComplete="off"
        value={query}
        placeholder={t("searchProduct")}
        className="pl-8"
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, options.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            choose(options[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border bg-popover p-1 text-sm shadow-md"
        >
          {loading && options.length === 0 ? (
            <li className="flex items-center gap-2 px-2 py-1.5 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {t("searching")}
            </li>
          ) : options.length === 0 ? (
            <li className="px-2 py-1.5 text-muted-foreground">{t("noProductsFound")}</li>
          ) : (
            options.map((option, index) => (
              <li
                key={option.id}
                role="option"
                aria-selected={index === active}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(option)}
                onMouseEnter={() => setActive(index)}
                className={cn("cursor-pointer rounded-md px-2 py-1.5", index === active && "bg-accent text-accent-foreground")}
              >
                <span className="font-medium">{option.name}</span>
                <span className="text-muted-foreground"> · {option.sku}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
