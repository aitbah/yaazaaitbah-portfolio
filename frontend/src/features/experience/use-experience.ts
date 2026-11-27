'use client';

import { useQuery } from '@tanstack/react-query';

import { useInvalidatingMutation } from '@/lib/mutations';

import {
  createExperience,
  deleteExperience,
  fetchExperience,
  updateExperience,
} from './experience-api';
import type { ExperienceInput } from './experience-schema';

export const EXPERIENCE_QUERY_KEY = ['experience'] as const;

export function useExperience() {
  const { data, isPending, error } = useQuery({
    queryKey: EXPERIENCE_QUERY_KEY,
    queryFn: fetchExperience,
  });

  return { positions: data ?? [], isPending, error };
}

export function useCreateExperience() {
  return useInvalidatingMutation(
    EXPERIENCE_QUERY_KEY,
    (input: ExperienceInput) => createExperience(input),
    'created',
  );
}

export function useUpdateExperience() {
  return useInvalidatingMutation(
    EXPERIENCE_QUERY_KEY,
    ({ id, input }: { id: string; input: ExperienceInput }) =>
      updateExperience(id, input),
    'saved',
  );
}

export function useDeleteExperience() {
  return useInvalidatingMutation(
    EXPERIENCE_QUERY_KEY,
    (id: string) => deleteExperience(id),
    'deleted',
  );
}
