// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  THEME_SCRIPT,
  THEME_STORAGE_KEY,
} from '../../../src/components/theme/theme';
import { ThemeScript } from '../../../src/components/theme/theme-script';

// jsdom has no media queries, and the theme falls back to the system's answer.
beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
  document.body.innerHTML = '';
  document.documentElement.className = '';
  document.documentElement.style.colorScheme = '';
});

describe('the theme script', () => {
  it('applies the stored theme when it is mounted in the browser, as on a page built there', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    document.documentElement.className = '';

    render(<ThemeScript />);

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });

  it('is in the HTML the server sends', () => {
    const html = renderToString(<ThemeScript />);

    expect(html).toContain(`<script>${THEME_SCRIPT}</script>`);
  });

  it('is never created by the client, so React has no script tag to warn about', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { container } = render(<ThemeScript />);

    expect(container.querySelector('script')).toBeNull();
    expect(
      error.mock.calls.some((call) => String(call[0]).includes('script tag')),
    ).toBe(false);
  });

  it('is adopted while hydrating what the server sent, without a warning', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const host = document.createElement('div');
    host.innerHTML = renderToString(<ThemeScript />);
    document.body.append(host);
    const served = host.querySelector('script');

    expect(served).not.toBeNull();

    // Synchronous, so hydration and the render straight after it are both
    // flushed before the assertions run.
    act(() => {
      hydrateRoot(host, <ThemeScript />);
    });

    // Adopted, not re-created: the element the browser already ran was
    // hydrated, and once the page is live the component renders nothing.
    expect(error.mock.calls.map((call) => String(call[0]))).not.toContainEqual(
      expect.stringContaining('script tag'),
    );
    expect(
      error.mock.calls.some((call) => String(call[0]).includes('hydrat')),
    ).toBe(false);
  });
});
