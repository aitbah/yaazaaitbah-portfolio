'use client';

import { useMutation, useQuery } from '@tanstack/react-query';

import { useInvalidatingMutation } from '@/lib/mutations';

import {
  createProject,
  deleteProject,
  fetchProjects,
  updateProject,
  uploadCover,
  uploadGalleryImage,
} from './project-api';
import type { ProjectInput } from './project-schema';

/** Exported so the reorder hook invalidates the same list it reordered. */
export const PROJECTS_QUERY_KEY = ['projects'] as const;

export function useProjects() {
  const { data, isPending, error } = useQuery({
    queryKey: PROJECTS_QUERY_KEY,
    queryFn: fetchProjects,
  });

  return { projects: data ?? [], isPending, error };
}

export function useCreateProject() {
  return useInvalidatingMutation(
    PROJECTS_QUERY_KEY,
    (input: ProjectInput) => createProject(input),
    'created',
  );
}

export function useUpdateProject() {
  return useInvalidatingMutation(
    PROJECTS_QUERY_KEY,
    ({ id, input }: { id: string; input: ProjectInput }) =>
      updateProject(id, input),
    'saved',
  );
}

export function useDeleteProject() {
  return useInvalidatingMutation(
    PROJECTS_QUERY_KEY,
    (id: string) => deleteProject(id),
    'deleted',
  );
}

/**
 * The upload stands alone: it stores a file and answers with its path, which
 * only becomes the project's cover when the form is saved.
 */
export function useUploadCover() {
  return useMutation({ mutationFn: (file: File) => uploadCover(file) });
}

/**
 * Not an invalidating mutation: uploading stores a file but changes no project, so
 * invalidating the list would refetch it for nothing. The reference becomes
 * part of the gallery only when the form is saved.
 */
export function useUploadGalleryImage() {
  return useMutation({ mutationFn: (file: File) => uploadGalleryImage(file) });
}
