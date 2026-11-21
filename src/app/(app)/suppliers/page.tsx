import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PartyListPage } from "@/components/parties/party-pages";
import type { SearchParams } from "@/lib/list-params";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("suppliers") };
}

export default function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return <PartyListPage kind="supplier" searchParams={searchParams} />;
}
