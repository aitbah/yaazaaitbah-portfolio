import { getTranslations } from 'next-intl/server';

import { SiteCursor } from '@/features/site/site-cursor';
import { resolveLocale } from '@/i18n/locale-params';

/**
 * The public tree: a skip link, then the page in the site's own colours. Each
 * page brings its own header and its own `main` - the home page's header names
 * its sections, a project's leads back to the work. The locale layout above provides the document, the
 * translations, the direction, the theme and the notifications.
 */
export default async function PublicLayout({
  children,
  params,
}: LayoutProps<'/[locale]'>) {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: 'home' });

  return (
    <>
      <a
        href="#main"
        className="fixed start-[var(--site-pad)] top-2.5 z-[60] -translate-y-[160%] bg-site-fg px-3.5 py-2.5 text-sm text-site-bg transition-transform focus:translate-y-0"
      >
        {t('skip')}
      </a>
      {/* Each page puts its own header beside its `main`, so the header is the page's banner. */}
      <div
        data-site-root
        className="flex min-h-svh flex-col overflow-x-clip bg-site-bg text-site-fg"
      >
        {children}
      </div>
      <SiteCursor />
    </>
  );
}
