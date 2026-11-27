import type { Locale } from 'next-intl';
import { getTranslations } from 'next-intl/server';

import type { Option } from '@/features/option/option-api';
import { optionIndex, type OptionText } from '@/features/option/option-text';
import type { SocialLink } from '@/features/social-link/social-link-api';
import { languageName } from '@/i18n/language-name';

import { SpriteMark } from '../mark-sprite';
import { SectionHead } from './chapter';
import { ContactForm } from './contact-form';

/**
 * The way to write: the public email set large as the section's headline, the
 * CV beside it as the section's one button when its file exists, the facts the
 * owner published, the profiles elsewhere, and the message form - grouped by
 * space, without rules or boxes.
 */
export async function ContactSection({
  locale,
  email,
  location,
  availability,
  resume,
  socialLinks,
  options,
  optionText,
}: {
  locale: Locale;
  email?: string;
  location?: string;
  availability?: string;
  resume?: { href: string; language: string };
  socialLinks: SocialLink[];
  options: Option[];
  optionText: OptionText;
}) {
  const t = await getTranslations({ locale, namespace: 'home' });
  const platform = optionIndex(options);
  // The email is the section's headline; the facts are what it does not say.
  const facts = [
    location ? { label: t('contact.basedIn'), value: <>{location}</> } : null,
    availability
      ? { label: t('contact.status'), value: <>{availability}</> }
      : null,
  ].filter((fact) => fact !== null);

  return (
    <section
      id="contact"
      aria-labelledby="contact-title"
      className="relative z-10 bg-site-bg px-[var(--site-pad)] pt-[clamp(96px,16vh,180px)]"
    >
      <SectionHead index={6} id="contact-title" title={t('contact.title')} />

      {email ? (
        <a
          href={`mailto:${email}`}
          data-mail
          className="site-display group -mt-[clamp(16px,4vh,48px)] block w-max max-w-full text-[clamp(2.25rem,8vw,13rem)] leading-[1] italic outline-none"
        >
          {email}
          <span
            aria-hidden
            className="mt-[0.06em] block h-[0.05em] min-h-[3px] origin-left scale-x-[0.12] rounded-full bg-site-red transition-transform duration-700 ease-[cubic-bezier(0.65,0,0.35,1)] group-hover:scale-x-100 group-focus-visible:scale-x-100 rtl:origin-right"
          />
        </a>
      ) : null}

      {resume ? (
        <a
          href={resume.href}
          target="_blank"
          rel="noopener noreferrer"
          data-magnetic
          className="group mt-[clamp(28px,5vh,48px)] inline-flex items-center gap-4 rounded-full bg-site-red py-3.5 ps-6 pe-5 text-site-on-red transition-[gap] duration-500 hover:gap-5 focus-visible:ring-2 focus-visible:ring-site-red focus-visible:ring-offset-4 focus-visible:ring-offset-site-bg focus-visible:outline-none"
        >
          <span className="grid leading-tight">
            <span className="text-[15px] font-semibold">{t('contact.cv')}</span>
            <span className="text-xs opacity-75">
              PDF · {languageName(resume.language, locale)}
            </span>
          </span>
          <span aria-hidden className="arrow-pass text-lg [--ax:0] [--ay:1]">
            ↓
          </span>
        </a>
      ) : null}

      <div className="mt-[clamp(64px,12vh,136px)] grid gap-x-[clamp(32px,6vw,120px)] gap-y-16 pb-[clamp(96px,16vh,180px)] md:grid-cols-[minmax(0,4fr)_minmax(0,7fr)]">
        <div className="grid content-start gap-10">
          {facts.length ? (
            <dl className="grid gap-6">
              {facts.map((fact) => (
                <div key={fact.label} data-reveal className="grid gap-1">
                  <dt className="site-label text-site-muted">{fact.label}</dt>
                  <dd className="text-lg break-words text-site-fg">
                    {fact.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
          {socialLinks.length ? (
            <div className="grid gap-3">
              <h3 className="site-label text-site-muted">
                {t('contact.elsewhere')}
              </h3>
              <ul className="flex flex-wrap gap-x-6 gap-y-3">
                {[...socialLinks]
                  .sort((a, b) => a.order - b.order)
                  .map((link) => {
                    const slug = platform(
                      'social-platform',
                      link.platform,
                    )?.icon;

                    return (
                      <li key={link.id} data-reveal>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer me"
                          className="group link-line inline-flex items-center gap-2 pb-0.5 text-lg text-site-fg"
                        >
                          {slug ? (
                            <SpriteMark slug={slug} className="size-4" />
                          ) : null}
                          {optionText('social-platform', link.platform)}
                          <span
                            aria-hidden
                            className="arrow-pass text-sm [--ay:-1] rtl:-scale-x-100"
                          >
                            ↗
                          </span>
                        </a>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ) : null}
        </div>
        <ContactForm />
      </div>
    </section>
  );
}
