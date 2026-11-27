import { collectionApi } from '@/lib/collection-api';

import type { SocialLinkInput } from './social-link-schema';

/** A link as the API returns it - see docs/api-endpoints/social-links-api.md. */
export type SocialLink = {
  id: string;
  platform: string;
  url: string;
  order: number;
  updatedAt: string;
};

const socialLinks = collectionApi<SocialLink, SocialLinkInput>(
  '/api/social-links',
  {
    list: 'socialLinks',
    one: 'socialLink',
  },
);

export const fetchSocialLinks = socialLinks.list;
export const createSocialLink = socialLinks.create;
export const updateSocialLink = socialLinks.update;
export const deleteSocialLink = socialLinks.remove;
