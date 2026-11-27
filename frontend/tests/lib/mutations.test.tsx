// @vitest-environment jsdom
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  useInvalidatingMutation,
  usePendingRow,
} from '../../src/lib/mutations';

const KEY = ['rows'] as const;

/**
 * Both hooks are shared by every admin list, and neither behaviour is visible
 * in a rendered list: a write that forgets to invalidate leaves the same rows
 * on screen, and a spinner on the wrong row still spins.
 */
function withClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

describe('useInvalidatingMutation', () => {
  it('refetches the list a write changed', async () => {
    const fetchRows = vi.fn().mockResolvedValue(['a']);
    const save = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(
      () => ({
        list: useQuery({ queryKey: KEY, queryFn: fetchRows }),
        write: useInvalidatingMutation(KEY, save),
      }),
      { wrapper: withClient() },
    );

    await waitFor(() => expect(fetchRows).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.write.mutateAsync('id');
    });

    await waitFor(() => expect(fetchRows).toHaveBeenCalledTimes(2));
  });

  it('leaves the list alone when the write fails', async () => {
    const fetchRows = vi.fn().mockResolvedValue(['a']);
    const save = vi.fn().mockRejectedValue(new Error('refused'));

    const { result } = renderHook(
      () => ({
        list: useQuery({ queryKey: KEY, queryFn: fetchRows }),
        write: useInvalidatingMutation(KEY, save),
      }),
      { wrapper: withClient() },
    );

    await waitFor(() => expect(fetchRows).toHaveBeenCalledTimes(1));

    await act(async () => {
      await result.current.write.mutateAsync('id').catch(() => undefined);
    });

    await waitFor(() => expect(result.current.write.isError).toBe(true));
    expect(fetchRows).toHaveBeenCalledTimes(1);
  });
});

describe('usePendingRow', () => {
  it('names the row it is running on, until it settles', () => {
    let settle = () => undefined as void;
    const mutate = vi.fn((_id: string, options: { onSettled: () => void }) => {
      settle = options.onSettled;
    });

    const { result } = renderHook(() => usePendingRow(mutate));

    expect(result.current.pendingId).toBeNull();

    act(() => result.current.run('row-2'));

    expect(mutate).toHaveBeenCalledWith('row-2', expect.anything());
    expect(result.current.pendingId).toBe('row-2');

    act(() => settle());

    expect(result.current.pendingId).toBeNull();
  });
});
