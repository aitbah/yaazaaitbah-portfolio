import type { Locale } from 'next-intl';
import { getTranslations } from 'next-intl/server';

import type { Education } from '@/features/education/education-api';
import type { Experience } from '@/features/experience/experience-api';
import type { OptionText } from '@/features/option/option-text';
import { localizedValue, type LocalizedValues } from '@/i18n/localized-value';
import { monthRange } from '@/i18n/month';

import { byRecent, spanLabel } from '../path-timeline';
import { SectionHead } from './chapter';

type Row = {
  id: string;
  startDate: string;
  endDate?: string;
  current: boolean;
  title: string;
  org: string;
  tags: string[];
  description: string;
};

/**
 * Experience, then education, each most recent first - what the owner does now
 * leads - on one timeline whose red line the motion draws as it is read, each
 * stop filling as the line reaches it. When and for how long on one side;
 * what, where and what it involved on the other.
 */
export async function PathSection({
  experience,
  education,
  optionText,
  locale,
  today,
}: {
  experience: Experience[];
  education: Education[];
  optionText: OptionText;
  locale: Locale;
  today: Date;
}) {
  const t = await getTranslations({ locale, namespace: 'home.path' });
  const text = (value: LocalizedValues) => localizedValue(value, locale);
  const groups = [
    {
      kind: 'experience' as const,
      rows: byRecent(
        experience.map((row): Row => ({
          id: row.id,
          startDate: row.startDate,
          endDate: row.endDate,
          current: row.current,
          title: text(row.role),
          org: text(row.organisation),
          tags: [
            optionText('employment-type', row.employmentType),
            text(row.location),
          ].filter(Boolean),
          description: text(row.description),
        })),
        today,
      ),
    },
    {
      kind: 'education' as const,
      rows: byRecent(
        education.map((row): Row => ({
          id: row.id,
          startDate: row.startDate,
          endDate: row.endDate,
          current: row.current,
          title: text(row.qualification),
          org: text(row.institution),
          tags: [
            optionText('education-level', row.level),
            text(row.fieldOfStudy),
            text(row.location),
          ].filter(Boolean),
          description: text(row.description),
        })),
        today,
      ),
    },
  ].filter((group) => group.rows.length);

  if (!groups.length) {
    return null;
  }

  return (
    <section
      id="path"
      aria-labelledby="path-title"
      className="relative z-10 bg-site-bg px-[var(--site-pad)] pt-[clamp(96px,16vh,180px)] pb-[clamp(96px,16vh,180px)]"
    >
      <SectionHead index={4} id="path-title" title={t('title')} />

      {/* The track runs down the reading start; the motion draws the red over it as it is read. */}
      <div
        data-timeline
        className="relative grid gap-[clamp(64px,11vh,128px)] ps-[clamp(28px,4vw,72px)] md:ms-[16.66%]"
      >
        <span
          aria-hidden
          className="absolute inset-y-0 start-0 w-0.5 rounded-full bg-site-line"
        />
        <span
          aria-hidden
          data-timeline-line
          className="absolute inset-y-0 start-0 w-0.5 origin-top rounded-full bg-site-red"
        />
        {groups.map((group) => (
          <div key={group.kind} className="grid gap-[clamp(40px,7vh,80px)]">
            <h3 className="site-label text-site-red">{t(group.kind)}</h3>
            <ol className="grid gap-[clamp(48px,8vh,96px)]">
              {group.rows.map((row) => (
                <li
                  key={row.id}
                  data-reveal
                  data-stop
                  className="relative grid gap-x-10 gap-y-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2.4fr)]"
                >
                  <span
                    aria-hidden
                    data-stop-mark
                    className="absolute top-2 -start-[calc(clamp(28px,4vw,72px)+7px)] size-4 rounded-full border-2 border-site-red bg-site-bg transition-colors duration-500 data-[reached]:bg-site-red"
                  />
                  <p className="grid content-start gap-1 text-sm text-site-muted [font-feature-settings:'tnum']">
                    <span className="inline-flex items-center gap-2 font-semibold text-site-fg">
                      {monthRange(
                        row.startDate,
                        row.endDate,
                        row.current,
                        locale,
                        t('present'),
                      )}
                    </span>
                    <span>{spanLabel(row.months, locale)}</span>
                  </p>
                  <div className="grid content-start gap-2">
                    <h4 className="site-display text-site-heading">
                      {row.title}
                    </h4>
                    <p className="text-[17px] text-site-fg">{row.org}</p>
                    {row.tags.length ? (
                      <p className="text-sm text-site-muted">
                        {row.tags.join(' · ')}
                      </p>
                    ) : null}
                    {row.description ? (
                      <p className="mt-3 max-w-[62ch] text-site-body text-site-soft">
                        {row.description}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}
