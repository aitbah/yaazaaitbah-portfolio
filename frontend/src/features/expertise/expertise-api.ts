import { RESOURCE_BY_KIND, type ExpertiseKind } from '@portfolio/shared';

import { apiFetch } from '@/lib/api-client';
import { collectionApi } from '@/lib/collection-api';

import type {
  ExpertiseIconValue,
  ExpertiseInput,
  LocalizedValues,
} from './expertise-schema';

/**
 * A skill, technology or tool as the API returns it - one shape, three
 * resources. See `docs/api-endpoints/expertise-api.md`.
 */
export type Expertise = {
  id: string;
  kind: ExpertiseKind;
  name: LocalizedValues;
  category: string;
  level: number;
  /** Absent when there is no logo - always true of a skill. */
  icon?: ExpertiseIconValue;
  order: number;
  updatedAt: string;
};

/**
 * The three are separate resources, not one endpoint with a filter: a filter
 * that can be omitted is a mixed list waiting to be returned by accident.
 */
export function resourcePath(kind: ExpertiseKind): string {
  return `/api/${RESOURCE_BY_KIND[kind]}`;
}

/** Each list arrives under its own plural, and one row under its kind. */
function expertise(kind: ExpertiseKind) {
  return collectionApi<Expertise, ExpertiseInput>(resourcePath(kind), {
    list: RESOURCE_BY_KIND[kind],
    one: kind,
  });
}

/**
 * An empty portfolio is an empty list, not an error - unlike the profile,
 * which answers NOT_FOUND when nothing has been saved.
 */
export function fetchExpertise(kind: ExpertiseKind): Promise<Expertise[]> {
  return expertise(kind).list();
}

export function createExpertise(
  kind: ExpertiseKind,
  input: ExpertiseInput,
): Promise<Expertise> {
  return expertise(kind).create(input);
}

export function updateExpertise(
  kind: ExpertiseKind,
  id: string,
  input: ExpertiseInput,
): Promise<Expertise> {
  return expertise(kind).update(id, input);
}

export function deleteExpertise(
  kind: ExpertiseKind,
  id: string,
): Promise<void> {
  return expertise(kind).remove(id);
}

/**
 * The file is the whole request body: no multipart, so no filename is ever sent
 * and the server names what it stores. Returns the managed path to persist.
 *
 * Only for logos the vendored preset set does not carry - SVG is refused here
 * as everywhere, and the presets are what supply vector marks. Never called for
 * a skill: that route does not exist.
 */
export async function uploadExpertiseIcon(
  kind: ExpertiseKind,
  file: File,
): Promise<string> {
  const { iconUrl } = await apiFetch<{ iconUrl: string }>(
    `${resourcePath(kind)}/icon`,
    {
      method: 'POST',
      headers: { 'Content-Type': file.type },
      body: file,
    },
  );

  return iconUrl;
}
