import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';

import { DirectionProvider } from '@/components/providers/direction-provider';
import { ThemeScript } from '@/components/theme/theme-script';
import { ToastViewport } from '@/components/ui/toast';
import { fontVariables } from '@/app/fonts';
import { pickPublicMessages } from '@/i18n/message-scopes';
import { resolveLocale } from '@/i18n/locale-params';
import { localeDirection, routing } from '@/i18n/routing';
import {
  localeAlternates,
  openGraphAlternateLocales,
  openGraphLocale,
  siteUrl,
} from '@/lib/site';

import '../globals.css';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<'/[locale]'>) {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: 'metadata' });

  const title = t('title');
  const description = t('description');

  return {
    // Absolute URLs are required in metadata; this is where they come from.
    metadataBase: new URL(siteUrl()),
    title,
    description,
    alternates: {
      canonical: `/${locale}`,
      // Grows on its own when a locale is added to routing.
      languages: localeAlternates(),
    },
    openGraph: {
      type: 'website',
      siteName: title,
      title,
      description,
      url: `/${locale}`,
      locale: openGraphLocale(locale),
      alternateLocale: openGraphAlternateLocales(locale),
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}

/**
 * Shared infrastructure only - translations, direction and notifications, used
 * by the public and admin trees alike. Page chrome belongs to each tree's own
 * layout, so the admin area never inherits the public header/footer.
 */
export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<'/[locale]'>) {
  const locale = await resolveLocale(params);

  const publicMessages = pickPublicMessages(await getMessages());
  const direction = localeDirection(locale);

  return (
    /*
      The theme script writes the class to this element before React hydrates,
      so React is told not to report the difference it will find. The class
      goes on `<html>` because that is what the `dark` variant and the token
      block in `globals.css` both resolve against.
    */
    <html
      lang={locale}
      dir={direction}
      // The font variables belong here rather than on a wrapper: `globals.css`
      // picks a pair from the document's own `lang`, and both have to be
      // readable from the same element for that to work.
      className={fontVariables}
      suppressHydrationWarning
    >
      <body>
        {/* Here, above every page, rather than in the public and admin layouts
            that used to carry it: a not-found or error page renders under this
            layout alone, and was painted light for a reader who chose dark.
            The admin's CSP admits it by its hash, so nothing here reads a
            header and no page has to render per request for it. */}
        <ThemeScript />

        {/* The same direction twice, for the two halves that cannot see each
            other: the attribute above is what CSS resolves `ps-`/`border-s`
            against, and this is what Radix's own keyboard and placement logic
            reads. Derived from one value so they cannot drift apart. */}
        <DirectionProvider direction={direction}>
          <NextIntlClientProvider messages={publicMessages}>
            {/* Here rather than per tree: the public form and every admin
                mutation raise the same notification, and a viewport per
                layout would stack two of them on the admin. */}
            <ToastViewport>{children}</ToastViewport>
          </NextIntlClientProvider>
        </DirectionProvider>
      </body>
    </html>
  );
}
