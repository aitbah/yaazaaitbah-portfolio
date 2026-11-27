// @vitest-environment jsdom
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { QueryProvider } from '../../../src/components/providers/query-provider';
import { SESSION_QUERY_KEY } from '../../../src/features/auth/use-auth';
import { ApiRequestError } from '../../../src/lib/api-client';

/**
 * A session can expire while the admin is working, and the first thing to
 * notice is whichever request happens next. Before this, the cached session
 * stayed "signed in" and the admin sat on a page saying it had expired with
 * nothing taking them anywhere.
 */
function Probe({ fail }: { fail: () => Promise<unknown> }) {
  const client = useQueryClient();
  const { isPending } = useQuery({ queryKey: ['probe'], queryFn: fail });

  const session = client.getQueryData(SESSION_QUERY_KEY);

  return (
    <div>
      <span data-testid="state">{isPending ? 'pending' : 'settled'}</span>
      <span data-testid="session">
        {session === null ? 'forgotten' : 'still signed in'}
      </span>
    </div>
  );
}

function renderWith(fail: () => Promise<unknown>) {
  return render(
    <QueryProvider>
      <Probe fail={fail} />
    </QueryProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the query client', () => {
  it('forgets the session when any request answers UNAUTHENTICATED', async () => {
    renderWith(() => Promise.reject(new ApiRequestError('UNAUTHENTICATED')));

    await waitFor(() =>
      expect(screen.getByTestId('state').textContent).toBe('settled'),
    );

    expect(screen.getByTestId('session').textContent).toBe('forgotten');
  });

  // Only that one code: a failed read of something else says nothing about
  // whether the admin is still signed in, and signing them out would be wrong.
  it.each(['SERVER_ERROR', 'NOT_FOUND', 'VALIDATION_ERROR', 'CONFLICT'])(
    'leaves the session alone for %s',
    async (code) => {
      renderWith(() => Promise.reject(new ApiRequestError(code)));

      await waitFor(() =>
        expect(screen.getByTestId('state').textContent).toBe('settled'),
      );

      expect(screen.getByTestId('session').textContent).toBe('still signed in');
    },
  );

  it('leaves the session alone for a network failure', async () => {
    renderWith(() => Promise.reject(new Error('offline')));

    await waitFor(() =>
      expect(screen.getByTestId('state').textContent).toBe('settled'),
    );

    expect(screen.getByTestId('session').textContent).toBe('still signed in');
  });
});
