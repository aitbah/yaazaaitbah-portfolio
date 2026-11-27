import { collectionController } from '../../core/http/collection-controller.js';
import {
  createLanguage,
  listLanguages,
  removeLanguage,
  reorderLanguages,
  toLanguageResponse,
  updateLanguage,
} from './language.service.js';
import { languageSchema } from './language.validation.js';

export const languageController = collectionController({
  label: 'Language',
  envelope: { list: 'languages', one: 'language' },
  schema: languageSchema,
  service: {
    list: listLanguages,
    create: createLanguage,
    update: updateLanguage,
    remove: removeLanguage,
    reorder: reorderLanguages,
  },
  toResponse: toLanguageResponse,
});
