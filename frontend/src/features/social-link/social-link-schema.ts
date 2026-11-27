import { z } from 'zod';

import { externalUrl, projectOrder, socialPlatform } from '@portfolio/shared';

export const socialLinkSchema = z.object({
  /**
   * The select holds '' while nothing is chosen, which the code rule already
   * reads as "you did not choose" - its minimum of one is what the enum this
   * replaced needed a preprocessing step to say.
   */
  platform: socialPlatform,
  url: externalUrl,
  order: projectOrder,
});

/** What the API is sent. */
export type SocialLinkInput = z.infer<typeof socialLinkSchema>;

/** What the form holds; `platform` is a code the option list offers. */
export type SocialLinkFormValues = {
  platform: string;
  url: string;
  order: number;
};
