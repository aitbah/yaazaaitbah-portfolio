import type { Experience } from '@/features/experience/experience-api';
import type { Expertise } from '@/features/expertise/expertise-api';
import type { Profile } from '@/features/profile/profile-api';
import type { Project } from '@/features/project/project-api';
import type { SocialLink } from '@/features/social-link/social-link-api';

/** One thing the site needs, and whether it has it. */
export type ReadinessCheck = {
  key: string;
  href: string;
  done: boolean;
};

type Inputs = {
  profile: Profile | null;
  skills: Expertise[];
  technologies: Expertise[];
  tools: Expertise[];
  positions: Experience[];
  projects: Project[];
  socialLinks: SocialLink[];
};

/** True when a localized field holds text in any language. */
function filled(values: Record<string, string> | undefined): boolean {
  return Object.values(values ?? {}).some((value) => value.trim().length > 0);
}

/**
 * What the site still needs, as answered questions, each linking to the page
 * that fixes it. Every check is a field the admin can see - nothing inferred or
 * scored.
 */
export function readinessChecks({
  profile,
  skills,
  technologies,
  tools,
  positions,
  projects,
  socialLinks,
}: Inputs): ReadinessCheck[] {
  return [
    {
      key: 'profile',
      href: '/admin/profile',
      done: profile !== null && filled(profile.firstName),
    },
    {
      key: 'headline',
      href: '/admin/profile',
      done: filled(profile?.headline),
    },
    { key: 'bio', href: '/admin/profile', done: filled(profile?.bio) },
    {
      key: 'photo',
      href: '/admin/profile',
      done: Boolean(profile?.photoUrl),
    },
    {
      key: 'resume',
      href: '/admin/profile',
      // A locale-keyed map of stored paths; any one of them counts.
      done: Object.values(profile?.resume ?? {}).some(Boolean),
    },
    { key: 'skills', href: '/admin/skills', done: skills.length > 0 },
    {
      key: 'technologies',
      href: '/admin/technologies',
      done: technologies.length > 0,
    },
    { key: 'tools', href: '/admin/tools', done: tools.length > 0 },
    {
      key: 'experience',
      href: '/admin/experience',
      done: positions.length > 0,
    },
    { key: 'projects', href: '/admin/projects', done: projects.length > 0 },
    {
      key: 'socialLinks',
      href: '/admin/social-links',
      done: socialLinks.length > 0,
    },
  ];
}
