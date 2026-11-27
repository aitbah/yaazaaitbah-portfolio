import { describe, expect, it } from 'vitest';

import type { SiteContent } from '../../../src/features/site/site-content';
import { visibleSections } from '../../../src/features/site/site-sections';

const EMPTY: SiteContent = {
  profile: null,
  skills: [],
  technologies: [],
  tools: [],
  projects: [],
  experience: [],
  education: [],
  certifications: [],
  courses: [],
  languages: [],
  socialLinks: [],
  options: [],
};

/** Only the fields the rule reads matter; the rest of a row does not. */
const one = [{}] as never;

describe('which sections the page has', () => {
  it('is only the contact form for a portfolio with nothing in it', () => {
    expect(visibleSections(EMPTY)).toEqual(['contact']);
  });

  it('keeps them in the order the page renders them', () => {
    expect(
      visibleSections({
        ...EMPTY,
        experience: one,
        projects: one,
        profile: { bio: { en: 'x' } } as never,
      }),
    ).toEqual(['about', 'work', 'path', 'contact']);
  });

  it.each([
    ['a biography', { profile: { bio: { en: 'x' } } as never }, 'about'],
    ['a project', { projects: one }, 'work'],
    ['a skill', { skills: one }, 'expertise'],
    ['a technology', { technologies: one }, 'expertise'],
    ['a tool', { tools: one }, 'expertise'],
    ['a job', { experience: one }, 'path'],
    ['a degree', { education: one }, 'path'],
    ['a certification', { certifications: one }, 'record'],
    ['a course', { courses: one }, 'record'],
    ['a spoken language', { languages: one }, 'record'],
  ])('shows %s in the %s section', (_, partial, section) => {
    expect(visibleSections({ ...EMPTY, ...partial })).toContain(section);
  });

  // A profile exists the moment anything is saved; only a biography makes a profile section.
  it('has no profile section for a profile with no biography', () => {
    expect(
      visibleSections({
        ...EMPTY,
        profile: { firstName: { en: 'A' } } as never,
      }),
    ).not.toContain('about');
  });
});
