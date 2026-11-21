import { Logo } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { CompanySwitcher } from "@/components/layout/company-switcher";
import { MobileNav } from "@/components/layout/mobile-nav";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { UserMenu } from "@/components/layout/user-menu";
import { visibleNavSections } from "@/components/layout/nav-items";
import { requireCompanyContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const context = await requireCompanyContext();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", context.user.id)
    .maybeSingle();

  const allowedKeys = visibleNavSections(context.permissions).flatMap((s) => s.items.map((i) => i.key));
  const email = profile?.email ?? context.user.email ?? "";
  const name = profile?.full_name || email;

  const companies = context.memberships.map((m) => ({ id: m.companyId, name: m.companyName, roleKey: m.roleKey }));
  const current = companies.find((c) => c.id === context.company.id)!;

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r bg-sidebar lg:flex">
        <div className="flex h-16 items-center px-5">
          <Logo />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <SidebarNav allowedKeys={allowedKeys} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-card/90 px-3 backdrop-blur sm:px-6">
          <MobileNav allowedKeys={allowedKeys} />
          <CompanySwitcher current={current} companies={companies} />
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <LanguageSwitcher className="hidden sm:inline-flex" />
            <UserMenu name={name} email={email} />
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
