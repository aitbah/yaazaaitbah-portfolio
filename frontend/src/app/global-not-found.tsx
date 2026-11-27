import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';

import { NotFoundMessage } from '@/components/not-found-message';
import { ThemeScript } from '@/components/theme/theme-script';
import { localeDirection } from '@/i18n/routing';

import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('errors');

  return { title: t('notFoundTitle') };
}

/**
 * Every address that matches no route, as a complete document, so it arrives
 * with the stylesheet and the theme script instead of Next's unstyled shell. It
 * supplies what the layouts would: direction, theme and translations. The
 * locale is the proxy's, or the default.
 */
export default async function GlobalNotFound() {
  const locale = await getLocale();

  return (
    <html lang={locale} dir={localeDirection(locale)} suppressHydrationWarning>
      <body>
        <ThemeScript />
        <NextIntlClientProvider locale={locale}>
          <main className="flex min-h-svh flex-col items-center justify-center p-8">
            <NotFoundMessage />
          </main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
