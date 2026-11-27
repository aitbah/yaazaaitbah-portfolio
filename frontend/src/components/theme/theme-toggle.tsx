'use client';

import { MonitorIcon, MoonIcon, SunIcon, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  SegmentedControl,
  SegmentedControlItem,
} from '@/components/ui/segmented-control';

import { THEME_CHOICES, type ThemeChoice } from './theme';
import { useTheme } from './use-theme';

const ICONS: Record<ThemeChoice, LucideIcon> = {
  system: MonitorIcon,
  light: SunIcon,
  dark: MoonIcon,
};

/**
 * System, light or dark, as visible options: a flipping button never shows the
 * current state. System is how a choice is taken back.
 */
export function ThemeToggle() {
  const t = useTranslations('site.theme');
  const { theme, setTheme } = useTheme();

  return (
    <SegmentedControl value={theme} onValueChange={setTheme} label={t('label')}>
      {THEME_CHOICES.map((option) => {
        const Icon = ICONS[option];

        return (
          <SegmentedControlItem key={option} value={option}>
            {/* The icon carries the meaning on screen; the name carries it to
                a screen reader. An icon-only control with no accessible name
                is announced as its own markup. */}
            <Icon aria-hidden />
            <span className="sr-only">{t(option)}</span>
          </SegmentedControlItem>
        );
      })}
    </SegmentedControl>
  );
}
