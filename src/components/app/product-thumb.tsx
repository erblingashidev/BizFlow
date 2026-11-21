import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

/** Signed-URL images are short-lived and private, so a plain <img> is used (no optimizer caching). */
export function ProductThumb({ url, alt, className }: { url?: string | null; alt: string; className?: string }) {
  return (
    <span className={cn("grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted", className)}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={alt} className="size-full object-cover" loading="lazy" />
      ) : (
        <Package className="size-4 text-muted-foreground" aria-hidden />
      )}
    </span>
  );
}
