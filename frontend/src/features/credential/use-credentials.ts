'use client';

import { useQuery } from '@tanstack/react-query';

import { useInvalidatingMutation } from '@/lib/mutations';
import type { CredentialKind } from '@portfolio/shared';

import {
  createCredential,
  deleteCredential,
  fetchCredentials,
  updateCredential,
} from './credential-api';
import type { CredentialInput } from './credential-schema';

/** Per kind, because the two lists are two answers rather than one filtered. */
export function credentialQueryKey(kind: CredentialKind) {
  return ['credentials', kind] as const;
}

export function useCredentials(kind: CredentialKind) {
  const { data, isPending, error } = useQuery({
    queryKey: credentialQueryKey(kind),
    queryFn: () => fetchCredentials(kind),
  });

  return { rows: data ?? [], isPending, error };
}

export function useCreateCredential(kind: CredentialKind) {
  return useInvalidatingMutation(
    credentialQueryKey(kind),
    (input: CredentialInput) => createCredential(kind, input),
    'created',
  );
}

export function useUpdateCredential(kind: CredentialKind) {
  return useInvalidatingMutation(
    credentialQueryKey(kind),
    ({ id, input }: { id: string; input: CredentialInput }) =>
      updateCredential(kind, id, input),
    'saved',
  );
}

export function useDeleteCredential(kind: CredentialKind) {
  return useInvalidatingMutation(
    credentialQueryKey(kind),
    (id: string) => deleteCredential(kind, id),
    'deleted',
  );
}
