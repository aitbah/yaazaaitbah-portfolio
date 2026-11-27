import { afterEach, vi } from 'vitest';

import type * as NextNavigation from 'next/navigation';

import { useTestSearchParams } from './support/search-params';

/**
 * The admin reads which editor is open from `useSearchParams`, which is the
 * App Router's and returns `null` outside it - so every page test would throw
 * before rendering a row.
 *
 * Only that one export is replaced; `notFound` and the rest stay real. The
 * stand-in reads the same `window.location` the application does, so the tests
 * press the same Back button.
 */
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof NextNavigation>()),
  useSearchParams: useTestSearchParams,
}));

/**
 * Each test starts at a clean address.
 *
 * The admin's editors are a search parameter now, so a test that opens one
 * leaves `?edit=` behind - and jsdom keeps one window for the whole file, so
 * the next test in it would render an open editor before it had clicked
 * anything. Replacing rather than pushing, so no test can navigate back into
 * the one before it.
 */
afterEach(() => {
  if (typeof window !== 'undefined') {
    window.history.replaceState(null, '', '/');
  }
});

/**
 * Browser APIs jsdom does not implement, which the Radix primitives use:
 * measuring a popover, capturing the pointer, scrolling an option into view.
 *
 * These are the environment catching up with the components, not the
 * components being worked around - which is why they live here rather than
 * being re-stubbed in every suite that happens to render one.
 */
if (typeof window !== 'undefined') {
  class ResizeObserverStub {
    observe() {
      return undefined;
    }
    unobserve() {
      return undefined;
    }
    disconnect() {
      return undefined;
    }
  }

  window.ResizeObserver ??= ResizeObserverStub;

  Object.assign(Element.prototype, {
    hasPointerCapture: () => false,
    setPointerCapture: () => undefined,
    releasePointerCapture: () => undefined,
    scrollIntoView: () => undefined,
  });
}
