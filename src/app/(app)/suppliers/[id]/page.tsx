import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EditPartyPage } from "@/components/parties/party-pages";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("suppliers") };
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <EditPartyPage kind="supplier" params={params} />;
}
