'use client';

import { useMutation, useQuery } from '@tanstack/react-query';

import { fetchMailStatus, sendTestMail } from './mail-api';

export const MAIL_STATUS_QUERY_KEY = ['mail', 'status'] as const;

/**
 * Read once per visit and not refetched on its own: the settings come from the
 * environment, so they cannot change without a restart, which ends every query
 * cache in the browser anyway.
 */
export function useMailStatus() {
  return useQuery({
    queryKey: MAIL_STATUS_QUERY_KEY,
    queryFn: fetchMailStatus,
    staleTime: Infinity,
  });
}

/**
 * Nothing is invalidated on success. A test send changes no state - that is
 * what makes it safe to offer as a button.
 */
export function useSendTestMail() {
  return useMutation({ mutationFn: sendTestMail });
}
