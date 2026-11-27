'use client';

import { useTranslations } from 'next-intl';
import { useRef, type CSSProperties } from 'react';

import { LanguageSwitcher } from '@/components/language-switcher';

import { SITE_SECTIONS, type SiteSection } from './site-sections';
import { SiteThemeSwitch } from './site-theme-switch';

/**
 * The sections on a phone, where the bar has no room for them: a native modal
 * dialog - focus held inside, Escape closes, focus returns to the button -
 * with the sections in the display face, numbered as their chapters are, and
 * the CV when there is one, the language and the theme. Choosing a section
 * closes it; the page's own anchor handling takes the reader there.
 */
export function SiteMenu({
  name,
  sections,
  resume,
}: {
  name: string;
  sections: SiteSection[];
  resume?: { href: string };
}) {
  const t = useTranslations('home.nav');
  const contact = useTranslations('home.contact');
  const dialog = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => dialog.current?.showModal()}
        className="site-label link-line py-1.5 md:hidden"
      >
        {t('menu')}
      </button>

      <dialog
        ref={dialog}
        aria-label={t('menu')}
        onClick={(event) => {
          if ((event.target as Element).closest('a[href^="#"]'))
            dialog.current?.close();
        }}
        className="site-menu m-0 h-dvh max-h-none w-screen max-w-none bg-site-red p-0 text-site-on-red backdrop:bg-transparent open:flex open:flex-col"
      >
        <div className="flex h-14 shrink-0 items-center justify-between px-[var(--site-pad)]">
          <span className="site-display text-xl italic">{name}</span>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="site-label link-line py-1.5"
          >
            {t('close')}
          </button>
        </div>

        <nav
          aria-label={t('label')}
          className="min-h-0 flex-1 overflow-y-auto px-[var(--site-pad)] pt-6"
        >
          <ol>
            {sections.map((section, index) => (
              <li
                key={section}
                style={{ '--i': index } as CSSProperties}
                className="site-menu-item overflow-hidden"
              >
                <a
                  href={`#${section}`}
                  className="flex items-baseline gap-4 py-2 outline-none focus-visible:underline"
                >
                  <span className="site-label w-6 opacity-70">
                    {String(SITE_SECTIONS.indexOf(section) + 1).padStart(
                      2,
                      '0',
                    )}
                  </span>
                  <span className="site-display text-[clamp(3rem,15vw,6rem)]">
                    {t(section as 'work')}
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {resume ? (
          <a
            href={resume.href}
            target="_blank"
            rel="noopener noreferrer"
            className="mx-[var(--site-pad)] mt-4 inline-flex shrink-0 items-center justify-center gap-2.5 rounded-full border-[1.5px] border-current px-5 py-3 text-sm font-semibold outline-none focus-visible:bg-site-on-red focus-visible:text-site-red"
          >
            {contact('cv')}
            <span aria-hidden>↓</span>
          </a>
        ) : null}

        <div className="flex shrink-0 items-center justify-between gap-4 px-[var(--site-pad)] py-6">
          <LanguageSwitcher appearance="site" />
          <SiteThemeSwitch shortcut={false} />
        </div>
      </dialog>
    </>
  );
}
