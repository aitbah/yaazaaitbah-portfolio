import { collectionController } from '../../core/http/collection-controller.js';
import {
  createEducation,
  listEducation,
  removeEducation,
  toEducationResponse,
  updateEducation,
} from './education.service.js';
import { educationSchema } from './education.validation.js';

export const educationController = collectionController({
  label: 'Education',
  // `education`, a mass noun as `experience` is: "educations" is not what the
  // section is called.
  envelope: { list: 'education', one: 'entry' },
  schema: educationSchema,
  service: {
    list: listEducation,
    create: createEducation,
    update: updateEducation,
    remove: removeEducation,
  },
  toResponse: toEducationResponse,
});
