'use client';

import { useMutation, useQuery } from '@tanstack/react-query';

import { useInvalidatingMutation } from '@/lib/mutations';
import type { ExpertiseKind } from '@portfolio/shared';

import {
  createExpertise,
  deleteExpertise,
  fetchExpertise,
  updateExpertise,
  uploadExpertiseIcon,
} from './expertise-api';
import type { ExpertiseInput } from './expertise-schema';

/**
 * One cache entry per kind. Exported so the reorder hook invalidates the same
 * list it reordered - and so reordering technologies never refetches tools.
 */
export function expertiseQueryKey(kind: ExpertiseKind) {
  return ['expertise', kind] as const;
}

export function useExpertise(kind: ExpertiseKind) {
  const { data, isPending, error } = useQuery({
    queryKey: expertiseQueryKey(kind),
    queryFn: () => fetchExpertise(kind),
  });

  return { rows: data ?? [], isPending, error };
}

export function useCreateExpertise(kind: ExpertiseKind) {
  return useInvalidatingMutation(
    expertiseQueryKey(kind),
    (input: ExpertiseInput) => createExpertise(kind, input),
    'created',
  );
}

export function useUpdateExpertise(kind: ExpertiseKind) {
  return useInvalidatingMutation(
    expertiseQueryKey(kind),
    ({ id, input }: { id: string; input: ExpertiseInput }) =>
      updateExpertise(kind, id, input),
    'saved',
  );
}

export function useDeleteExpertise(kind: ExpertiseKind) {
  return useInvalidatingMutation(
    expertiseQueryKey(kind),
    (id: string) => deleteExpertise(kind, id),
    'deleted',
  );
}

/**
 * Not an invalidating mutation: uploading stores a file but changes no row, so
 * invalidating the list would refetch it for nothing. The reference becomes a
 * logo only when the form is saved.
 */
export function useUploadExpertiseIcon(kind: ExpertiseKind) {
  return useMutation({
    mutationFn: (file: File) => uploadExpertiseIcon(kind, file),
  });
}
