import type { CSSProperties } from 'react';
import type { Locale } from 'next-intl';
import { getTranslations } from 'next-intl/server';

import type { Expertise } from '@/features/expertise/expertise-api';
import type { OptionText } from '@/features/option/option-text';
import { localizedValue } from '@/i18n/localized-value';

import { groupByCategory } from '../expertise-groups';
import { SectionHead } from './chapter';
import { ExpertiseMark } from './expertise-mark';

const KINDS = ['skills', 'technologies', 'tools'] as const;
const LISTS = {
  skills: 'skill-category',
  technologies: 'technology-category',
  tools: 'tool-category',
} as const;

/**
 * Skills, technologies and tools. First as kinetic lines - one per kind, the
 * names in the serif, driven sideways by the scroll, decoration only - then as
 * the reading itself: a grid of tiles under each kind, related ones together
 * (by category, in the admin's order). A technology or a tool is its logo in a
 * red ring that fills to its level out of 100; a skill, which has no logo,
 * is a wider tile with its level in the ring and its name beside it. The
 * motion turns the tiles in and fills the rings as the grid comes up; the
 * level is said in words for assistive technology, with its category.
 */
export async function ExpertiseSection({
  rows,
  optionText,
  locale,
}: {
  rows: Record<(typeof KINDS)[number], Expertise[]>;
  optionText: OptionText;
  locale: Locale;
}) {
  const t = await getTranslations({ locale, namespace: 'home.expertise' });
  const kinds = KINDS.filter((kind) => rows[kind].length);

  return (
    <section
      id="expertise"
      aria-labelledby="expertise-title"
      className="relative z-10 overflow-x-clip bg-site-bg pt-[clamp(96px,16vh,180px)] pb-[clamp(96px,16vh,180px)]"
    >
      <div className="px-[var(--site-pad)]">
        <SectionHead index={3} id="expertise-title" title={t('title')} />
      </div>

      <div
        aria-hidden
        data-marquees
        className="grid gap-[clamp(4px,1vh,12px)] py-[clamp(8px,2vh,24px)]"
      >
        {kinds.map((kind, index) => {
          const names = rows[kind].map((row) =>
            localizedValue(row.name, locale),
          );

          return (
            <div
              key={kind}
              data-marquee={index % 2 ? -1 : 1}
              className={`site-display flex w-max gap-[0.4em] text-[clamp(3rem,1.6rem+5vw,7.5rem)] leading-[1.05] whitespace-nowrap ${index % 2 ? 'italic text-site-muted' : 'text-site-fg'}`}
            >
              {[0, 1].map((copy) => (
                <span key={copy} className="flex shrink-0 gap-[0.4em]">
                  {names.map((name, i) => (
                    <span
                      key={`${copy}-${i}`}
                      className="flex items-center gap-[0.4em]"
                    >
                      {name}
                      <i className="size-[0.16em] shrink-0 rounded-full bg-site-red" />
                    </span>
                  ))}
                </span>
              ))}
            </div>
          );
        })}
      </div>

      <div className="mt-[clamp(56px,10vh,112px)] grid gap-[clamp(48px,8vh,88px)] px-[var(--site-pad)]">
        {kinds.map((kind) => {
          const tiles = groupByCategory(rows[kind]).flatMap((group) =>
            group.rows.map((row) => ({
              row,
              category: optionText(LISTS[kind], group.category),
            })),
          );
          const wide = kind === 'skills';

          return (
            <section
              key={kind}
              aria-labelledby={`expertise-${kind}`}
              className="grid gap-5"
            >
              <h3
                id={`expertise-${kind}`}
                className="flex items-baseline gap-3"
              >
                <span className="site-display text-[clamp(1.75rem,1.3rem+1.6vw,3rem)]">
                  {t(kind)}
                </span>
                <span className="site-label text-site-red [font-feature-settings:'tnum']">
                  {String(tiles.length).padStart(2, '0')}
                </span>
              </h3>
              <ul
                data-tiles
                className="grid grid-cols-[repeat(auto-fill,minmax(70px,1fr))] gap-2 sm:grid-cols-[repeat(auto-fill,minmax(112px,1fr))] sm:gap-2.5"
              >
                {tiles.map(({ row, category }) => {
                  const name = localizedValue(row.name, locale);

                  return (
                    <li
                      key={row.id}
                      data-tile
                      title={`${name} — ${row.level}`}
                      style={{ '--level': row.level } as CSSProperties}
                      className={`group/tile relative rounded-2xl bg-site-raise transition-[translate,background-color] duration-300 hover:-translate-y-1 ${
                        wide
                          ? 'col-span-2 flex items-center gap-2.5 p-2.5 sm:gap-4 sm:p-4'
                          : 'grid content-center justify-items-center gap-1.5 px-1.5 py-3 text-center sm:aspect-square sm:gap-2.5 sm:p-2'
                      }`}
                    >
                      <span
                        className={`relative grid shrink-0 place-items-center ${wide ? 'size-10 sm:size-14' : 'size-10 sm:size-14 lg:size-16'}`}
                      >
                        <svg
                          aria-hidden
                          viewBox="0 0 40 40"
                          className="absolute inset-0 size-full -rotate-90 rtl:-scale-y-100"
                        >
                          <circle
                            cx="20"
                            cy="20"
                            r="18"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            className="text-site-line"
                          />
                          <circle
                            cx="20"
                            cy="20"
                            r="18"
                            pathLength={100}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.25"
                            strokeLinecap="round"
                            className="text-site-red [stroke-dasharray:100] [stroke-dashoffset:calc((100-var(--level)*var(--fill,1))*1px)]"
                          />
                        </svg>
                        {wide ? (
                          <span
                            aria-hidden
                            className="site-display text-base [font-feature-settings:'tnum'] sm:text-xl"
                          >
                            {row.level}
                          </span>
                        ) : (
                          <ExpertiseMark
                            icon={row.icon}
                            className="size-5 text-site-fg transition-colors duration-300 group-hover/tile:text-site-red sm:size-6 lg:size-7"
                          />
                        )}
                      </span>
                      <span
                        className={`font-medium text-site-fg ${wide ? 'min-w-0 text-xs leading-snug hyphens-auto [overflow-wrap:anywhere] sm:text-[15px]' : 'line-clamp-2 max-w-full text-[10.5px] leading-tight hyphens-auto [overflow-wrap:anywhere] sm:text-xs'}`}
                      >
                        {name}
                      </span>
                      <span className="sr-only">
                        {t('level', { category, level: row.level })}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </section>
  );
}
