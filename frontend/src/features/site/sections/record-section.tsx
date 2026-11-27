import type { Locale } from 'next-intl';
import { getTranslations } from 'next-intl/server';

import type { Credential } from '@/features/credential/credential-api';
import type { Language } from '@/features/language/language-api';
import type { Option } from '@/features/option/option-api';
import type { OptionText } from '@/features/option/option-text';
import { languageName } from '@/i18n/language-name';
import { localizedValue, type LocalizedValues } from '@/i18n/localized-value';
import { monthLabel } from '@/i18n/month';

import { SectionHead } from './chapter';

/**
 * Certifications and courses, each with what it carries, in readable type; the
 * languages, each placed on the language-level scale as the options list
 * orders it. Space, not rules, sets them apart.
 */
export async function RecordSection({
  credentials,
  languages,
  options,
  optionText,
  locale,
}: {
  credentials: Credential[];
  languages: Language[];
  options: Option[];
  optionText: OptionText;
  locale: Locale;
}) {
  const t = await getTranslations({ locale, namespace: 'home.record' });
  const scale = options
    .filter((option) => option.list === 'language-level')
    .sort((a, b) => a.order - b.order);
  const text = (value: LocalizedValues) => localizedValue(value, locale);

  return (
    <section
      id="record"
      aria-labelledby="record-title"
      className="relative z-10 bg-site-bg px-[var(--site-pad)] pt-[clamp(96px,16vh,180px)] pb-[clamp(96px,16vh,180px)]"
    >
      <SectionHead index={5} id="record-title" title={t('title')} />

      <div className="grid gap-x-[clamp(32px,6vw,120px)] gap-y-[clamp(64px,10vh,120px)] md:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
        {credentials.length ? (
          <ol className="grid content-start gap-[clamp(40px,7vh,72px)]">
            {credentials.map((row, index) => {
              const meta = [
                text(row.issuer),
                monthLabel(row.issuedAt, locale),
                row.expiresAt
                  ? `${t('expires')} ${monthLabel(row.expiresAt, locale)}`
                  : '',
                row.credentialId ? `${t('id')} ${row.credentialId}` : '',
              ].filter(Boolean);

              return (
                <li
                  key={row.id}
                  data-reveal
                  className="grid grid-cols-[auto_1fr] gap-x-[clamp(16px,2.4vw,36px)] gap-y-2"
                >
                  <span
                    aria-hidden
                    className="site-display row-span-5 text-[clamp(2rem,1.5rem+1.5vw,3.25rem)] leading-none text-site-red italic [font-feature-settings:'tnum']"
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <p className="site-label text-site-muted">
                    {row.kind === 'course' ? t('course') : t('certification')}
                  </p>
                  <h3 className="site-display text-[clamp(1.625rem,1.1rem+1.4vw,2.625rem)] leading-tight">
                    {text(row.name)}
                  </h3>
                  <p className="text-[15px] text-site-soft">
                    {meta.join(' · ')}
                  </p>
                  {text(row.description) ? (
                    <p className="max-w-[60ch] text-[15px] text-site-muted">
                      {text(row.description)}
                    </p>
                  ) : null}
                  {row.credentialUrl ? (
                    <a
                      href={row.credentialUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group link-line mt-1 justify-self-start pb-0.5 text-sm font-medium"
                    >
                      {t('view')}{' '}
                      <span
                        aria-hidden
                        className="arrow-pass [--ay:-1] rtl:-scale-x-100"
                      >
                        ↗
                      </span>
                    </a>
                  ) : null}
                </li>
              );
            })}
          </ol>
        ) : (
          <span />
        )}

        {languages.length ? (
          <div className="grid content-start gap-8">
            <h3 className="text-sm font-medium text-site-muted">
              {t('languages')}
            </h3>
            <ol className="grid gap-8">
              {[...languages]
                .sort((a, b) => a.order - b.order)
                .map((row) => {
                  const at = scale.findIndex((step) => step.code === row.level);

                  return (
                    <li key={row.id} data-reveal className="grid gap-3">
                      <p className="flex items-baseline justify-between gap-3">
                        <span
                          data-lines
                          className="site-display text-[clamp(1.875rem,1.2rem+2vw,3rem)] leading-[0.95]"
                        >
                          {languageName(row.code, locale)}
                        </span>
                        <span
                          lang={row.code}
                          className="text-lg text-site-muted"
                        >
                          {languageName(row.code, row.code)}
                        </span>
                      </p>
                      {scale.length ? (
                        <>
                          <div
                            role="img"
                            aria-label={optionText('language-level', row.level)}
                            data-steps
                            className="flex flex-wrap gap-1.5"
                          >
                            {scale.map((step, index) => (
                              <span
                                key={step.code}
                                data-step={index <= at ? 'on' : undefined}
                                className="relative size-3 rounded-full border-2 border-site-red"
                              >
                                {/* The fill, which the motion grows mark by mark; the ring stays. */}
                                {index <= at ? (
                                  <span className="absolute inset-0 rounded-full bg-site-red" />
                                ) : null}
                              </span>
                            ))}
                          </div>
                          <p className="text-sm font-medium text-site-fg">
                            {optionText('language-level', row.level)}
                          </p>
                        </>
                      ) : null}
                    </li>
                  );
                })}
            </ol>
          </div>
        ) : null}
      </div>
    </section>
  );
}
