// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import site from '../../../messages/en/site.json';
import {
  THEME_SCRIPT,
  THEME_STORAGE_KEY,
} from '../../../src/components/theme/theme';
import { ThemeToggle } from '../../../src/components/theme/theme-toggle';

/**
 * jsdom has no media queries at all, so the system preference is a stub. It is
 * mutable because half of what the theme decides is what to do when nobody has
 * chosen: the operating system is the other half of the input.
 */
const system = {
  prefersDark: false,
  listeners: new Set<() => void>(),
  /** The operating system changing its mind while the page is open. */
  flipTo(prefersDark: boolean) {
    system.prefersDark = prefersDark;
    for (const listener of system.listeners) {
      listener();
    }
  },
};

function stubMatchMedia() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query.includes('dark') && system.prefersDark,
      media: query,
      addEventListener: (_: string, listener: () => void) =>
        system.listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) =>
        system.listeners.delete(listener),
    })),
  );
}

type Choice = 'System' | 'Light' | 'Dark';

function renderToggle() {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale="en" messages={site}>
        {children}
      </NextIntlClientProvider>
    );
  }

  return render(<ThemeToggle />, { wrapper: Wrapper });
}

function option(name: Choice) {
  return screen.getByRole('radio', { name });
}

function isDark() {
  return document.documentElement.classList.contains('dark');
}

beforeEach(() => {
  system.prefersDark = false;
  system.listeners.clear();
  stubMatchMedia();
  localStorage.clear();
  document.documentElement.className = '';
  document.documentElement.style.colorScheme = '';
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/**
 * The control follows the document rather than its own state, and the document
 * reports a change one microtask later - which is before the browser paints and
 * after the test's click returns.
 */
function checked(name: Choice) {
  return waitFor(() =>
    expect(option(name).getAttribute('aria-checked')).toBe('true'),
  );
}

/**
 * The script that runs before anything is painted.
 *
 * It cannot import the module it belongs to - it has to execute before React
 * exists - so it is the one piece of this feature that could drift from the
 * rest without anything noticing. Running it is the only way to know it still
 * makes the same decision the toggle does.
 */
describe('the theme applied before the first paint', () => {
  function runScript() {
    // The script is a string on purpose - it has to run before any module
    // does. Compiling it is the only way to execute the real thing rather
    // than a copy of it that cannot drift.
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const run = new Function(THEME_SCRIPT) as () => void;

    run();
  }

  it('applies a stored choice', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');

    runScript();

    expect(isDark()).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });

  // Not the same as choosing light: nothing is stored until the toggle is used.
  it('follows the system when nothing has been chosen', () => {
    system.prefersDark = true;

    runScript();

    expect(isDark()).toBe(true);
  });

  // An explicit choice outranks the system, in both directions.
  it('keeps a light choice on a system that prefers dark', () => {
    system.prefersDark = true;
    localStorage.setItem(THEME_STORAGE_KEY, 'light');

    runScript();

    expect(isDark()).toBe(false);
  });

  it('leaves the page light rather than failing when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage is blocked');
    });

    expect(() => runScript()).not.toThrow();
    expect(isDark()).toBe(false);
  });
});

describe('the theme toggle', () => {
  /**
   * Visible options rather than one button that flips. A flipping button only
   * ever says which theme you would get, which reads as the one you are
   * already in to half the people who see it.
   */
  it('shows every choice, with system marked on a first visit', () => {
    renderToggle();

    expect(option('System').getAttribute('aria-checked')).toBe('true');
    expect(option('Light').getAttribute('aria-checked')).toBe('false');
    expect(option('Dark').getAttribute('aria-checked')).toBe('false');
  });

  it('applies the theme that is chosen', async () => {
    renderToggle();

    fireEvent.click(option('Dark'));

    expect(isDark()).toBe(true);
    await checked('Dark');
  });

  it('remembers the choice', () => {
    renderToggle();

    fireEvent.click(option('Dark'));

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  /**
   * The stored choice is the source of truth, not a piece of React state. The
   * script has already applied it by the time this mounts, so state initialised
   * here would start out disagreeing with the page.
   */
  it('starts on the choice already applied to the page', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    document.documentElement.classList.add('dark');

    renderToggle();

    expect(option('Dark').getAttribute('aria-checked')).toBe('true');
  });

  it('switches back', async () => {
    document.documentElement.classList.add('dark');
    renderToggle();

    fireEvent.click(option('Light'));

    expect(isDark()).toBe(false);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    await checked('Light');
  });

  /**
   * The system only decides for someone who has not decided. Following it after
   * an explicit choice would undo that choice at sunset.
   */
  it('follows the system while nothing has been chosen', async () => {
    renderToggle();

    system.flipTo(true);

    await waitFor(() => expect(isDark()).toBe(true));
    expect(option('System').getAttribute('aria-checked')).toBe('true');
  });

  it('ignores the system once a choice has been made', async () => {
    renderToggle();
    fireEvent.click(option('Dark'));
    await checked('Dark');

    system.flipTo(false);

    expect(isDark()).toBe(true);
  });

  /**
   * System is how a choice is taken back. It forgets what was stored, so the
   * page is back to following the device - at once, and when the device next
   * changes.
   */
  it('goes back to following the system', async () => {
    system.prefersDark = true;
    renderToggle();
    fireEvent.click(option('Light'));
    await checked('Light');

    fireEvent.click(option('System'));

    await checked('System');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(isDark()).toBe(true);

    system.flipTo(false);

    expect(isDark()).toBe(false);
  });

  // Choosing system on a page that already looks the way the system wants
  // changes nothing on screen, and the control must still move.
  it('marks system even when the page does not change', async () => {
    renderToggle();
    fireEvent.click(option('Light'));
    await checked('Light');

    fireEvent.click(option('System'));

    await checked('System');
    expect(isDark()).toBe(false);
  });

  /**
   * The control is built on a toggle group, and a toggle group's second press
   * turns the option back off. A setting has no "off": pressing "Dark" on a
   * dark page has to mean nothing, not "go back to following the system".
   */
  it('does nothing when the theme already on is pressed again', async () => {
    renderToggle();
    fireEvent.click(option('Dark'));
    await checked('Dark');

    fireEvent.click(option('Dark'));

    expect(isDark()).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  // Every tab of the same site is the same browser and the same person.
  it('follows a choice made in another tab', async () => {
    renderToggle();

    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    fireEvent(window, new StorageEvent('storage', { key: THEME_STORAGE_KEY }));

    await checked('Dark');
    expect(isDark()).toBe(true);
  });

  // Private browsing, or a browser set to block site data. Worth doing, never
  // worth failing over.
  it('still applies a theme it cannot remember', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage is blocked');
    });
    renderToggle();

    expect(() => fireEvent.click(option('Dark'))).not.toThrow();
    expect(isDark()).toBe(true);
    await checked('Dark');
  });
});
