'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { SESSION_QUERY_KEY } from '@/features/auth/use-auth';

import {
  changeEmail,
  changePassword,
  revokeOtherSessions,
} from './account-api';
import type { EmailFormInput, PasswordFormInput } from './account-schema';

/**
 * Neither of these two invalidates anything - unlike the address below.
 *
 * Both re-issue the session cookie server-side, and the cookie is HttpOnly - so
 * there is no client state to reconcile, and re-reading `/api/auth/me` would
 * only ask for the account this page is already showing.
 */
export function useChangePassword() {
  return useMutation({
    mutationFn: (input: PasswordFormInput) => changePassword(input),
  });
}

export function useRevokeSessions() {
  return useMutation({ mutationFn: revokeOtherSessions });
}

/**
 * The one account mutation that updates the cache: the address is the account,
 * and the response already carries it.
 */
export function useChangeEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: EmailFormInput) => changeEmail(input),
    onSuccess: (user) => {
      queryClient.setQueryData(SESSION_QUERY_KEY, user);
    },
  });
}
