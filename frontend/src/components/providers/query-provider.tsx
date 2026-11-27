'use client';

import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { SESSION_QUERY_KEY } from '@/features/auth/use-auth';
import { ApiRequestError } from '@/lib/api-client';

function isUnauthenticated(error: unknown): boolean {
  return error instanceof ApiRequestError && error.code === 'UNAUTHENTICATED';
}

/**
 * Shared infrastructure: it wraps both the public and admin trees from the
 * locale layout. Server components stay server components - they are passed
 * through as `children`.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => {
    /**
     * A session can expire mid-work, and the next request is what notices.
     * Clearing the cached session is enough: the protected layout redirects
     * when there is no user.
     */
    const forgetSession = (error: unknown) => {
      if (isUnauthenticated(error)) {
        client.setQueryData(SESSION_QUERY_KEY, null);
      }
    };

    const client = new QueryClient({
      queryCache: new QueryCache({ onError: forgetSession }),
      mutationCache: new MutationCache({ onError: forgetSession }),
      defaultOptions: {
        queries: {
          // Never retry: a 401 is an answer, not a failure to retry.
          retry: false,
          staleTime: 30_000,
        },
      },
    });

    return client;
  });

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
