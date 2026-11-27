import type { Locale } from 'next-intl';
import { getTranslations } from 'next-intl/server';

import type { Option } from '@/features/option/option-api';
import { optionIndex, type OptionText } from '@/features/option/option-text';
import type { SocialLink } from '@/features/social-link/social-link-api';
import { monthLabel } from '@/i18n/month';

import { SpriteMark } from '../mark-sprite';
import type { SiteSection } from '../site-sections';

/** A link on red: ink, underlined on hover and focus. */
const LINK =
  'underline-offset-[5px] decoration-[1.5px] hover:underline focus-visible:underline focus-visible:outline-none';

/**
 * The page's foot, on red. First the invitation: a line to write, the email
 * and the CV. Then where to go - the sections, the profiles elsewhere - and
 * where the owner is and whether they are available. Then the legal line with
 * the last update and the way back up, and last the name, set as wide as the
 * page (fitted by the motion; a fluid size without it), its halves sliding
 * together as it arrives.
 */
export async function SiteFooter({
  locale,
  firstName,
  lastName,
  updatedAt,
  email,
  resume,
  location,
  availability,
  sections,
  socialLinks,
  options,
  optionText,
}: {
  locale: Locale;
  firstName: string;
  lastName: string;
  updatedAt?: string;
  email?: string;
  resume?: { href: string; language: string };
  location?: string;
  availability?: string;
  sections: SiteSection[];
  socialLinks: SocialLink[];
  options: Option[];
  optionText: OptionText;
}) {
  const t = await getTranslations({ locale, namespace: 'home' });
  const platform = optionIndex(options);
  const facts = [
    location ? { label: t('contact.basedIn'), value: location } : null,
    availability ? { label: t('contact.status'), value: availability } : null,
  ].filter((fact) => fact !== null);

  return (
    <footer
      data-red-zone
      className="overflow-clip bg-site-red px-[var(--site-pad)] pt-[clamp(72px,14vh,144px)] text-site-on-red"
    >
      <div className="grid grid-cols-2 gap-x-[clamp(24px,5vw,96px)] gap-y-12 md:grid-cols-12">
        <div className="col-span-2 grid content-start gap-6 md:col-span-6">
          <p className="site-label">{t('footer.cta')}</p>
          {email ? (
            <a
              href={`mailto:${email}`}
              className="site-display group w-max max-w-full text-[clamp(2.5rem,1.5rem+3.8vw,5.75rem)] leading-[0.95] italic outline-none focus-visible:underline"
            >
              {t('footer.write')}{' '}
              <span aria-hidden className="arrow-pass rtl:-scale-x-100">
                →
              </span>
            </a>
          ) : (
            <p className="site-display text-[clamp(2.5rem,1.5rem+3.8vw,5.75rem)] leading-[0.95] italic">
              {t('footer.write')}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
            {email ? (
              <a href={`mailto:${email}`} className={`text-lg ${LINK}`}>
                {email}
              </a>
            ) : null}
            {resume ? (
              <a
                href={resume.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2.5 rounded-full border-[1.5px] border-current px-5 py-2.5 text-sm font-semibold transition-colors duration-300 hover:bg-site-on-red hover:text-site-red focus-visible:bg-site-on-red focus-visible:text-site-red focus-visible:outline-none"
              >
                {t('contact.cv')}
                <span aria-hidden className="arrow-pass [--ax:0] [--ay:1]">
                  ↓
                </span>
              </a>
            ) : null}
          </div>
        </div>

        {sections.length ? (
          <nav
            aria-labelledby="footer-sections"
            className="grid content-start gap-4 md:col-span-2"
          >
            <h2 id="footer-sections" className="site-label opacity-70">
              {t('footer.sections')}
            </h2>
            <ul className="grid gap-2.5">
              {sections.map((section) => (
                <li key={section}>
                  <a href={`#${section}`} className={LINK}>
                    {t(`nav.${section as 'work'}`)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}

        {socialLinks.length ? (
          <div className="grid content-start gap-4 md:col-span-2">
            <h2 className="site-label opacity-70">{t('contact.elsewhere')}</h2>
            <ul className="grid gap-2.5">
              {[...socialLinks]
                .sort((a, b) => a.order - b.order)
                .map((link) => {
                  const slug = platform('social-platform', link.platform)?.icon;

                  return (
                    <li key={link.id}>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer me"
                        className={`inline-flex items-center gap-2 ${LINK}`}
                      >
                        {slug ? (
                          <SpriteMark slug={slug} className="size-4" />
                        ) : null}
                        {optionText('social-platform', link.platform)}
                        <span aria-hidden className="text-xs rtl:-scale-x-100">
                          ↗
                        </span>
                      </a>
                    </li>
                  );
                })}
            </ul>
          </div>
        ) : null}

        {facts.length ? (
          <dl className="grid content-start gap-5 md:col-span-2">
            {facts.map((fact) => (
              <div key={fact.label} className="grid gap-1">
                <dt className="site-label opacity-70">{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>

      <div className="mt-[clamp(64px,12vh,128px)] flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-t border-current/25 pt-6 text-sm">
        <span>
          © {new Date().getFullYear()} {firstName} {lastName}
        </span>
        {updatedAt ? (
          <span className="opacity-80">
            {t('contact.updated', {
              date: monthLabel(updatedAt.slice(0, 7), locale),
            })}
          </span>
        ) : null}
        <a href="#top" className={`group font-semibold ${LINK}`}>
          {t('nav.top')}{' '}
          <span aria-hidden className="arrow-pass [--ax:0] [--ay:-1]">
            ↑
          </span>
        </a>
      </div>
      <p
        data-signature
        aria-hidden
        className="site-display mt-[clamp(16px,4vh,48px)] flex justify-center gap-[0.22em] text-[clamp(3.5rem,15vw,15rem)] leading-[0.95] whitespace-nowrap"
      >
        <span data-sign-first className="inline-block shrink-0">
          {firstName}
        </span>
        <span data-sign-last className="inline-block shrink-0 italic">
          {lastName}
        </span>
      </p>
    </footer>
  );
}
