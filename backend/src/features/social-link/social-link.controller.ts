import { collectionController } from '../../core/http/collection-controller.js';
import {
  createSocialLink,
  listSocialLinks,
  removeSocialLink,
  reorderSocialLinks,
  toSocialLinkResponse,
  updateSocialLink,
} from './social-link.service.js';
import { socialLinkSchema } from './social-link.validation.js';

export const socialLinkController = collectionController({
  label: 'Social link',
  envelope: { list: 'socialLinks', one: 'socialLink' },
  schema: socialLinkSchema,
  service: {
    list: listSocialLinks,
    create: createSocialLink,
    update: updateSocialLink,
    remove: removeSocialLink,
    reorder: reorderSocialLinks,
  },
  toResponse: toSocialLinkResponse,
});
