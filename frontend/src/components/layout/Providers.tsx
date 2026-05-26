'use client';

import { useLayoutEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/store/auth';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl';
import { Toaster } from 'sonner';
import { BrandingProvider } from '@/components/providers/BrandingProvider';

export function Providers({
  children,
  locale,
  messages,
}: {
  children: React.ReactNode;
  locale: string;
  messages: AbstractIntlMessages;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1 },
        },
      }),
  );

  const hydrateFromSession = useAuthStore(s => s.hydrateFromSession);
  useLayoutEffect(() => {
    hydrateFromSession();
  }, [hydrateFromSession]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* BrandingProvider fetches tenant colors/logo after login and injects CSS vars */}
      <BrandingProvider>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
          <Toaster richColors position="top-right" />
        </NextIntlClientProvider>
      </BrandingProvider>
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
