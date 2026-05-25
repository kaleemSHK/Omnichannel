import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export default getRequestConfig(async () => {
  // Read locale from cookie set at login, default to 'en'
  const cookieStore = await cookies();
  const locale = cookieStore.get('bn_locale')?.value ?? 'en';

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
