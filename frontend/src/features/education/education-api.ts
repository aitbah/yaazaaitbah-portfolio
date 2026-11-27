import { collectionApi } from '@/lib/collection-api';

import type { EducationInput, LocalizedValues } from './education-schema';

/** An entry as the API returns it - see docs/api-endpoints/education-api.md. */
export type Education = {
  id: string;
  institution: LocalizedValues;
  qualification: LocalizedValues;
  fieldOfStudy?: LocalizedValues;
  level: string;
  location?: LocalizedValues;
  /** `YYYY-MM`. */
  startDate: string;
  /** Absent while the course is under way. */
  endDate?: string;
  current: boolean;
  description?: LocalizedValues;
  updatedAt: string;
};

const education = collectionApi<Education, EducationInput>('/api/education', {
  list: 'education',
  one: 'entry',
});

export const fetchEducation = education.list;
export const createEducation = education.create;
export const updateEducation = education.update;
export const deleteEducation = education.remove;
