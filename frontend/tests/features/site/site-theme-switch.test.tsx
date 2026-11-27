// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import home from '../../../messages/en/home.json';
import { SiteThemeSwitch } from '../../../src/features/site/site-theme-switch';

const t = home.home.theme;

beforeEach(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    // Reduced motion, so the change is immediate rather than a View Transition.
    matches: query.includes('reduce'),
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
  document.documentElement.classList.remove('dark');
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const show = () =>
  render(
    <NextIntlClientProvider locale="en" messages={home}>
      <SiteThemeSwitch />
      <input aria-label="Somewhere to type" />
    </NextIntlClientProvider>,
  );

describe('the theme switch', () => {
  it('says the theme on screen and offers the other', () => {
    show();

    expect(
      screen.getByRole('button', { name: t.toDark }).textContent,
    ).toContain(t.light);
  });

  it('switches to dark and back, and remembers the choice', async () => {
    show();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: t.toDark }));
      await Promise.resolve();
    });
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('portfolio-theme')).toBe('dark');
    expect(
      screen.getByRole('button', { name: t.toLight }).textContent,
    ).toContain(t.dark);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: t.toLight }));
      await Promise.resolve();
    });
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('answers T, but not while someone is typing', async () => {
    show();

    await act(async () => {
      fireEvent.keyDown(screen.getByLabelText('Somewhere to type'), {
        key: 't',
      });
      await Promise.resolve();
    });
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    await act(async () => {
      fireEvent.keyDown(window, { key: 'T' });
      await Promise.resolve();
    });
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
