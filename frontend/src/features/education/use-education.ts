'use client';

import { useQuery } from '@tanstack/react-query';

import { useInvalidatingMutation } from '@/lib/mutations';

import {
  createEducation,
  deleteEducation,
  fetchEducation,
  updateEducation,
} from './education-api';
import type { EducationInput } from './education-schema';

export const EDUCATION_QUERY_KEY = ['education'] as const;

export function useEducation() {
  const { data, isPending, error } = useQuery({
    queryKey: EDUCATION_QUERY_KEY,
    queryFn: fetchEducation,
  });

  return { entries: data ?? [], isPending, error };
}

export function useCreateEducation() {
  return useInvalidatingMutation(
    EDUCATION_QUERY_KEY,
    (input: EducationInput) => createEducation(input),
    'created',
  );
}

export function useUpdateEducation() {
  return useInvalidatingMutation(
    EDUCATION_QUERY_KEY,
    ({ id, input }: { id: string; input: EducationInput }) =>
      updateEducation(id, input),
    'saved',
  );
}

export function useDeleteEducation() {
  return useInvalidatingMutation(
    EDUCATION_QUERY_KEY,
    (id: string) => deleteEducation(id),
    'deleted',
  );
}
