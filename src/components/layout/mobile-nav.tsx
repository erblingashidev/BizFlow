"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { SidebarNav } from "./sidebar-nav";

export function MobileNav({ allowedKeys }: { allowedKeys: string[] }) {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label={t("openMenu")}>
            <Menu />
          </Button>
        }
      />
      <SheetContent side="left" className="w-72 p-0">
        <div className="border-b px-5 py-4">
          <SheetTitle render={<div />}>
            <Logo />
          </SheetTitle>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <SidebarNav allowedKeys={allowedKeys} onNavigate={() => setOpen(false)} />
        </div>
        <div className="border-t px-5 py-4">
          <LanguageSwitcher />
        </div>
      </SheetContent>
    </Sheet>
  );
}
