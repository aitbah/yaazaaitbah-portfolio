import {
  AwardIcon,
  BookOpenIcon,
  BriefcaseIcon,
  CodeIcon,
  GraduationCapIcon,
  LanguagesIcon,
  FolderGitIcon,
  LayoutDashboardIcon,
  ListIcon,
  UserCogIcon,
  LightbulbIcon,
  MailIcon,
  Share2Icon,
  UserIcon,
  WrenchIcon,
} from 'lucide-react';

/**
 * The admin's navigation, grouped the way a CV reads: who you are, what you can
 * do, what you have done, what you hold. Languages sit with the profile, as an
 * attribute rather than an award.
 *
 * This table is the only place a section is declared - the sidebar renders it
 * and the breadcrumb resolves against it - and `admin-navigation.test.ts` fails
 * on an entry with no page or a page with no entry.
 */
export const ADMIN_NAV_SECTIONS = [
  {
    key: 'overview',
    items: [{ key: 'dashboard', href: '/admin', icon: LayoutDashboardIcon }],
  },
  {
    // Named "Personal" rather than "Profile": a heading that repeats the name
    // of the entry directly beneath it says nothing, and reads as a mistake.
    key: 'personal',
    items: [
      { key: 'profile', href: '/admin/profile', icon: UserIcon },
      { key: 'languages', href: '/admin/languages', icon: LanguagesIcon },
      { key: 'socialLinks', href: '/admin/social-links', icon: Share2Icon },
    ],
  },
  {
    key: 'expertise',
    // Three entries, not one: a capability, a technology and a tool are three
    // different claims, and the sidebar is where that starts.
    items: [
      { key: 'skills', href: '/admin/skills', icon: LightbulbIcon },
      { key: 'technologies', href: '/admin/technologies', icon: CodeIcon },
      { key: 'tools', href: '/admin/tools', icon: WrenchIcon },
    ],
  },
  {
    key: 'career',
    items: [
      { key: 'experience', href: '/admin/experience', icon: BriefcaseIcon },
      { key: 'projects', href: '/admin/projects', icon: FolderGitIcon },
    ],
  },
  {
    key: 'qualifications',
    items: [
      { key: 'education', href: '/admin/education', icon: GraduationCapIcon },
      {
        key: 'certifications',
        href: '/admin/certifications',
        icon: AwardIcon,
      },
      { key: 'courses', href: '/admin/courses', icon: BookOpenIcon },
    ],
  },
  {
    key: 'inbox',
    items: [{ key: 'messages', href: '/admin/messages', icon: MailIcon }],
  },
  {
    // Last, and on its own: the option lists are what the other sections choose
    // *from*, so they are configuration rather than content - the one screen
    // here that is not somebody's CV.
    key: 'configuration',
    items: [{ key: 'options', href: '/admin/options', icon: ListIcon }],
  },
] as const;

/**
 * What the account menu links to: pages about the person signed in rather than
 * the site's content. Declared here so the same navigation test covers them.
 */
export const ADMIN_MENU_ITEMS = [
  { key: 'profile', href: '/admin/profile', icon: UserIcon },
  // "Account" rather than "Settings": what is here is the signed-in account,
  // and a page called Settings would promise site-wide ones that deliberately
  // do not exist.
  { key: 'account', href: '/admin/account', icon: UserCogIcon },
] as const;

export type AdminNavItem =
  | (typeof ADMIN_NAV_SECTIONS)[number]['items'][number]
  | (typeof ADMIN_MENU_ITEMS)[number];

/**
 * The entry a path belongs to, or `undefined` for a route with no entry
 * anywhere - the sidebar's sections and the account menu's items alike, since
 * the breadcrumb has to name a page whichever door leads to it.
 *
 * Exact match rather than a prefix: `/admin` is the prefix of every other
 * entry, so a prefix test would report the dashboard for all of them.
 */
export function findNavItem(pathname: string): AdminNavItem | undefined {
  const lists: readonly (readonly AdminNavItem[])[] = [
    // Widened from the literal tuples, whose per-section element types have
    // nothing in common but the shape this signature already names.
    ...ADMIN_NAV_SECTIONS.map((section) => section.items),
    ADMIN_MENU_ITEMS,
  ];

  for (const items of lists) {
    const match = items.find((item) => item.href === pathname);

    if (match) {
      return match;
    }
  }

  return undefined;
}
