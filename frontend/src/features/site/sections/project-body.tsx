import type { Locale } from 'next-intl';
import { getTranslations } from 'next-intl/server';

import type { Expertise } from '@/features/expertise/expertise-api';
import type { Project } from '@/features/project/project-api';
import { localizedValue, type LocalizedValues } from '@/i18n/localized-value';

import { ExpertiseMark } from './expertise-mark';

/** The project's stack, as the rows its ids name, in the stack's own order. */
export function stackOf(project: Project, expertise: Expertise[]): Expertise[] {
  const byId = new Map(expertise.map((row) => [row.id, row]));

  return project.stack
    .map((id) => byId.get(id))
    .filter((row): row is Expertise => Boolean(row));
}

/** The links a project has: its site, its source - words with an arrow, not boxes. */
export async function ProjectLinks({
  project,
  locale,
}: {
  project: Project;
  locale: Locale;
}) {
  const t = await getTranslations({ locale, namespace: 'home.work' });
  const links = [
    project.liveUrl ? { href: project.liveUrl, label: t('live') } : null,
    project.repoUrl ? { href: project.repoUrl, label: t('source') } : null,
  ].filter((link) => link !== null);

  return links.length ? (
    <div className="flex flex-wrap gap-x-6 gap-y-2">
      {links.map((link) => (
        <a
          key={link.href}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="group link-line inline-flex items-center gap-2 pb-0.5 text-sm font-medium whitespace-nowrap text-site-fg"
        >
          {link.label}
          <span aria-hidden className="arrow-pass [--ay:-1] rtl:-scale-x-100">
            ↗
          </span>
        </a>
      ))}
    </div>
  ) : null;
}

/**
 * Everything a project says about itself beside its images: the description,
 * the role, the problem, the approach, the outcome and the stack. Empty fields
 * are left out rather than labelled empty; space, not rules, sets them apart.
 */
export async function ProjectBody({
  project,
  expertise,
  locale,
}: {
  project: Project;
  expertise: Expertise[];
  locale: Locale;
}) {
  const t = await getTranslations({ locale, namespace: 'home.work' });
  const text = (value: LocalizedValues) => localizedValue(value, locale);
  const facets = (
    [
      ['role', text(project.role)],
      ['problem', text(project.problem)],
      ['approach', text(project.approach)],
      ['outcome', text(project.outcome)],
    ] as const
  ).filter(([, value]) => value);
  const stack = stackOf(project, expertise);

  return (
    <div className="grid content-start gap-[clamp(28px,5vh,48px)]">
      <p
        data-reveal
        className="site-display text-[clamp(1.5rem,1.1rem+1.2vw,2.25rem)] leading-tight text-site-fg"
      >
        {text(project.description)}
      </p>
      {facets.map(([key, value]) => (
        <section key={key} data-reveal className="grid gap-2">
          <h4 className="site-label text-site-red">{t(key)}</h4>
          <p
            className={
              key === 'role'
                ? 'text-[clamp(1.0625rem,0.95rem+0.4vw,1.25rem)] leading-snug text-site-fg'
                : 'text-site-body text-site-soft'
            }
          >
            {value}
          </p>
        </section>
      ))}
      {stack.length ? (
        <section data-reveal className="grid gap-3">
          <h4 className="site-label text-site-red">{t('stack')}</h4>
          <ul className="flex flex-wrap gap-1.5">
            {stack.map((row) => (
              <li
                key={row.id}
                className="inline-flex items-center gap-2 rounded-full bg-site-raise py-1.5 ps-2.5 pe-3 text-[0.8125rem] leading-none text-site-soft"
              >
                <ExpertiseMark icon={row.icon} />
                {localizedValue(row.name, locale)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
