'use client';

import { useCallback, useSyncExternalStore } from 'react';

import {
  applyTheme,
  rememberTheme,
  resolvedTheme,
  storedTheme,
  watchSystemTheme,
  type ThemeChoice,
} from './theme';

/**
 * The stored choice is the source of truth, not React state: the inline script
 * has already applied it. It is the choice rather than the class, since
 * `system` and what it resolves to look the same. The server snapshot is
 * `system`, corrected after hydration.
 */

/**
 * Storage raises no event in the tab that wrote to it, so a choice made here
 * is announced here - to every toggle on the page, the mobile menu's included.
 */
const choiceListeners = new Set<() => void>();

function subscribe(onStoreChange: () => void): () => void {
  choiceListeners.add(onStoreChange);

  // Another tab of the same site making the choice. Applying it here rather
  // than only re-reading keeps every open tab on the same theme.
  const onStorage = () => {
    applyTheme(resolvedTheme());
    onStoreChange();
  };

  // The system flipping - at sunset, or on a schedule. It only decides for
  // someone who has not made a choice of their own.
  const stopWatchingSystem = watchSystemTheme(() => {
    if (storedTheme() === null) {
      applyTheme(resolvedTheme());
    }
  });

  window.addEventListener('storage', onStorage);

  return () => {
    choiceListeners.delete(onStoreChange);
    window.removeEventListener('storage', onStorage);
    stopWatchingSystem();
  };
}

function readChoice(): ThemeChoice {
  return storedTheme() ?? 'system';
}

function serverChoice(): ThemeChoice {
  return 'system';
}

export function useTheme(): {
  theme: ThemeChoice;
  setTheme: (theme: ThemeChoice) => void;
} {
  const theme = useSyncExternalStore(subscribe, readChoice, serverChoice);

  const setTheme = useCallback((next: ThemeChoice) => {
    rememberTheme(next);
    applyTheme(resolvedTheme());
    choiceListeners.forEach((listener) => listener());
  }, []);

  return { theme, setTheme };
}
