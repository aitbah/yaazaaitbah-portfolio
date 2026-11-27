import { collectionApi } from '@/lib/collection-api';

import type { ExperienceInput, LocalizedValues } from './experience-schema';

/** A position as the API returns it - see docs/api-endpoints/experience-api.md. */
export type Experience = {
  id: string;
  role: LocalizedValues;
  organisation: LocalizedValues;
  location?: LocalizedValues;
  employmentType: string;
  /** `YYYY-MM`. */
  startDate: string;
  /** Absent for a current position. */
  endDate?: string;
  current: boolean;
  description?: LocalizedValues;
  updatedAt: string;
};

const positions = collectionApi<Experience, ExperienceInput>(
  '/api/experience',
  {
    list: 'experience',
    one: 'position',
  },
);

export const fetchExperience = positions.list;
export const createExperience = positions.create;
export const updateExperience = positions.update;
export const deleteExperience = positions.remove;
