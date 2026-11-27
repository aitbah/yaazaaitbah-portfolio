'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { LoginInput } from './login-schema';
import { fetchSession, login, logout } from './session';

/**
 * Exported because the query client also writes it: any request answered with
 * UNAUTHENTICATED means this cached session is stale, whichever query made it.
 */
export const SESSION_QUERY_KEY = ['auth', 'session'] as const;

/**
 * Session state is server state: the backend owns it through the HttpOnly
 * cookie, which JavaScript can never read. React Query is the cache.
 */
export function useAuth() {
  const { data, isPending } = useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: fetchSession,
  });

  return { user: data ?? null, isPending };
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentials: LoginInput) => login(credentials),
    onSuccess: (user) => {
      // The response already carries the session's user, so re-reading it from
      // the server would only ask for what it just answered.
      queryClient.setQueryData(SESSION_QUERY_KEY, user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(SESSION_QUERY_KEY, null);
    },
  });
}
