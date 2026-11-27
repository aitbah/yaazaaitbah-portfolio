import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';

import admin from '../../../messages/en/admin.json';
import {
  ADMIN_MENU_ITEMS,
  ADMIN_NAV_SECTIONS,
  findNavItem,
  type AdminNavItem,
} from '../../../src/features/admin/admin-navigation';

/**
 * The signed-in half of the admin. Every page under here is reachable only
 * through the sidebar or the account menu, so a page in neither is a page
 * nobody can open and an entry with no page is a link to a 404.
 */
const PROTECTED = join(
  import.meta.dirname,
  '..',
  '..',
  '..',
  'src',
  'app',
  '[locale]',
  'admin',
  '(protected)',
);

// Widened from the literal tuple for the same reason `findNavItem` does it:
// the per-section element types share nothing but the shape named here.
const ITEMS: readonly AdminNavItem[] = [
  ...ADMIN_NAV_SECTIONS.flatMap(
    (section): readonly AdminNavItem[] => section.items,
  ),
  ...ADMIN_MENU_ITEMS,
];

/** `/admin/projects` → the App Router file that answers it. */
function pageFile(href: string): string {
  return join(PROTECTED, href.replace(/^\/admin\/?/, ''), 'page.tsx');
}

/** Every route the folder actually serves, read from disk rather than listed. */
function routedPaths(): string[] {
  const nested = readdirSync(PROTECTED, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        existsSync(join(PROTECTED, entry.name, 'page.tsx')),
    )
    .map((entry) => `/admin/${entry.name}`);

  return existsSync(join(PROTECTED, 'page.tsx'))
    ? ['/admin', ...nested]
    : nested;
}

/**
 * `ADMIN_NAV_SECTIONS` calls itself "the only place a section is declared", and
 * until this file nothing held it to that. The table is written by hand and the
 * routes are folders on disk: the two drift the moment someone builds a page
 * and forgets the line, or writes the line before the page.
 *
 * Both directions are checked, because they fail differently and neither fails
 * loudly. A missing page is a link to a 404. A missing entry is a page that
 * renders with no breadcrumb label, since `findNavItem` is what resolves one -
 * and a section nobody can navigate to.
 *
 * `ADMIN_MENU_ITEMS` is held to the same rules: the account menu used to
 * hardcode its one link and was covered by neither direction.
 */
describe('the admin navigation table and the routes agree', () => {
  it.each(ITEMS.map((item) => item.href))('serves a page for %s', (href) => {
    expect(existsSync(pageFile(href)), `${href} has no page.tsx`).toBe(true);
  });

  it.each(routedPaths())('has a navigation entry for %s', (href) => {
    expect(findNavItem(href), `${href} is in no section`).toBeDefined();
  });

  it('resolves a label for every entry it declares', () => {
    const t = createTranslator({
      locale: 'en',
      messages: admin,
      namespace: 'admin.nav',
      onError: () => {},
    }) as unknown as (key: string) => string;

    for (const item of ITEMS) {
      // next-intl falls back to the key path when a message is missing, which
      // in a sidebar reads as "admin.nav.languages".
      expect(t(item.key), `${item.key} has no label`).not.toBe(
        `admin.nav.${item.key}`,
      );
    }
  });

  it('gives every section a heading', () => {
    const headings: Record<string, unknown> = admin.admin.nav.sections;

    for (const section of ADMIN_NAV_SECTIONS) {
      expect(headings[section.key], `${section.key} has no heading`).toBeTypeOf(
        'string',
      );
    }
  });
});
