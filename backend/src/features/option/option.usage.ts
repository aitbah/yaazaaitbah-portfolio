import type { OptionListKey } from '@portfolio/shared';

import { EducationModel } from '../education/education.model.js';
import { ExperienceModel } from '../experience/experience.model.js';
import { ExpertiseModel } from '../expertise/expertise.model.js';
import { LanguageModel } from '../language/language.model.js';
import { ProfileModel } from '../profile/profile.model.js';
import { SocialLinkModel } from '../social-link/social-link.model.js';
import { OptionModel } from './option.model.js';

/**
 * How many rows deleting an option would strand. A total record, so a list
 * added without saying what uses it does not compile. Models only, to avoid an
 * import cycle.
 */
export const OPTION_USAGE: Record<
  OptionListKey,
  (code: string) => Promise<number>
> = {
  'availability-status': (code) =>
    ProfileModel.countDocuments({ 'contact.availability': code }),
  'skill-category': (code) =>
    ExpertiseModel.countDocuments({ kind: 'skill', category: code }),
  'technology-category': (code) =>
    ExpertiseModel.countDocuments({ kind: 'technology', category: code }),
  'tool-category': (code) =>
    ExpertiseModel.countDocuments({ kind: 'tool', category: code }),
  'employment-type': (code) =>
    ExperienceModel.countDocuments({ employmentType: code }),
  'education-level': (code) => EducationModel.countDocuments({ level: code }),
  'language-level': (code) => LanguageModel.countDocuments({ level: code }),
  'social-platform': (code) =>
    SocialLinkModel.countDocuments({ platform: code }),
  /**
   * A heading is in use by the options filed under it, not by content. Deleting
   * one out from under a platform would leave that platform in a group the
   * picker cannot draw a title for.
   */
  'social-platform-group': (code) =>
    OptionModel.countDocuments({ list: 'social-platform', group: code }),
};
