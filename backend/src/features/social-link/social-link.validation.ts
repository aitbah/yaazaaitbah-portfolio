import { z } from 'zod';

import { externalUrl, projectOrder, socialPlatform } from '@portfolio/shared';

/** The whole link. `PUT` replaces rather than merges, as elsewhere. */
export const socialLinkSchema = z.object({
  platform: socialPlatform,
  url: externalUrl,
  // Absent means "leave it at the front"; there is no reorder UI to send it.
  order: projectOrder.default(0),
});

export type SocialLinkInput = z.infer<typeof socialLinkSchema>;
