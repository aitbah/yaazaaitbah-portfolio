// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import admin from '../../../messages/en/admin.json';
import site from '../../../messages/en/site.json';
import responses from '../../../messages/en/responses.json';
import { ReorderStatus } from '../../../src/components/admin/reorder-status';
import { ApiRequestError } from '../../../src/lib/api-client';
import { ToastViewport } from '../../../src/components/ui/toast';

const messages = { ...admin, ...site, ...responses };

afterEach(cleanup);

function show(props: { error?: unknown; isReordering?: boolean }) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale="en" messages={messages}>
        <ToastViewport>{children}</ToastViewport>
      </NextIntlClientProvider>
    );
  }

  return render(
    <ReorderStatus
      error={props.error ?? null}
      isReordering={props.isReordering ?? false}
    />,
    { wrapper: Wrapper },
  );
}

/**
 * A failure is raised as an error toast, so each test finds it in the viewport.
 *
 * All three of these messages existed, in both languages, and nothing rendered
 * any of them. Every list showed `responses.CONFLICT` instead - "That conflicts
 * with something that already exists" - for a refusal whose actual remedy is to
 * reload the page.
 */
describe('an ordering the server refused as stale', () => {
  it('says the list changed and to reload, not that something conflicts', async () => {
    show({ error: new ApiRequestError('CONFLICT', { order: 'STALE' }) });

    expect(
      await screen.findByText(
        'The list changed somewhere else. Reload and try again.',
      ),
    ).toBeTruthy();
  });
});

describe('any other failure', () => {
  it('says the order could not be saved', async () => {
    show({ error: new Error('the network went away') });

    expect(
      await screen.findByText('The order could not be saved.'),
    ).toBeTruthy();
  });

  /**
   * An expired session has a remedy of its own, and "sign in again" is more use
   * than "the order could not be saved" - which would be true and useless.
   */
  it('keeps the session message when the session is what failed', async () => {
    show({ error: new ApiRequestError('UNAUTHENTICATED') });

    expect(
      await screen.findByText(
        'Your session has expired. Please sign in again.',
      ),
    ).toBeTruthy();
  });

  // A conflict that is not staleness is still a failed save, not a duplicate.
  it('does not claim staleness for a conflict without that detail', async () => {
    show({ error: new ApiRequestError('CONFLICT', {}) });

    expect(
      await screen.findByText('The order could not be saved.'),
    ).toBeTruthy();
  });
});

/**
 * A move is optimistic: the row jumps at once and the save happens behind it.
 * That reads fine on screen and says nothing at all to a screen reader, which
 * is the state this message was written for and never used in.
 */
describe('while an ordering is on its way', () => {
  it('announces the save without drawing anything', () => {
    show({ isReordering: true });

    expect(screen.getByRole('status').textContent).toBe('Saving the order…');
  });

  it('says nothing at all when there is nothing to say', () => {
    const { container } = show({});

    expect(container.textContent).toBe('');
  });

  // An error outlives the request that produced it; the pending announcement
  // must not talk over it.
  it('reports the failure rather than the next attempt', async () => {
    show({ error: new Error('nope'), isReordering: true });

    expect(
      await screen.findByText('The order could not be saved.'),
    ).toBeTruthy();
    expect(screen.queryByText('Saving the order…')).toBeNull();
  });
});
