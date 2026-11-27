import type { Credential } from '../../../../src/features/credential/credential-api';
import type { Education } from '../../../../src/features/education/education-api';
import type { Experience } from '../../../../src/features/experience/experience-api';
import type { Expertise } from '../../../../src/features/expertise/expertise-api';
import type { Language } from '../../../../src/features/language/language-api';
import type { Option } from '../../../../src/features/option/option-api';
import type { Project } from '../../../../src/features/project/project-api';
import type { SocialLink } from '../../../../src/features/social-link/social-link-api';

/** Rows in the API's own shape, as few as the sections need. */
const UPDATED = '2026-10-10T16:34:25.089Z';

export const option = (
  list: string,
  code: string,
  name: string,
  order = 0,
  icon?: string,
) =>
  ({
    id: `${list}/${code}`,
    list,
    code,
    name: { en: name },
    order,
    ...(icon ? { icon } : {}),
  }) as unknown as Option;

export const OPTIONS: Option[] = [
  option('skill-category', 'engineering', 'Engineering'),
  option('technology-category', 'frontend', 'Frontend'),
  option('technology-category', 'backend', 'Backend', 1),
  option('tool-category', 'versioning', 'Version control'),
  option('employment-type', 'full-time', 'Full-time'),
  option('education-level', 'vocational', 'Vocational training'),
  option('language-level', 'a1', 'A1 — Beginner', 0),
  option('language-level', 'b1', 'B1 — Intermediate', 1),
  option('language-level', 'native', 'Native', 2),
  option('social-platform', 'github', 'GitHub', 0, 'github'),
  option('availability-status', 'not-looking', 'Not looking'),
];

export const expertise = (
  id: string,
  kind: Expertise['kind'],
  name: string,
  category: string,
  level: number,
  order: number,
  icon?: Expertise['icon'],
) =>
  ({
    id,
    kind,
    name: { en: name },
    category,
    level,
    order,
    updatedAt: UPDATED,
    ...(icon ? { icon } : {}),
  }) as Expertise;

export const SKILLS = [
  expertise('s1', 'skill', 'REST API design', 'engineering', 80, 0),
];
export const TECHNOLOGIES = [
  expertise('t1', 'technology', 'React', 'frontend', 85, 0, {
    kind: 'preset',
    value: 'react',
  }),
  expertise('t2', 'technology', 'Laravel', 'backend', 75, 1, {
    kind: 'upload',
    value: '/uploads/expertise/icon.png',
  }),
];
export const TOOLS = [
  expertise('o1', 'tool', 'Git', 'versioning', 85, 0, {
    kind: 'preset',
    value: 'git',
  }),
];

export const project = (overrides: Partial<Project>): Project => ({
  id: 'p',
  slug: 'p',
  title: { en: 'P' },
  description: { en: 'About P.' },
  stack: [],
  gallery: [],
  featured: false,
  order: 0,
  updatedAt: UPDATED,
  ...overrides,
});

export const PROJECTS: Project[] = [
  project({
    id: 'b',
    slug: 'store',
    title: { en: 'Online store' },
    order: 2,
    imageUrl: '/uploads/project/store.png',
  }),
  project({
    id: 'a',
    slug: 'market',
    title: { en: 'Marketplace' },
    description: { en: 'A marketplace.' },
    order: 0,
    featured: true,
    stack: ['t1', 'missing', 't2'],
    imageUrl: '/uploads/project/cover.png',
    imageAlt: { en: 'The cover' },
    gallery: [{ url: '/uploads/project/shot.png', alt: { en: 'A screen' } }],
    role: { en: 'Everything.' },
    problem: { en: 'The problem.' },
    outcome: { en: 'The outcome.' },
    repoUrl: 'https://example.test/repo',
    liveUrl: 'https://example.test',
  }),
];

export const EXPERIENCE: Experience[] = [
  {
    id: 'e1',
    role: { en: 'Developer' },
    organisation: { en: 'Acme' },
    location: { en: 'Casablanca' },
    employmentType: 'full-time',
    startDate: '2026-07',
    current: true,
    description: { en: 'Building.' },
    updatedAt: UPDATED,
  },
];

export const EDUCATION: Education[] = [
  {
    id: 'd1',
    institution: { en: 'ISTA' },
    qualification: { en: 'Technician' },
    level: 'vocational',
    startDate: '2025-09',
    endDate: '2026-07',
    current: false,
    updatedAt: UPDATED,
  },
];

export const CREDENTIALS: Credential[] = [
  {
    id: 'c1',
    kind: 'certification',
    name: { en: 'Algorithms' },
    issuer: { en: 'freeCodeCamp' },
    issuedAt: '2026-01',
    expiresAt: '2028-01',
    credentialId: 'ABC-1',
    credentialUrl: 'https://example.test/c',
    description: { en: 'In progress.' },
    updatedAt: UPDATED,
  },
  {
    id: 'c2',
    kind: 'course',
    name: { en: 'Accounting' },
    issuer: { en: 'Acme' },
    issuedAt: '2026-07',
    updatedAt: UPDATED,
  },
];

export const LANGUAGES: Language[] = [
  { id: 'l2', code: 'fr', level: 'b1', order: 1, updatedAt: UPDATED },
  { id: 'l1', code: 'ar', level: 'native', order: 0, updatedAt: UPDATED },
];

export const SOCIAL: SocialLink[] = [
  {
    id: 'g',
    platform: 'github',
    url: 'https://github.com/example',
    order: 0,
    updatedAt: UPDATED,
  },
];
