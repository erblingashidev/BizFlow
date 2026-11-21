import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { NewPartyPage } from "@/components/parties/party-pages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("parties.customer");
  return { title: t("new") };
}

export default function Page() {
  return <NewPartyPage kind="customer" />;
}
