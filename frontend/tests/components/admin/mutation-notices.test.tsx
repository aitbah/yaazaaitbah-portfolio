// @vitest-environment jsdom
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
} from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it } from 'vitest';

import admin from '../../../messages/en/admin.json';
import site from '../../../messages/en/site.json';
import { MutationNotices } from '../../../src/components/admin/mutation-notices';
import { ToastViewport } from '../../../src/components/ui/toast';
import type { MutationNotice } from '../../../src/lib/mutations';

afterEach(cleanup);

/**
 * No admin write raised a toast: saving, adding or deleting succeeded in
 * silence, although the viewport sat above every admin page waiting for one.
 */
function Write({
  notice,
  fail = false,
}: {
  notice?: MutationNotice;
  fail?: boolean;
}) {
  const { mutate, isIdle, isPending } = useMutation({
    mutationFn: () =>
      fail ? Promise.reject(new Error('refused')) : Promise.resolve('ok'),
    meta: notice ? { notice } : undefined,
  });

  return (
    <>
      <button type="button" onClick={() => mutate()}>
        write
      </button>
      <span data-testid="state">
        {isIdle ? 'idle' : isPending ? 'pending' : 'settled'}
      </span>
    </>
  );
}

function renderWrite(props: { notice?: MutationNotice; fail?: boolean }) {
  render(
    <NextIntlClientProvider locale="en" messages={{ ...site, ...admin }}>
      <ToastViewport>
        <QueryClientProvider client={new QueryClient()}>
          <MutationNotices />
          <Write {...props} />
        </QueryClientProvider>
      </ToastViewport>
    </NextIntlClientProvider>,
  );

  fireEvent.click(screen.getByRole('button', { name: 'write' }));
}

const settled = () =>
  waitFor(() =>
    expect(screen.getByTestId('state').textContent).toBe('settled'),
  );

describe('an admin write', () => {
  it.each([
    ['created', 'Added.'],
    ['saved', 'Changes saved.'],
    ['deleted', 'Deleted.'],
  ] as const)('raises a toast when it succeeds (%s)', async (notice, title) => {
    renderWrite({ notice });

    expect(await screen.findByText(title)).toBeTruthy();
  });

  it('raises nothing when it names no outcome', async () => {
    renderWrite({});
    await settled();

    expect(screen.queryByText('Changes saved.')).toBeNull();
    expect(screen.queryAllByRole('status')).toHaveLength(0);
  });

  // The form or list that failed already says so where it happened.
  it('raises nothing when it fails', async () => {
    renderWrite({ notice: 'saved', fail: true });
    await settled();

    expect(screen.queryByText('Changes saved.')).toBeNull();
  });
});
