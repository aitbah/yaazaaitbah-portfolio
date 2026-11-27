import type { Locale } from 'next-intl';
import { getTranslations } from 'next-intl/server';

import { LanguageSwitcher } from '@/components/language-switcher';

import { SiteMenu } from './site-menu';
import type { SiteSection } from './site-sections';
import { SiteThemeSwitch } from './site-theme-switch';

/**
 * The bar: the name home, the sections that have content, the language, the
 * theme, and the way to write as its one action (*Let's talk*, which is also
 * how the bar names Contact); on a phone, the sections, the language and the
 * action are in the menu. Fixed
 * and transparent; once the page has moved, a scrim of the page's own colour,
 * solid behind the bar's own items, keeps it legible over whatever passes
 * under it - red over the red chapter. The motion moves it away while reading
 * down.
 */
export async function SiteHeader({
  name,
  sections,
  locale,
  resume,
}: {
  name: string;
  sections: SiteSection[];
  locale: Locale;
  /** The CV, offered in the phone's menu. */
  resume?: { href: string };
}) {
  const t = await getTranslations({ locale, namespace: 'home' });

  return (
    <header
      data-site-bar
      className="group/bar pointer-events-none fixed inset-x-0 top-0 z-50 grid h-14 grid-cols-[1fr_auto] items-center gap-4 px-[var(--site-pad)] text-sm font-medium text-site-fg before:absolute before:inset-x-0 before:-bottom-8 before:top-0 before:-z-10 before:bg-gradient-to-b before:from-site-bg before:from-55% before:via-site-bg/80 before:via-75% before:to-transparent before:opacity-0 before:transition-opacity before:duration-500 data-[scrolled]:before:opacity-100 data-[on-red]:text-site-on-red data-[on-red]:before:from-site-red data-[on-red]:before:via-site-red/80 md:h-16 md:grid-cols-[1fr_auto_1fr]"
    >
      <a
        href="#top"
        className="site-display link-line pointer-events-auto justify-self-start pb-0.5 text-[1.25rem] italic"
      >
        {name}
      </a>
      <nav
        aria-label={t('nav.label')}
        className="pointer-events-auto hidden gap-[clamp(14px,2.2vw,34px)] md:flex"
      >
        {sections
          .filter((section) => section !== 'contact')
          .map((section) => (
            <a
              key={section}
              href={`#${section}`}
              data-nav={section}
              className="relative inline-flex items-center gap-2 opacity-70 transition-opacity before:size-1.5 before:scale-0 before:rounded-full before:bg-site-red before:transition-transform before:duration-500 after:absolute after:inset-x-0 after:-bottom-1.5 after:h-[1.5px] after:origin-right after:scale-x-0 after:bg-site-red after:transition-transform after:duration-500 hover:opacity-100 hover:after:origin-left hover:after:scale-x-100 aria-[current=true]:opacity-100 aria-[current=true]:before:scale-100 rtl:after:origin-left rtl:hover:after:origin-right group-data-[on-red]/bar:before:bg-current group-data-[on-red]/bar:after:bg-current"
            >
              {t(`nav.${section as 'work'}`)}
            </a>
          ))}
      </nav>
      <div className="pointer-events-auto flex items-center justify-self-end gap-5">
        {/* On a phone the language moves into the menu, where there is room. */}
        <div className="max-md:hidden">
          <LanguageSwitcher appearance="site" />
        </div>
        <SiteThemeSwitch />
        <a
          href="#contact"
          data-nav="contact"
          data-magnetic
          className="group inline-flex items-center gap-2 rounded-full bg-site-red px-4 py-2 text-site-on-red transition-colors duration-300 group-data-[on-red]/bar:bg-site-on-red group-data-[on-red]/bar:text-site-red focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-2 focus-visible:ring-offset-transparent focus-visible:outline-none max-md:hidden"
        >
          {t('nav.talk')}
          <span aria-hidden className="arrow-pass rtl:-scale-x-100">
            →
          </span>
        </a>
        <SiteMenu name={name} sections={sections} resume={resume} />
      </div>
    </header>
  );
}
