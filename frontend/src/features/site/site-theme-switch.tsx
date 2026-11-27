'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useEffectEvent, useRef, useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';

import type { Theme } from '@/components/theme/theme';
import { useTheme } from '@/components/theme/use-theme';
import { cn } from '@/lib/utils';

import { spillTheme } from './motion/spill';

/** The theme on screen, read from `<html>`, where the theme script and the toggle write it. */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });

  return () => observer.disconnect();
}

const shownTheme = (): Theme =>
  document.documentElement.classList.contains('dark') ? 'dark' : 'light';

/**
 * Light or dark, in one press. The new theme grows from the switch itself, a
 * circle spreading until it covers the page. `T` does the same from the
 * keyboard, from the switch - once per page, so a second switch (the phone
 * menu's) passes `shortcut={false}`. Hovered, its disc turns over to show the
 * other theme.
 */
export function SiteThemeSwitch({
  className,
  shortcut = true,
}: {
  className?: string;
  shortcut?: boolean;
}) {
  const t = useTranslations('home.theme');
  const { setTheme } = useTheme();
  // The server cannot know; the label settles on the first client render.
  const theme = useSyncExternalStore<Theme>(
    subscribe,
    shownTheme,
    () => 'dark',
  );
  const busy = useRef(false);
  const button = useRef<HTMLButtonElement>(null);

  async function toggle() {
    if (busy.current) return;
    busy.current = true;

    const next: Theme = shownTheme() === 'dark' ? 'light' : 'dark';
    // The switch's disc, where the eye already is.
    const box = (
      button.current?.firstElementChild ?? button.current
    )?.getBoundingClientRect();

    await spillTheme(() => flushSync(() => setTheme(next)), {
      x: box ? box.left + box.width / 2 : window.innerWidth - 40,
      y: box ? box.top + box.height / 2 : 32,
    });
    busy.current = false;
  }

  const onShortcut = useEffectEvent(() => void toggle());

  useEffect(() => {
    if (!shortcut) return;
    const onKey = (event: KeyboardEvent) => {
      // The target may be the window or the document, which are not elements.
      const target = event.target instanceof Element ? event.target : null;

      if (
        event.key.toLowerCase() === 't' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !target?.closest('input, textarea, select, [contenteditable="true"]') &&
        !event.repeat
      ) {
        onShortcut();
      }
    };

    window.addEventListener('keydown', onKey);

    return () => window.removeEventListener('keydown', onKey);
  }, [shortcut]);

  return (
    <button
      ref={button}
      type="button"
      onClick={() => void toggle()}
      aria-label={theme === 'dark' ? t('toLight') : t('toDark')}
      data-magnetic
      className={cn(
        'group inline-flex items-center gap-2.5 py-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-4 focus-visible:ring-offset-transparent',
        className,
      )}
    >
      {/* Half filled: the filled side is the theme on screen; hovered, it turns to the other. */}
      <span
        aria-hidden
        className="relative size-4 overflow-hidden rounded-full border-[1.5px] border-current transition-[rotate] duration-700 ease-[cubic-bezier(0.65,0,0.35,1)] group-hover:rotate-180 group-focus-visible:rotate-180"
      >
        <span
          className={cn(
            'absolute inset-y-0 bg-current transition-[inset] duration-500 ease-out',
            theme === 'dark' ? 'start-1/2 end-0' : 'start-0 end-1/2',
          )}
        />
      </span>
      <span className="min-w-[3.2em] text-start max-sm:sr-only">
        {theme === 'dark' ? t('dark') : t('light')}
      </span>
    </button>
  );
}
