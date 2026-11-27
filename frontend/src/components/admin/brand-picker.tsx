'use client';

import { useTranslations } from 'next-intl';
import { useDeferredValue, useMemo, useState } from 'react';
import { SKILL_ICONS } from '@portfolio/shared/skill-icons';

import { BrandMark } from '@/components/brand-mark';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * How many logos to draw before the search has narrowed things down.
 *
 * All 236 at once is 236 SVG paths on every keystroke, which is slow enough to
 * feel like the input is lagging. A first page is enough to browse, and typing
 * two letters reaches anything.
 */
const INITIAL_LIMIT = 60;

type BrandPickerProps = {
  /** The chosen slug, or `null` for nothing chosen. */
  value: string | null;
  onChange: (slug: string) => void;
};

/**
 * Search the vendored logo set and pick one by slug - so no user SVG is ever
 * uploaded. Shared by expertise logos and option marks.
 */
export function BrandPicker({ value, onChange }: BrandPickerProps) {
  const t = useTranslations('admin.brandPicker');

  const [query, setQuery] = useState('');
  // The list redraws on every keystroke; deferring keeps typing responsive and
  // lets the previous result stay on screen while the next one is built.
  const search = useDeferredValue(query).trim().toLowerCase();

  const matches = useMemo(() => {
    if (search.length === 0) {
      return SKILL_ICONS.slice(0, INITIAL_LIMIT);
    }

    return SKILL_ICONS.filter(
      (icon) =>
        icon.title.toLowerCase().includes(search) || icon.slug.includes(search),
    ).slice(0, INITIAL_LIMIT);
  }, [search]);

  return (
    <div className="flex flex-col gap-2">
      <Input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t('searchPlaceholder')}
        aria-label={t('search')}
      />

      {matches.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          {t('noMatches', { query: query.trim() })}
        </p>
      ) : (
        /* A grid rather than a dropdown: choosing a logo is a visual task, and
           a list of names would make you read what you came to look at. */
        <ul className="grid max-h-56 grid-cols-[repeat(auto-fill,minmax(4rem,1fr))] gap-1 overflow-y-auto rounded-md border p-2">
          {matches.map((icon) => {
            const isChosen = value === icon.slug;

            return (
              <li key={icon.slug}>
                <button
                  type="button"
                  // The accessible name is the brand, not "button": the grid is
                  // unusable by keyboard or screen reader otherwise.
                  aria-label={icon.title}
                  aria-pressed={isChosen}
                  title={icon.title}
                  onClick={() => onChange(icon.slug)}
                  className={cn(
                    'flex aspect-square w-full items-center justify-center rounded-md border border-transparent p-2 transition-colors',
                    'hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                    isChosen && 'border-ring bg-accent',
                  )}
                >
                  <BrandMark
                    slug={icon.slug}
                    title={icon.title}
                    className="size-6"
                    brandColor
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** The brand's own name for a slug, for saying which one is chosen. */
export function brandTitle(slug: string): string | undefined {
  return SKILL_ICONS.find((icon) => icon.slug === slug)?.title;
}
