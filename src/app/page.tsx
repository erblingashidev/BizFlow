import { redirect } from "next/navigation";
import { getPublicSupabaseEnv } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth/session";

export default async function Home() {
  if (!getPublicSupabaseEnv()) redirect("/login");
  const user = await getCurrentUser();
  redirect(user ? "/dashboard" : "/login");
}
