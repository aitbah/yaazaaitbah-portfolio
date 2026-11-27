import { collectionController } from '../../core/http/collection-controller.js';
import {
  createExperience,
  listExperience,
  removeExperience,
  toExperienceResponse,
  updateExperience,
} from './experience.service.js';
import { experienceSchema } from './experience.validation.js';

export const experienceController = collectionController({
  label: 'Experience',
  // A mass noun on purpose: "experiences" is not what a CV section is called.
  envelope: { list: 'experience', one: 'position' },
  schema: experienceSchema,
  service: {
    list: listExperience,
    create: createExperience,
    update: updateExperience,
    remove: removeExperience,
  },
  toResponse: toExperienceResponse,
});
