import { apiFetch } from '@/lib/api-client';
import { collectionApi } from '@/lib/collection-api';

import type { LocalizedValues, ProjectInput } from './project-schema';

/** One image in a project's gallery. */
export type GalleryImage = {
  url: string;
  alt?: LocalizedValues;
};

/** A project as the API returns it - see docs/api-endpoints/projects-api.md. */
export type Project = {
  id: string;
  /** The address it is reachable at. Never absent. */
  slug: string;
  title: LocalizedValues;
  description: LocalizedValues;
  stack: string[];
  imageUrl?: string;
  imageAlt?: LocalizedValues;
  /** In display order, which is the order it is stored in. Never absent. */
  gallery: GalleryImage[];
  /** Why it was hard, rather than what it is. Absent until the owner writes it. */
  role?: LocalizedValues;
  problem?: LocalizedValues;
  approach?: LocalizedValues;
  outcome?: LocalizedValues;
  repoUrl?: string;
  liveUrl?: string;
  featured: boolean;
  order: number;
  updatedAt: string;
};

const projects = collectionApi<Project, ProjectInput>('/api/projects', {
  list: 'projects',
  one: 'project',
});

export const fetchProjects = projects.list;
export const createProject = projects.create;
/** Replaces the whole project, as PUT implies. */
export const updateProject = projects.update;
export const deleteProject = projects.remove;

/**
 * The file is the whole request body: no multipart, so no filename is ever sent
 * and the server names what it stores. Returns the managed path to persist.
 */
export async function uploadCover(file: File): Promise<string> {
  const { imageUrl } = await apiFetch<{ imageUrl: string }>(
    '/api/projects/image',
    {
      method: 'POST',
      headers: { 'Content-Type': file.type },
      body: file,
    },
  );

  return imageUrl;
}

/** A gallery image, by the same contract as the cover. */
export async function uploadGalleryImage(file: File): Promise<string> {
  const { imageUrl } = await apiFetch<{ imageUrl: string }>(
    '/api/projects/gallery',
    {
      method: 'POST',
      headers: { 'Content-Type': file.type },
      body: file,
    },
  );

  return imageUrl;
}
