import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { DISPLAY_TIME_ZONE, LOCALE_COOKIE, resolveLocale } from "./config";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get(LOCALE_COOKIE)?.value);

  return {
    locale,
    timeZone: DISPLAY_TIME_ZONE,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
