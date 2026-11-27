import { connection } from 'next/server';
import { cache } from 'react';

import type { Credential } from '@/features/credential/credential-api';
import type { Education } from '@/features/education/education-api';
import type { Experience } from '@/features/experience/experience-api';
import type { Expertise } from '@/features/expertise/expertise-api';
import type { Language } from '@/features/language/language-api';
import type { Option } from '@/features/option/option-api';
import {
  readProfile,
  type PublicProfile,
} from '@/features/profile/public-profile';
import type { Project } from '@/features/project/project-api';
import type { SocialLink } from '@/features/social-link/social-link-api';
import { readList } from '@/lib/server-api';

/**
 * Everything the public site shows, read in one place. The types are the
 * admin's, so a field reaches both halves or neither; `server-api` never
 * throws, so the page renders what it can while the API is down.
 */
export type SiteContent = {
  profile: PublicProfile | null;
  skills: Expertise[];
  technologies: Expertise[];
  tools: Expertise[];
  projects: Project[];
  experience: Experience[];
  education: Education[];
  certifications: Credential[];
  courses: Credential[];
  languages: Language[];
  socialLinks: SocialLink[];
  /** The labels behind every stored code: categories, levels, platforms. */
  options: Option[];
};

/**
 * In parallel, and memoized with React's `cache`: the layout, the page and
 * `generateMetadata` all read it in one render.
 *
 * Read per request, never at build. A build has no API to read, so a page
 * prerendered then served an empty portfolio until it was revalidated. The
 * reads themselves are still cached for `PUBLIC_REVALIDATE_SECONDS`.
 */
export const readSiteContent = cache(async (): Promise<SiteContent> => {
  await connection();

  const [
    profile,
    skills,
    technologies,
    tools,
    projects,
    experience,
    education,
    certifications,
    courses,
    languages,
    socialLinks,
    options,
  ] = await Promise.all([
    readProfile(),
    readList<Expertise>('/api/skills', 'skills'),
    readList<Expertise>('/api/technologies', 'technologies'),
    readList<Expertise>('/api/tools', 'tools'),
    readList<Project>('/api/projects', 'projects'),
    readList<Experience>('/api/experience', 'experience'),
    readList<Education>('/api/education', 'education'),
    readList<Credential>('/api/certifications', 'certifications'),
    readList<Credential>('/api/courses', 'courses'),
    readList<Language>('/api/languages', 'languages'),
    readList<SocialLink>('/api/social-links', 'socialLinks'),
    readList<Option>('/api/options', 'options'),
  ]);

  return {
    profile,
    skills,
    technologies,
    tools,
    projects,
    experience,
    education,
    certifications,
    courses,
    languages,
    socialLinks,
    options,
  };
});
