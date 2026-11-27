'use client';

import { useLocale, useTranslations } from 'next-intl';

import { useUnsavedChanges } from '@/components/unsaved-changes';
import {
  SegmentedControl,
  SegmentedControlItem,
} from '@/components/ui/segmented-control';
import { languageName } from '@/i18n/language-name';
import { usePathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { cn } from '@/lib/utils';

/** Arabic is marked in its own script: "AR" is not how an Arabic reader looks for it. */
const SHORT: Record<string, string> = { ar: 'ع' };

/**
 * `control` is the admin's segmented control; `site` sets the same control in
 * the public site's type - labels in the colour of wherever it sits, the
 * current one underlined - without changing what it does.
 */
const APPEARANCE = {
  control: { root: undefined, item: undefined },
  site: {
    root: 'gap-3.5 rounded-none border-0 p-0',
    item: cn(
      'site-label relative h-auto min-w-0 rounded-none bg-transparent px-0 py-1.5 text-current opacity-55',
      'hover:bg-transparent hover:text-current hover:opacity-100 data-[state=on]:bg-transparent data-[state=on]:text-current data-[state=on]:opacity-100',
      'focus-visible:opacity-100 focus-visible:ring-0 focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-current focus-visible:outline-solid',
      'after:absolute after:inset-x-0 after:bottom-0.5 after:h-[1.5px] after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-500 hover:after:scale-x-100 focus-visible:after:scale-x-100 data-[state=on]:after:scale-x-100 rtl:after:origin-right',
    ),
  },
} as const;

/**
 * Which language the site is read in; one control shared by the admin header
 * and the public navbar. It carries a globe because, unlike the content-
 * language tabs on a field, nothing beside it says what it is about.
 */
export function LanguageSwitcher({
  appearance = 'control',
}: {
  appearance?: keyof typeof APPEARANCE;
}) {
  const look = APPEARANCE[appearance];
  const t = useTranslations('site.interfaceLanguage');
  const locale = useLocale();
  const pathname = usePathname();
  const { confirmLeaving } = useUnsavedChanges();

  // One language is nothing to choose between.
  if (routing.locales.length < 2) {
    return null;
  }

  return (
    <SegmentedControl
      value={locale}
      /*
       * The same page in the other language, asking first if an editor holds
       * unsaved work. A document load, not a client navigation: re-rendering
       * the root layout on the client wiped the theme class from `<html>`, and
       * a locale change is a different document anyway.
       */
      onValueChange={(next) =>
        confirmLeaving(() => {
          const { search, hash } = window.location;

          // `pathname` has no locale on it - `localePrefix` is 'always', so
          // the prefix is added rather than swapped.
          //
          // Next's rule says to use the router here, and for an ordinary
          // internal link it would be right. This is the one case where the
          // client navigation is the defect: it is what wipes the theme off
          // `<html>`. Overridden knowingly, with a test either side of it.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.assign(`/${next}${pathname}${search}${hash}`);
        })
      }
      label={t('label')}
      className={look.root}
    >
      {routing.locales.map((option) => (
        <SegmentedControlItem key={option} value={option} className={look.item}>
          {/* The subtag is what fits in a control this size; the name is what
              a screen reader should hear, because "FR" is not a word. Each
              language is named in itself - "Français", not "French" - since
              the person who needs the switch is the one who cannot read the
              language currently on screen. */}
          <span aria-hidden>{SHORT[option] ?? option.toUpperCase()}</span>
          <span className="sr-only">{languageName(option, option)}</span>
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  );
}
