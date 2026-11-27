import type { SiteContent } from './site-content';

/** Every section the home page can show, in the order it shows them. */
export const SITE_SECTIONS = [
  'about',
  'work',
  'expertise',
  'path',
  'record',
  'contact',
] as const;

export type SiteSection = (typeof SITE_SECTIONS)[number];

/** The sections the navigation names; the profile follows the opening unannounced. */
export const NAV_SECTIONS = [
  'work',
  'expertise',
  'path',
  'record',
  'contact',
] as const;

/**
 * Which sections have content - one answer for the page and the navigation, so
 * no link points at an empty section. Contact is always there: it is the form.
 */
export function visibleSections(content: SiteContent): SiteSection[] {
  const has: Record<SiteSection, boolean> = {
    about: Boolean(content.profile?.bio),
    work: content.projects.length > 0,
    expertise: Boolean(
      content.skills.length ||
      content.technologies.length ||
      content.tools.length,
    ),
    path: Boolean(content.experience.length || content.education.length),
    record: Boolean(
      content.certifications.length ||
      content.courses.length ||
      content.languages.length,
    ),
    contact: true,
  };

  return SITE_SECTIONS.filter((section) => has[section]);
}
