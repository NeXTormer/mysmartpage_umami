'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, useTheme, ZenProvider } from '@umami/react-zen';
import { NextIntlClientProvider } from 'next-intl';
import { type ReactNode, useEffect } from 'react';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { useLocale } from '@/components/hooks';
import { type Config, ConfigContext } from '@/components/hooks/useConfig';
import { FlagsContext, type FlagValues } from '@/components/hooks/useFlag';
import 'chartjs-adapter-date-fns';

const client = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60,
    },
  },
});

function MessagesProvider({ children }) {
  const { locale, messages, dir } = useLocale();

  useEffect(() => {
    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', locale);
  }, [locale, dir]);

  return (
    <NextIntlClientProvider locale={locale} messages={messages[locale]} onError={() => null}>
      {children}
    </NextIntlClientProvider>
  );
}

// NUMI build: the UI is light-only.
function ForceLightMode() {
  const { setTheme } = useTheme();

  useEffect(() => {
    setTheme('light');
  }, [setTheme]);

  return null;
}

export function Providers({
  config,
  flags,
  children,
}: {
  config: Config;
  flags: FlagValues;
  children: ReactNode;
}) {
  return (
    <ConfigContext.Provider value={config}>
      <FlagsContext.Provider value={flags}>
        <ZenProvider>
          <ForceLightMode />
          <RouterProvider>
            <MessagesProvider>
              <QueryClientProvider client={client}>
                <ErrorBoundary>{children}</ErrorBoundary>
              </QueryClientProvider>
            </MessagesProvider>
          </RouterProvider>
        </ZenProvider>
      </FlagsContext.Provider>
    </ConfigContext.Provider>
  );
}
