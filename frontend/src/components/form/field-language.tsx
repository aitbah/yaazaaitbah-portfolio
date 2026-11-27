'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import {
  SegmentedControl,
  SegmentedControlItem,
} from '@/components/ui/segmented-control';
import { languageName } from '@/i18n/language-name';
import { routing } from '@/i18n/routing';

/**
 * How a localized control is named: the tabs already show the language, so it
 * is read out, not printed - "Bio (English)" for a screen reader, "Bio" on
 * screen. A hook, since the language's name is translated.
 */
export function useLocalizedLabel(): (
  label: string,
  locale: string,
) => ReactNode {
  const t = useTranslations('admin');
  const reader = useLocale();

  return (label, locale) =>
    routing.locales.length > 1
      ? t.rich('localizedFieldLabel', {
          label,
          locale: languageName(locale, reader),
          language: (chunks) => <span className="sr-only">{chunks}</span>,
        })
      : label;
}

type LanguageTabsProps = {
  value: string;
  onValueChange: (locale: string) => void;
  /** The languages this field is invalid in, marked so they can be found. */
  invalid: ReadonlySet<string>;
};

/**
 * Which translation of a field is on screen. A language whose value is invalid
 * is marked by shape and by word, so a save refused elsewhere can be fixed.
 */
export function LanguageTabs({
  value,
  onValueChange,
  invalid,
}: LanguageTabsProps) {
  const t = useTranslations('admin.contentLanguage');
  const reader = useLocale();

  return (
    <SegmentedControl
      value={value}
      onValueChange={onValueChange}
      label={t('label')}
    >
      {routing.locales.map((locale) => {
        const isInvalid = invalid.has(locale);
        const language = languageName(locale, reader);

        return (
          <SegmentedControlItem
            key={locale}
            value={locale}
            className={isInvalid ? 'text-destructive' : undefined}
          >
            {/* The subtag is what fits in a control beside a label; the name is
                what a screen reader should hear, because "FR" is not a word.
                One string rather than a name and a marker side by side: an
                accessible name assembled from several nodes is assembled
                differently by every implementation that reads it. */}
            <span aria-hidden>{locale.toUpperCase()}</span>
            <span className="sr-only">
              {isInvalid ? t('invalid', { language }) : language}
            </span>
            {isInvalid ? (
              <span
                aria-hidden
                className="size-1.5 shrink-0 rounded-full bg-destructive"
              />
            ) : null}
          </SegmentedControlItem>
        );
      })}
    </SegmentedControl>
  );
}
